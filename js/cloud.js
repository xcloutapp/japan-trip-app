// Talks to the family's Firebase database (Google's free online database) over plain web requests.
// Each phone signs in quietly (no account needed). The settings come from the locked trip data,
// so only phones with the family code know where the database is.
let cfg = null;
let root = '';   // projects/<p>/databases/(default)/documents
let base = '';   // root + /trips/<secret trip id>
const API = 'https://firestore.googleapis.com/v1/';
const AUTH = 'fbAuth';

const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export function init(trip) {
  if (!trip.firebase || !trip.tripId) return false;
  cfg = trip.firebase;
  root = `projects/${cfg.projectId}/databases/(default)/documents`;
  base = `${root}/trips/${trip.tripId}`;
  return true;
}
export const ready = () => !!cfg;

let pendingToken = null;
async function token() {
  const a = load(AUTH);
  if (a && a.exp > Date.now() + 60000) return a.id;
  if (!pendingToken) pendingToken = fetchToken(a).finally(() => { pendingToken = null; });
  return pendingToken;
}
async function fetchToken(a) {
  let j = null;
  if (a && a.refresh) {
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${cfg.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.refresh)}`
    });
    if (r.ok) { const x = await r.json(); j = { id: x.id_token, refresh: x.refresh_token, exp: Date.now() + Number(x.expires_in) * 1000 }; }
  }
  if (!j) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true })
    });
    if (!r.ok) throw new Error(`sign-in ${r.status}`);
    const x = await r.json();
    j = { id: x.idToken, refresh: x.refreshToken, exp: Date.now() + Number(x.expiresIn) * 1000 };
  }
  save(AUTH, j);
  return j.id;
}

async function call(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) { const e = new Error(`cloud ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}

/* ---------- Firestore values <-> plain values ---------- */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: encAll(v) } };
}
const encAll = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
function dec(x) {
  if ('stringValue' in x) return x.stringValue;
  if ('booleanValue' in x) return x.booleanValue;
  if ('integerValue' in x) return Number(x.integerValue);
  if ('doubleValue' in x) return x.doubleValue;
  if ('timestampValue' in x) return Date.parse(x.timestampValue);
  if ('arrayValue' in x) return (x.arrayValue.values || []).map(dec);
  if ('mapValue' in x) return decAll(x.mapValue.fields || {});
  return null;
}
const decAll = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, dec(v)]));
const quote = (p) => p.split('.').map((s) => `\`${s.replace(/`/g, '\\`')}\``).join('.');
const idOf = (name) => name.split('/').pop();

/* ---------- reads ---------- */
export async function getDoc(path) {
  const d = await call('GET', `${base}/${path}`);
  return d ? decAll(d.fields) : null;
}

// Documents in a collection changed after `since` (a time in ms), oldest first.
export async function changedSince(coll, since) {
  const rows = await call('POST', `${base}:runQuery`, {
    structuredQuery: {
      from: [{ collectionId: coll }],
      where: { fieldFilter: { field: { fieldPath: 'ts' }, op: 'GREATER_THAN', value: { timestampValue: new Date(since || 0).toISOString() } } },
      orderBy: [{ field: { fieldPath: 'ts' }, direction: 'ASCENDING' }],
      limit: 300
    }
  });
  return (rows || []).filter((r) => r.document).map((r) => ({ id: idOf(r.document.name), ...decAll(r.document.fields) }));
}

/* ---------- writes ----------
   Every write also bumps state/meta.rev, so other phones can check one small thing to see if anything changed. */
const bump = () => ({ transform: { document: `${base}/state/meta`, fieldTransforms: [{ fieldPath: 'rev', increment: { integerValue: '1' } }] } });

// Set some fields on a document, leaving the others alone. Keys may be dotted paths ("2026-12-18.Emmett").
export function setFields(path, fields, stamp = false) {
  const flat = {};
  const mask = [];
  for (const [k, v] of Object.entries(fields)) {
    mask.push(quote(k));
    const parts = k.split('.');
    let o = flat;
    parts.slice(0, -1).forEach((p) => { o = o[p] = o[p] || {}; });
    o[parts[parts.length - 1]] = v;
  }
  const write = { update: { name: `${base}/${path}`, fields: encAll(flat) }, updateMask: { fieldPaths: mask } };
  if (stamp) write.updateTransforms = [{ fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }];
  return { writes: [write, bump()] };
}
export function removeFields(path, keys) {
  return { writes: [{ update: { name: `${base}/${path}`, fields: {} }, updateMask: { fieldPaths: keys.map(quote) } }, bump()] };
}
export async function commit(op) {
  return call('POST', `${root}:commit`, op);
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
