const DB_NAME = "portalGerencial.storage";
const DB_VERSION = 1;
const DB_STORE = "items";

export const COMPANIES_KEY = "portalGerencial.companies.v2";
export const ACTIVE_COMPANY_KEY = "portalGerencial.activeCompany.v2";
export const GROUPS_KEY = "portalGerencial.groups.v1";
export const ACTIVE_GROUP_KEY = "portalGerencial.activeGroup.v1";
export const REPRESENTANTES_KEY = "portalGerencial.representantes.v1";
export const INDICATORS_KEY = "portalGerencial.indicatorOverrides.v1";
export const PLANO_OVERRIDES_KEY = "portalGerencial.planoOverrides.v1";
export const PLANO_SNAPSHOT_KEY = "portalGerencial.planoSnapshot.v1";
export const PLANO_BACKUP_KEY = "portalGerencial.planoBackup.v1";

function openStorageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("falha ao abrir IndexedDB"));
  });
}

function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error || new Error("falha ao ler IndexedDB"));
  });
}

function dbSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("falha ao salvar IndexedDB"));
    tx.objectStore(DB_STORE).put({ key, value, updatedAt: new Date().toISOString() });
  });
}

function readLocalStorageValue(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  return JSON.parse(raw);
}

export async function readPersistent(key) {
  if (!("indexedDB" in window)) return readLocalStorageValue(key);
  const db = await openStorageDb();
  const value = await dbGet(db, key);
  if (value !== undefined) return value;
  const migrated = readLocalStorageValue(key);
  if (migrated !== undefined) await dbSet(db, key, migrated);
  return migrated;
}

export async function writePersistent(key, value) {
  if (!("indexedDB" in window)) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  const db = await openStorageDb();
  await dbSet(db, key, value);
  try {
    localStorage.removeItem(key);
  } catch {
    // Old large payloads can stay behind without blocking the IndexedDB save.
  }
}

export async function readStoredArray(key) {
  try {
    const stored = await readPersistent(key);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}
