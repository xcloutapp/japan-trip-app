// Run before each release: refreshes the offline file list and version in sw.js,
// so every phone downloads the new version and keeps it for offline use.
// Usage: node tools/release.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dirs = ['css', 'js', 'fonts', 'img', 'data'];
const files = ['./', 'index.html', 'manifest.webmanifest'];
async function walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) await walk(p);
    else if (!/\.(txt|md)$/.test(e.name)) files.push(p);
  }
}
for (const d of dirs) await walk(d);
files.sort();
const version = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
let sw = await readFile('sw.js', 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
sw = sw.replace(/const FILES = \[[\s\S]*?\];/, `const FILES = ${JSON.stringify(files, null, 2)};`);
await writeFile('sw.js', sw);
console.log(`sw.js: version ${version}, ${files.length} files`);
