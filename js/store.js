// Photos people add on their own phone (for example a screenshot of their ticket).
// They are kept only on that phone, in the browser's own storage, and work offline.
const DB = 'japan-trip';
const STORE = 'photos';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      s.createIndex('item', 'item');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export const addPhoto = (item, blob) => run('readwrite', (s) => s.add({ item, blob, added: Date.now() }));
export const removePhoto = (id) => run('readwrite', (s) => s.delete(id));
export const photosFor = (item) => run('readonly', (s) => s.index('item').getAll(item));

// Shrink big camera photos so storage stays small.
export async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}
