// Locks a ticket picture (QR code, voucher) with the trip's file key, so it can sit in the public repo.
// Usage: node tools/encrypt-file.mjs <path/to/trip.json> <picture.jpg> <data/files/name.enc>
import { readFile, writeFile } from 'node:fs/promises';

const [, , tripPath, src, out] = process.argv;
if (!tripPath || !src || !out) {
  console.error('Usage: node tools/encrypt-file.mjs <trip.json> <picture> <data/files/name.enc>');
  process.exit(1);
}
const trip = JSON.parse(await readFile(tripPath, 'utf8'));
if (!trip.fileKey) throw new Error('trip.json has no fileKey');
const key = await crypto.subtle.importKey('raw', Buffer.from(trip.fileKey, 'base64'), 'AES-GCM', false, ['encrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const body = await readFile(src);
const type = /\.png$/i.test(src) ? 'image/png' : 'image/jpeg';
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, body));
// File layout: 1 byte type length, type, 12-byte iv, ciphertext
const t = Buffer.from(type);
await writeFile(out, Buffer.concat([Buffer.from([t.length]), t, Buffer.from(iv), Buffer.from(ct)]));
console.log(`Wrote ${out}`);
