import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'nnotes-web';
const VERSION = 1;
const DOCS = 'documents';
const PREFS = 'prefs';

export interface StoredDocument {
  id: string;
  name: string;
  updatedAt: number;
  blob: Blob;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(DOCS)) {
          const store = database.createObjectStore(DOCS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!database.objectStoreNames.contains(PREFS)) database.createObjectStore(PREFS);
      },
    });
  }
  return dbPromise;
}

export async function saveDocument(id: string, name: string, blob: Blob): Promise<void> {
  const d = await db();
  const record: StoredDocument = { id, name, updatedAt: Date.now(), blob };
  await d.put(DOCS, record);
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const d = await db();
  const all = await d.getAll(DOCS) as StoredDocument[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadDocument(id: string): Promise<StoredDocument | undefined> {
  return (await db()).get(DOCS, id) as Promise<StoredDocument | undefined>;
}

export async function deleteDocument(id: string): Promise<void> {
  await (await db()).delete(DOCS, id);
}

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  const value = await (await db()).get(PREFS, key);
  return value === undefined ? fallback : value as T;
}

export async function setPref<T>(key: string, value: T): Promise<void> {
  await (await db()).put(PREFS, value, key);
}
