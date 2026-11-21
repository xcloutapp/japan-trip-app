// The trip details are stored locked (encrypted) so the public website shows nothing private.
// The family code unlocks them on the phone. The code is remembered on that phone only.
const KEY = 'familyCode';

export const normalise = (c) => String(c || '').trim().toLowerCase().replace(/\s+/g, '');

export function savedCode() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function forgetCode() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Opens a locked ticket picture (made by tools/encrypt-file.mjs) and returns a link the page can show.
let fileKey = null;
export async function openFile(trip, src) {
  if (!fileKey) fileKey = await crypto.subtle.importKey('raw', fromB64(trip.fileKey), 'AES-GCM', false, ['decrypt']);
  const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
  const tlen = buf[0];
  const type = new TextDecoder().decode(buf.slice(1, 1 + tlen));
  const iv = buf.slice(1 + tlen, 13 + tlen);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, fileKey, buf.slice(13 + tlen));
  return URL.createObjectURL(new Blob([plain], { type }));
}

export async function unlock(rawCode, remember) {
  const code = normalise(rawCode);
  let box;
  try {
    const res = await fetch('data/trip.enc.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('http');
    box = await res.json();
  } catch {
    throw new Error('offline');
  }
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(box.salt), iterations: box.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.data));
  } catch {
    throw new Error('wrong code');
  }
  if (remember) {
    try { localStorage.setItem(KEY, code); } catch { /* private mode */ }
  }
  return JSON.parse(new TextDecoder().decode(plain));
}
