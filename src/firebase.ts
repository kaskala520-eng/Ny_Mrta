import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { CommandLogEntry } from './types';
import { isAuthorizedAdminEmail } from './utils/adminTracking';

const app = initializeApp(firebaseConfig);

// CRITICAL: Always pass firebaseConfig.firestoreDatabaseId for provisioned Enterprise Firestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on application boot
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export { onAuthStateChanged };

export async function signInWithGoogleAccount(): Promise<{
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}> {
  const cred = await signInWithPopup(auth, googleProvider);
  const fbUser = cred.user;
  const email = fbUser.email || '';
  const isAdmin = await isAuthorizedAdminEmail(email);

  if (fbUser.uid && fbUser.emailVerified) {
    try {
      await syncFirebaseUserDoc(fbUser, isAdmin);
    } catch {
      // Non-fatal if doc already exists or quota constrained
    }
  }

  return {
    uid: fbUser.uid,
    email: isAdmin ? '' : email,
    displayName: fbUser.displayName || email.split('@')[0] || 'Meta.Ny User',
    isAdmin,
  };
}

export async function signOutGoogleAccount(): Promise<void> {
  await signOut(auth);
}

async function syncFirebaseUserDoc(fbUser: FirebaseUser, isAdmin: boolean): Promise<void> {
  const userPath = `users/${fbUser.uid}`;
  try {
    await setDoc(
      doc(db, 'users', fbUser.uid),
      {
        uid: fbUser.uid,
        name: (fbUser.displayName || 'Meta.Ny User').slice(0, 120),
        isVIP: false,
        hideAds: false,
        isBanned: false,
        usageCount: 0,
        visitCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    } catch {
      // swallow if non-blocking
    }
  }

  if (isAdmin) {
    const adminPath = `admins/${fbUser.uid}`;
    try {
      await setDoc(
        doc(db, 'admins', fbUser.uid),
        {
          uid: fbUser.uid,
          role: 'admin',
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, adminPath);
      } catch {
        // non-blocking
      }
    }
  }
}

export async function uploadBlobToFirebaseStorage(
  blob: Blob,
  storagePath: string
): Promise<string> {
  const ref = storageRef(storage, storagePath);
  await uploadBytes(ref, blob, {
    contentType: blob.type || 'application/octet-stream',
  });
  return getDownloadURL(ref);
}

export async function deleteFromFirebaseStorage(firebaseStoragePath: string): Promise<void> {
  const cleanPath = firebaseStoragePath.replace(/^firebase:\/\//, '').trim();
  if (!cleanPath) return;
  const ref = storageRef(storage, cleanPath);
  await deleteObject(ref);
}

function sanitizeIdForFirestore(id: string): string {
  const clean = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean.slice(0, 120) || `ord_${Date.now()}`;
}

export async function saveOrderToFirestore(order: CommandLogEntry): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const orderId = sanitizeIdForFirestore(order.id);
  const docPath = `orders/${orderId}`;

  const payload: Record<string, any> = {
    id: orderId,
    ownerUid: fbUser.uid,
    userName: (order.userName || 'Meta.Ny User').slice(0, 120),
    command: (order.command || 'tool').slice(0, 64),
    details: (order.details || 'Action').slice(0, 500),
    status: order.status || 'success',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (order.audit?.queryText) payload.queryText = order.audit.queryText.slice(0, 1000);
  if (order.audit?.inputPreview) payload.inputPreview = order.audit.inputPreview.slice(0, 3000);
  if (order.audit?.outputPreview) payload.outputPreview = order.audit.outputPreview.slice(0, 4000);
  if (order.audit?.targetLang) payload.targetLang = order.audit.targetLang.slice(0, 64);
  if (order.audit?.originalFileUrl) payload.originalFileUrl = order.audit.originalFileUrl.slice(0, 2048);
  if (order.audit?.originalFileStoragePath) {
    payload.originalFileStoragePath = order.audit.originalFileStoragePath.slice(0, 512);
  }
  if (order.audit?.attachedFileName) {
    payload.originalFileName = order.audit.attachedFileName.slice(0, 256);
  }
  if (typeof order.audit?.attachedFileSize === 'number') {
    payload.originalFileSize = Math.max(0, order.audit.attachedFileSize);
  }
  if (order.audit?.attachedFileType) {
    payload.originalFileType = order.audit.attachedFileType.slice(0, 128);
  }
  if (order.audit?.resultFileUrl) payload.resultFileUrl = order.audit.resultFileUrl.slice(0, 2048);
  if (order.audit?.resultFileStoragePath) {
    payload.resultFileStoragePath = order.audit.resultFileStoragePath.slice(0, 512);
  }
  if (order.audit?.resultFileName) payload.resultFileName = order.audit.resultFileName.slice(0, 256);
  if (order.audit?.resultFileType) payload.resultFileType = order.audit.resultFileType.slice(0, 128);
  if (typeof order.audit?.filesDeletedFromServer === 'boolean') {
    payload.filesDeletedFromServer = order.audit.filesDeletedFromServer;
  }
  if (typeof order.audit?.retentionDays === 'number') {
    payload.retentionDays = Math.min(365, Math.max(1, Math.round(order.audit.retentionDays)));
  }
  if (order.audit?.expiresAt) {
    payload.expiresAt = String(order.audit.expiresAt).slice(0, 64);
  }
  if (typeof order.audit?.autoDeleted === 'boolean') {
    payload.autoDeleted = order.audit.autoDeleted;
  }
  if (order.audit?.autoDeletedAt) {
    payload.autoDeletedAt = String(order.audit.autoDeletedAt).slice(0, 64);
  }

  try {
    await setDoc(doc(db, 'orders', orderId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function markOrderFilesDeletedInFirestore(
  orderId: string,
  options?: { autoDeleted?: boolean; autoDeletedAt?: string }
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const cleanId = sanitizeIdForFirestore(orderId);
  const docPath = `orders/${cleanId}`;
  const updatePayload: Record<string, any> = {
    originalFileUrl: '',
    originalFileStoragePath: '',
    resultFileUrl: '',
    resultFileStoragePath: '',
    filesDeletedFromServer: true,
    updatedAt: serverTimestamp(),
  };
  if (options?.autoDeleted) {
    updatePayload.autoDeleted = true;
    updatePayload.autoDeletedAt = (options.autoDeletedAt || new Date().toISOString()).slice(0, 64);
  }

  try {
    await updateDoc(doc(db, 'orders', cleanId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function fetchOrdersFromFirestore(isAdminUser: boolean): Promise<CommandLogEntry[]> {
  const fbUser = auth.currentUser;
  if (!fbUser) return [];

  const path = 'orders';
  try {
    const q = isAdminUser
      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(150))
      : query(
          collection(db, 'orders'),
          where('ownerUid', '==', fbUser.uid),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, any>;
      const ts = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();
      return {
        id: data.id || d.id,
        userId: data.ownerUid || 'firebase_user',
        userName: data.userName || 'Meta.Ny User',
        command: data.command || 'tool',
        details: data.details || '',
        status: data.status || 'success',
        timestamp: ts,
        audit: {
          queryText: data.queryText,
          inputPreview: data.inputPreview,
          outputPreview: data.outputPreview,
          targetLang: data.targetLang,
          attachedFileName: data.originalFileName,
          attachedFileSize: data.originalFileSize,
          attachedFileType: data.originalFileType,
          originalFileUrl: data.originalFileUrl,
          originalFileStoragePath: data.originalFileStoragePath,
          resultFileUrl: data.resultFileUrl,
          resultFileStoragePath: data.resultFileStoragePath,
          resultFileName: data.resultFileName,
          resultFileType: data.resultFileType,
          filesDeletedFromServer: Boolean(data.filesDeletedFromServer),
          retentionDays: typeof data.retentionDays === 'number' ? data.retentionDays : undefined,
          expiresAt: data.expiresAt,
          autoDeleted: Boolean(data.autoDeleted),
          autoDeletedAt: data.autoDeletedAt,
        },
      } as CommandLogEntry;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
