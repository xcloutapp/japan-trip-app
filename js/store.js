// Photos people add on their own phone (for example a screenshot of their ticket).
// They are kept only on that phone, in the browser's own storage, and work offline.
const DB = 'japan-trip';
const STORE = 'photos';
const KV = 'kv'; // copies of the family's shared things, so they work offline

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }).createIndex('item', 'item');
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbp = null;
async function run(mode, fn, store = STORE) {
  const db = await (dbp = dbp || open().catch((e) => { dbp = null; throw e; }));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export const addPhoto = (item, blob) => run('readwrite', (s) => s.add({ item, blob, added: Date.now() }));
export const removePhoto = (id) => run('readwrite', (s) => s.delete(id));
export const kvGet = (key) => run('readonly', (s) => s.get(key), KV).catch(() => undefined);
export const kvSet = (key, value) => run('readwrite', (s) => s.put(value, key), KV).catch(() => undefined);
export const photosFor = (item) => run('readonly', (s) => s.index('item').getAll(item));

// Shrink big camera photos so storage stays small.
export async function shrink(file, max = 1600, quality = 0.85) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}
