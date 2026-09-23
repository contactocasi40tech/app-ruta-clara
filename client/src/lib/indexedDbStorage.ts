const DB_NAME = "ruta-clara-secure-session";
const STORE_NAME = "auth";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export const indexedDbStorage = {
  async getItem(key: string): Promise<string | null> {
    const result = await transact("readonly", (store) => store.get(key));
    return typeof result === "string" ? result : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await transact("readwrite", (store) => store.put(value, key));
  },
  async removeItem(key: string): Promise<void> {
    await transact("readwrite", (store) => store.delete(key));
  },
};

export async function clearIndexedDbSession(): Promise<void> {
  await transact("readwrite", (store) => store.clear());
}
