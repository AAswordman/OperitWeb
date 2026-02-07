const DB_NAME = 'operit_submission_local_assets';
const STORE_NAME = 'images';
const DB_VERSION = 1;

export const OPERIT_LOCAL_IMAGE_URI_PREFIX = 'operit-local://';

const LOCAL_IMAGE_ID_RE = /^[a-z0-9][a-z0-9_-]{7,63}$/i;

interface OperitLocalImageRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
  blob: Blob;
}

export interface OperitLocalImageAsset {
  id: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
  blob: Blob;
}

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('open_indexeddb_failed'));
});

const sanitizeFileName = (value: string, fallback = 'image') => {
  const normalized = String(value || '')
    .trim()
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  if (normalized) return normalized.slice(0, 100);
  return fallback;
};

const generateAssetId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `img_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

const runRead = <T>(
  db: IDBDatabase,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void,
) => new Promise<T>((resolve, reject) => {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  action(store, resolve, reject);
});

const runWrite = <T>(
  db: IDBDatabase,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void,
) => new Promise<T>((resolve, reject) => {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  action(store, resolve, reject);
  tx.onerror = () => reject(tx.error || new Error('indexeddb_write_failed'));
});

export const saveOperitLocalImage = async (file: File): Promise<OperitLocalImageAsset> => {
  const id = generateAssetId();
  const record: OperitLocalImageRecord = {
    id,
    name: sanitizeFileName(file.name || 'image'),
    type: file.type || 'application/octet-stream',
    size: file.size,
    created_at: new Date().toISOString(),
    blob: file,
  };
  const db = await openDb();
  await runWrite<void>(db, (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('save_local_image_failed'));
  });
  return record;
};

export const getOperitLocalImage = async (id: string): Promise<OperitLocalImageAsset | null> => {
  if (!LOCAL_IMAGE_ID_RE.test(id)) return null;
  const db = await openDb();
  return runRead<OperitLocalImageAsset | null>(db, (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const result = request.result as OperitLocalImageRecord | undefined;
      if (!result?.id || !(result.blob instanceof Blob)) {
        resolve(null);
        return;
      }
      resolve(result);
    };
    request.onerror = () => reject(request.error || new Error('read_local_image_failed'));
  });
};

export const deleteOperitLocalImage = async (id: string): Promise<void> => {
  if (!LOCAL_IMAGE_ID_RE.test(id)) return;
  const db = await openDb();
  await runWrite<void>(db, (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('delete_local_image_failed'));
  });
};

export const extractOperitLocalImageIds = (markdown: string): string[] => {
  const source = String(markdown || '');
  const regex = /operit-local:\/\/([a-z0-9][a-z0-9_-]{7,63})/gi;
  const ids = new Set<string>();
  let match: RegExpExecArray | null = regex.exec(source);
  while (match) {
    const id = (match[1] || '').trim();
    if (LOCAL_IMAGE_ID_RE.test(id)) ids.add(id);
    match = regex.exec(source);
  }
  return Array.from(ids);
};

export const buildOperitLocalImageUri = (id: string) => `${OPERIT_LOCAL_IMAGE_URI_PREFIX}${id}`;
