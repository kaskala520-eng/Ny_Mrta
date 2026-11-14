import {
  auth,
  uploadBlobToFirebaseStorage,
  deleteFromFirebaseStorage,
  saveOrderToFirestore,
  fetchOrdersFromFirestore,
  markOrderFilesDeletedInFirestore,
} from '../firebase';
import { CommandAuditMeta, CommandLogEntry, FileRecord } from '../types';
import {
  getClientCommandLogs,
  LOCAL_COMMAND_LOGS_KEY,
  COMMANDS_UPDATED_EVENT,
  pushAdminNotification,
} from './adminTracking';
import { getOfflineFiles, saveOfflineFile, markOfflineFilesDeletedForOrder } from './offlineDb';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_SETTING_STORAGE_KEY = 'metany_file_retention_days';
export const RETENTION_SETTING_UPDATED_EVENT = 'metany:retention-setting-updated';
export type AllowedRetentionDays = 3 | 7 | 14 | 30;
const ALLOWED_RETENTION_SET = new Set<number>([3, 7, 14, 30]);

export interface UploadedServerFile {
  url: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  retentionDays?: number;
  expiresAt?: string;
}

export interface ExpiryMetaInfo {
  retentionDays: number;
  uploadedAtMs: number;
  expiresAtIso: string;
  expiresAtMs: number;
  uploadedDateFormatted: string;
  expiresDateFormatted: string;
  remainingMs: number;
  remainingDays: number;
  remainingHours: number;
  isExpired: boolean;
  isExpiringTomorrow: boolean;
}

export function formatDateDDMMYYYY(isoOrMs: string | number | Date): string {
  const d = typeof isoOrMs === 'string' || typeof isoOrMs === 'number' ? new Date(isoOrMs) : isoOrMs;
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function getRetentionDaysSettingSync(): AllowedRetentionDays {
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(RETENTION_SETTING_STORAGE_KEY)
        : null;
    const val = Number(raw);
    return ALLOWED_RETENTION_SET.has(val) ? (val as AllowedRetentionDays) : 7;
  } catch {
    return 7;
  }
}

export async function fetchRetentionDaysSetting(): Promise<AllowedRetentionDays> {
  try {
    const resp = await fetch('/api/settings/retention');
    if (resp.ok) {
      const data = await resp.json();
      const days = Number(data?.retentionDays);
      if (ALLOWED_RETENTION_SET.has(days)) {
        try {
          localStorage.setItem(RETENTION_SETTING_STORAGE_KEY, String(days));
        } catch {
          // ignore
        }
        return days as AllowedRetentionDays;
      }
    }
  } catch {
    // offline fallback
  }
  return getRetentionDaysSettingSync();
}

export async function saveRetentionDaysSetting(days: AllowedRetentionDays): Promise<AllowedRetentionDays> {
  const valid = ALLOWED_RETENTION_SET.has(days) ? days : 7;
  try {
    localStorage.setItem(RETENTION_SETTING_STORAGE_KEY, String(valid));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RETENTION_SETTING_UPDATED_EVENT, { detail: valid }));
    }
  } catch {
    // ignore
  }
  try {
    await fetch('/api/settings/retention', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: valid }),
    });
  } catch {
    // ignore offline
  }
  return valid;
}

export function computeExpiryMeta(
  createdAtIso?: string,
  existingRetentionDays?: number,
  existingExpiresAt?: string
): ExpiryMetaInfo {
  const parsedCreated = createdAtIso ? new Date(createdAtIso).getTime() : Date.now();
  const uploadedAtMs = Number.isFinite(parsedCreated) ? parsedCreated : Date.now();
  const retentionDays =
    typeof existingRetentionDays === 'number' && existingRetentionDays > 0
      ? existingRetentionDays
      : getRetentionDaysSettingSync();

  const parsedExp = existingExpiresAt ? new Date(existingExpiresAt).getTime() : NaN;
  const expiresAtMs = Number.isFinite(parsedExp) ? parsedExp : uploadedAtMs + retentionDays * DAY_MS;
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  const now = Date.now();
  const remainingMs = Math.max(0, expiresAtMs - now);
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const remainingDays = Math.ceil(remainingMs / DAY_MS);
  const isExpired = now >= expiresAtMs;
  const isExpiringTomorrow = !isExpired && remainingMs <= DAY_MS;

  return {
    retentionDays,
    uploadedAtMs,
    expiresAtIso,
    expiresAtMs,
    uploadedDateFormatted: formatDateDDMMYYYY(uploadedAtMs),
    expiresDateFormatted: formatDateDDMMYYYY(expiresAtMs),
    remainingMs,
    remainingDays,
    remainingHours,
    isExpired,
    isExpiringTomorrow,
  };
}

// WeakMap cache so the exact same File instance is uploaded once per session and shared across modals
const uploadedFileCache = new WeakMap<File, UploadedServerFile>();
const pendingFileUploadCache = new WeakMap<File, Promise<UploadedServerFile | null>>();

export function getCachedUploadedFile(file: File | null | undefined): UploadedServerFile | null {
  if (!file) return null;
  return uploadedFileCache.get(file) || null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to encode file for upload'));
    reader.readAsDataURL(blob);
  });
}

function sanitizePathSegment(name: string): string {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

/**
 * Upload real File or Blob to Cloud Storage (Firebase Storage primary when signed in & enabled,
 * with automatic Express Server Disk Storage `/api/storage/upload` fallback so uploads ALWAYS persist).
 */
export async function uploadFileToCloudOrServer(
  fileOrBlob: Blob,
  fileName: string,
  mimeType: string,
  kind: 'original' | 'result',
  ownerId: string = 'local_user'
): Promise<UploadedServerFile | null> {
  if (fileOrBlob instanceof File) {
    const cached = uploadedFileCache.get(fileOrBlob);
    if (cached) return cached;
    const inflight = pendingFileUploadCache.get(fileOrBlob);
    if (inflight) return inflight;
  }

  const runUpload = async (): Promise<UploadedServerFile | null> => {
    const safeName = sanitizePathSegment(fileName);
    const resolvedType = mimeType || fileOrBlob.type || 'application/octet-stream';
    const retentionDays = getRetentionDaysSettingSync();
    const expiresAt = new Date(Date.now() + retentionDays * DAY_MS).toISOString();

    // 1) Try Firebase Storage if authenticated with Firebase Auth
    const fbUser = auth.currentUser;
    if (fbUser && fbUser.uid) {
      try {
        const fbPath = `orders/${fbUser.uid}/${kind}_${Date.now()}_${safeName}`;
        const downloadUrl = await uploadBlobToFirebaseStorage(fileOrBlob, fbPath);
        const res: UploadedServerFile = {
          url: downloadUrl,
          storagePath: `firebase://${fbPath}`,
          fileName: fileName || safeName,
          fileType: resolvedType,
          fileSize: fileOrBlob.size,
          retentionDays,
          expiresAt,
        };
        if (fileOrBlob instanceof File) uploadedFileCache.set(fileOrBlob, res);
        return res;
      } catch (fbErr) {
        console.warn('Firebase Storage upload fallback to server disk storage:', fbErr);
      }
    }

    // 2) Upload to Express Server Storage (`/api/storage/upload`)
    try {
      const base64Data = await blobToBase64(fileOrBlob);
      const resp = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileName || safeName,
          mimeType: resolvedType,
          base64Data,
          kind,
          ownerId,
          retentionDays,
        }),
      });
      if (!resp.ok) {
        throw new Error(`Upload HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data?.success && data.url) {
        const res: UploadedServerFile = {
          url: data.url,
          storagePath: data.storagePath || `server://${data.fileId}`,
          fileName: data.fileName || fileName,
          fileType: data.fileType || resolvedType,
          fileSize: data.fileSize || fileOrBlob.size,
          retentionDays: data.retentionDays || retentionDays,
          expiresAt: data.expiresAt || expiresAt,
        };
        if (fileOrBlob instanceof File) uploadedFileCache.set(fileOrBlob, res);
        return res;
      }
    } catch (srvErr) {
      console.warn('Server file upload failed:', srvErr);
    }

    return null;
  };

  const promise = runUpload();
  if (fileOrBlob instanceof File) {
    pendingFileUploadCache.set(fileOrBlob, promise);
  }
  return promise;
}

/**
 * Persist an order record to Express Server DB (`/api/orders`), Firestore (`orders` when signed in),
 * and local command log cache (`metany_command_logs`). Applies current retentionDays to NEW orders.
 */
export async function persistOrderToServerAndCloud(order: CommandLogEntry): Promise<void> {
  const existingSettingDays = getRetentionDaysSettingSync();
  const baseCreated = order.timestamp || new Date().toISOString();
  const retDays = order.audit?.retentionDays || existingSettingDays;
  const expiresAt =
    order.audit?.expiresAt ||
    new Date(new Date(baseCreated).getTime() + retDays * DAY_MS).toISOString();

  const normalizedOrder: CommandLogEntry = {
    ...order,
    audit: {
      ...(order.audit || {}),
      retentionDays: retDays,
      expiresAt,
      autoDeleted: Boolean(order.audit?.autoDeleted),
    },
  };

  // 1) Sync local command log entry (preserve existing retention fields if matching ID)
  try {
    const list = getClientCommandLogs();
    const idx = list.findIndex((item) => item.id === normalizedOrder.id);
    const updated =
      idx >= 0
        ? list.map((item, i) =>
            i === idx
              ? {
                  ...item,
                  ...normalizedOrder,
                  audit: {
                    ...(item.audit || {}),
                    ...(normalizedOrder.audit || {}),
                    retentionDays: item.audit?.retentionDays || normalizedOrder.audit?.retentionDays,
                    expiresAt: item.audit?.expiresAt || normalizedOrder.audit?.expiresAt,
                  },
                }
              : item
          )
        : [normalizedOrder, ...list].slice(0, 120);
    localStorage.setItem(LOCAL_COMMAND_LOGS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(COMMANDS_UPDATED_EVENT));
    }
  } catch {
    // ignore local quota
  }

  // 2) Persist to Server DB
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedOrder),
    });
  } catch {
    // ignore offline/static mode
  }

  // 3) Persist to Cloud Firestore (when Firebase Auth is signed in & verified)
  try {
    await saveOrderToFirestore(normalizedOrder);
  } catch (err) {
    console.warn('Firestore order save note:', err);
  }
}

/**
 * Update an order's audit metadata (for example, attaching resultFileUrl or filesDeletedFromServer)
 */
export async function updateOrderAuditOnServerAndLocal(
  orderId: string,
  auditPatch: Partial<CommandAuditMeta>
): Promise<void> {
  try {
    const list = getClientCommandLogs();
    const updated = list.map((o) =>
      o.id === orderId ? { ...o, audit: { ...(o.audit || {}), ...auditPatch } } : o
    );
    localStorage.setItem(LOCAL_COMMAND_LOGS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(COMMANDS_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }

  try {
    await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit: auditPatch }),
    });
  } catch {
    // ignore
  }
}

/**
 * Fetch and merge orders from Server DB + Firestore + local storage (preferring records with real URLs).
 */
export async function fetchAllOrdersMerged(isAdminUser: boolean): Promise<CommandLogEntry[]> {
  const byId = new Map<string, CommandLogEntry>();

  const mergeIn = (items: CommandLogEntry[]) => {
    for (const item of items) {
      if (!item || !item.id) continue;
      const prev = byId.get(item.id);
      if (!prev) {
        byId.set(item.id, item);
      } else {
        byId.set(item.id, {
          ...prev,
          ...item,
          audit: {
            ...(prev.audit || {}),
            ...(item.audit || {}),
          },
        });
      }
    }
  };

  mergeIn(getClientCommandLogs());

  try {
    const resp = await fetch('/api/orders');
    if (resp.ok) {
      const data = await resp.json();
      if (data?.success && Array.isArray(data.orders)) {
        mergeIn(data.orders);
      }
    }
  } catch {
    // ignore
  }

  try {
    const cloudOrders = await fetchOrdersFromFirestore(isAdminUser);
    if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
      mergeIn(cloudOrders);
    }
  } catch (err) {
    console.warn('Firestore orders fetch note:', err);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Permanently delete original and result files for an order from Firebase Storage and/or Express server disk.
 * Never deletes user accounts or order history records.
 */
export async function permanentlyDeleteOrderFilesFromServer(
  order: CommandLogEntry,
  options?: { autoDeleted?: boolean; autoDeletedAt?: string }
): Promise<void> {
  const origPath = order.audit?.originalFileStoragePath || '';
  const resPath = order.audit?.resultFileStoragePath || '';
  const isAuto = Boolean(options?.autoDeleted);
  const autoAt = options?.autoDeletedAt || (isAuto ? new Date().toISOString() : undefined);

  for (const p of [origPath, resPath]) {
    if (!p) continue;
    if (p.startsWith('firebase://')) {
      try {
        await deleteFromFirebaseStorage(p);
      } catch (err) {
        console.warn('Firebase Storage delete failed:', err);
      }
    } else if (p.startsWith('server://')) {
      const fileId = p.replace(/^server:\/\//, '');
      try {
        await fetch(`/api/storage/file/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    }
  }

  try {
    await fetch(`/api/orders/${encodeURIComponent(order.id)}/files`, { method: 'DELETE' });
  } catch {
    // ignore
  }

  try {
    await markOrderFilesDeletedInFirestore(order.id, {
      autoDeleted: isAuto,
      autoDeletedAt: autoAt,
    });
  } catch {
    // non-fatal if order isn't in Firestore or unauthenticated
  }

  try {
    await markOfflineFilesDeletedForOrder(order.id, {
      autoDeleted: isAuto,
      autoDeletedAt: autoAt,
    });
  } catch {
    // ignore offline db issues
  }

  await updateOrderAuditOnServerAndLocal(order.id, {
    originalFileUrl: '',
    originalFileStoragePath: '',
    resultFileUrl: '',
    resultFileStoragePath: '',
    filesDeletedFromServer: true,
    ...(isAuto ? { autoDeleted: true, autoDeletedAt: autoAt } : {}),
  });
}

/**
 * Client + Admin on-open + periodic automatic deletion sweep.
 * Inspects server orders, Firestore orders, local command logs, and IndexedDB offline files;
 * permanently removes any expired files (default 7 days), preserves the order row,
 * converts its state to `تم حذف الملف تلقائيا`, and logs an admin auto-delete record.
 */
export async function runClientAndServerAutoDeleteSweep(
  isAdminUser: boolean
): Promise<{ deletedCount: number; cleanedOrderIds: string[] }> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const dateLabel = formatDateDDMMYYYY(nowIso);
  const cleanedOrderIds: string[] = [];

  try {
    await fetch('/api/orders/cleanup', { method: 'POST' });
  } catch {
    // ignore offline
  }

  try {
    const orders = await fetchAllOrdersMerged(isAdminUser);
    for (const order of orders) {
      if (order.audit?.autoDeleted) continue;
      const meta = computeExpiryMeta(
        order.timestamp,
        order.audit?.retentionDays,
        order.audit?.expiresAt
      );
      if (meta.isExpired) {
        await permanentlyDeleteOrderFilesFromServer(order, {
          autoDeleted: true,
          autoDeletedAt: nowIso,
        });
        cleanedOrderIds.push(order.id);
        pushAdminNotification({
          id: `auto_del_${order.id}`,
          type: 'auto_delete',
          title: 'تم حذف الملف تلقائيا',
          message: `تم حذف الملف تلقائيا بتاريخ ${dateLabel} (${order.audit?.attachedFileName || order.details})`,
          userId: order.userId,
          userName: order.userName,
          orderId: order.id,
          command: order.command,
          timestamp: nowIso,
        });
      }
    }
  } catch {
    // ignore
  }

  // Also sweep offline IndexedDB FileRecords so no expired file remains downloadable forever
  try {
    const offlineList = await getOfflineFiles();
    for (const rec of offlineList) {
      if (rec.autoDeleted) continue;
      const meta = computeExpiryMeta(rec.createdAt, rec.retentionDays, rec.expiresAt);
      if (meta.isExpired) {
        const cleanedRec: FileRecord = {
          ...rec,
          resultContent: '',
          originalFileUrl: '',
          resultFileUrl: '',
          autoDeleted: true,
          autoDeletedAt: nowIso,
        };
        await saveOfflineFile(cleanedRec);
      }
    }
  } catch {
    // ignore
  }

  return { deletedCount: cleanedOrderIds.length, cleanedOrderIds };
}

/**
 * Find user's non-deleted files expiring within <= 24 hours (1 day remaining) to alert them if site is open.
 */
export async function getUserExpiringTomorrowFiles(userId: string): Promise<FileRecord[]> {
  try {
    const all = await getOfflineFiles();
    return all.filter((f) => {
      if (f.autoDeleted) return false;
      if (userId && f.userId && f.userId !== userId && f.userId !== 'local_user') return false;
      const meta = computeExpiryMeta(f.createdAt, f.retentionDays, f.expiresAt);
      return meta.isExpiringTomorrow;
    });
  } catch {
    return [];
  }
}

/**
 * Real file download from a saved server or Firebase Storage URL (no window.open / alert).
 */
export async function triggerRealServerFileDownload(
  fileUrl: string,
  fileName: string
): Promise<void> {
  const safeName = fileName || 'MetaNy_File';
  const isServerUrl = fileUrl.startsWith('/api/storage/file/');
  const downloadHref = isServerUrl
    ? `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}download=1`
    : fileUrl;

  try {
    const resp = await fetch(downloadHref);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = safeName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(objUrl);
      a.remove();
    }, 1500);
  } catch {
    const a = document.createElement('a');
    a.href = downloadHref;
    a.download = safeName;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  }
}
