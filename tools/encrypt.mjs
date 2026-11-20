// Locks the trip details with the family code, so the public website shows nothing private.
// Usage: node tools/encrypt.mjs <path/to/trip.json> <family code>
// Writes data/trip.enc.json. Never commit the plain trip.json.
import { readFile, writeFile } from 'node:fs/promises';

const [, , src, rawCode] = process.argv;
if (!src || !rawCode) {
  console.error('Usage: node tools/encrypt.mjs <trip.json> <family code>');
  process.exit(1);
}
const ITER = 250000;
const code = rawCode.trim().toLowerCase().replace(/\s+/g, '');
const plain = await readFile(src, 'utf8');
JSON.parse(plain); // fail early on bad JSON

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)));
const b64 = (u) => Buffer.from(u).toString('base64');
await writeFile('data/trip.enc.json', JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(ct) }) + '\n');
console.log('Wrote data/trip.enc.json');
