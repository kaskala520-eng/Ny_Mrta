import { FileRecord } from '../types';

const DB_NAME = 'MetaNyOfflineDB';
const DB_VERSION = 1;
const STORE_FILES = 'offline_files';

export function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        const store = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        store.createIndex('serviceUsed', 'serviceUsed', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save file to both IndexedDB and localStorage (for dual persistence)
 */
export async function saveOfflineFile(file: FileRecord): Promise<void> {
  // 1. Save to IndexedDB
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    store.put(file);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to localStorage:', err);
  }

  // 2. Save to localStorage
  try {
    const existing = getLocalStorageFiles();
    const index = existing.findIndex((f) => f.id === file.id);
    if (index >= 0) {
      existing[index] = file;
    } else {
      existing.unshift(file);
    }
    localStorage.setItem('metany_offline_files', JSON.stringify(existing.slice(0, 50)));
  } catch (err) {
    console.warn('localStorage save failed:', err);
  }
}

/**
 * Retrieve all offline files from IndexedDB, falling back to localStorage
 */
export async function getOfflineFiles(): Promise<FileRecord[]> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_FILES, 'readonly');
    const store = tx.objectStore(STORE_FILES);
    const request = store.getAll();

    const idbFiles = await new Promise<FileRecord[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (idbFiles.length > 0) {
      return idbFiles.reverse();
    }
  } catch (err) {
    console.warn('IndexedDB read failed, trying localStorage:', err);
  }

  // Fallback to localStorage
  return getLocalStorageFiles();
}

/**
 * Delete a file from offline storage
 */
export async function deleteOfflineFile(id: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed:', err);
  }

  try {
    const existing = getLocalStorageFiles().filter((f) => f.id !== id);
    localStorage.setItem('metany_offline_files', JSON.stringify(existing));
  } catch (err) {
    console.warn('localStorage delete failed:', err);
  }
}

function getLocalStorageFiles(): FileRecord[] {
  try {
    const raw = localStorage.getItem('metany_offline_files');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

import { clearTranslationCache } from './clientTranslator';

const QA_PURGE_FLAG_KEY = 'metany_qa_rtl_fix_v2_purged';

export async function markOfflineFilesDeletedForOrder(
  orderId: string,
  options?: { autoDeleted?: boolean; autoDeletedAt?: string }
): Promise<void> {
  const all = await getOfflineFiles();
  const nowIso = options?.autoDeletedAt || new Date().toISOString();
  const matches = all.filter((f) => f.orderId === orderId);
  for (const rec of matches) {
    const updated: FileRecord = {
      ...rec,
      resultContent: '',
      originalFileUrl: '',
      resultFileUrl: '',
      autoDeleted: Boolean(options?.autoDeleted ?? true),
      autoDeletedAt: nowIso,
    };
    await saveOfflineFile(updated);
  }
}

/**
 * Purges old stored Q&A outputs generated before the strict RTL/LTR box & pure-Arabic fix.
 */
export async function purgeOldCorruptedQuestionsStorage(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    clearTranslationCache();
    if (localStorage.getItem(QA_PURGE_FLAG_KEY) === 'true') {
      return;
    }

    const allFiles = await getOfflineFiles();
    const oldQuestionIds = allFiles
      .filter((f) => f.serviceUsed === 'questions')
      .map((f) => f.id);

    for (const id of oldQuestionIds) {
      await deleteOfflineFile(id);
    }

    // Also filter metany_offline_files directly in localStorage
    const remainingLocal = getLocalStorageFiles().filter((f) => f.serviceUsed !== 'questions');
    localStorage.setItem('metany_offline_files', JSON.stringify(remainingLocal));

    // Clean old mixed Q&A command logs if present
    try {
      const logsRaw = localStorage.getItem('metany_command_logs_v1');
      if (logsRaw) {
        const parsed = JSON.parse(logsRaw);
        if (Array.isArray(parsed)) {
          const cleanedLogs = parsed.filter((entry: any) => entry?.service !== 'questions');
          localStorage.setItem('metany_command_logs_v1', JSON.stringify(cleanedLogs));
        }
      }
    } catch {
      // ignore invalid log JSON
    }

    localStorage.setItem(QA_PURGE_FLAG_KEY, 'true');
  } catch (err) {
    console.warn('purgeOldCorruptedQuestionsStorage warning:', err);
  }
}
