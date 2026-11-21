// Things the family shares between phones: "I'm ready" ticks, parent changes to morning times,
// messages, Shout (who paid), the photo diary and dinner votes.
// Each phone keeps a copy so the app works with no internet. Changes made offline wait in an
// "outbox" and are sent when the phone is back online. Every 15 seconds (while the app is open)
// the phone checks one small counter online to see if anyone else changed something.
import * as C from './cloud.js';
import { kvGet, kvSet } from './store.js';

const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or private mode */ } };

const EMPTY = () => ({ rev: -1, ready: {}, times: {}, votes: {}, messages: {}, shouts: {}, photos: {}, since: {} });
let st = EMPTY();
let outbox = [];
let state = 'off'; // off | connecting | ok | offline | error
let listeners = [];
let timer = null;

const changed = () => listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });
const persist = () => kvSet('cloud', st);
export const onChange = (f) => { listeners.push(f); };
export const status = () => state;
export const waiting = () => outbox.length;

/* ---------- who is using this phone ---------- */
export const me = () => get('me', null);
export function setMe(name) {
  put('me', name);
  const p = get('push', null);
  if (p) savePush(p.id, p.sub); // so message alerts skip your own messages
}

/* ---------- notifications ---------- */
export async function pushKey() {
  if (!C.ready()) return null;
  const d = await C.getDoc('state/push').catch(() => null);
  return d ? d.publicKey : null;
}
export function savePush(id, sub) {
  put('push', { id, sub });
  send(C.setFields(`push/${id}`, { sub, who: me() || 'Someone' }));
}
export const pushSaved = () => !!get('push', null);

/* ---------- parent mode (this phone only) ---------- */
export const parent = () => get('parent', null);
export const setParent = (name) => put('parent', name);
export const leaveParent = () => { try { localStorage.removeItem('parent'); } catch { /* ignore */ } };
export async function checkPin(trip, pin) {
  const data = new TextEncoder().encode(trip.parentPin.salt + String(pin).trim());
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hash === trip.parentPin.hash;
}

/* ---------- ready ticks ---------- */
export const ready = (date) => st.ready[date] || {};
export function toggleReady(date, name) {
  const v = !ready(date)[name];
  st.ready[date] = { ...ready(date), [name]: v };
  send(C.setFields('state/ready', { [`${date}.${name}`]: v }));
  return st.ready[date];
}

/* ---------- morning times ---------- */
export const timesFor = (morning) => st.times[morning.date] || morning.times;
export const changedTimes = (date) => !!st.times[date];
export function saveTimes(date, times) {
  st.times[date] = times;
  send(C.setFields('state/times', { [date]: JSON.stringify(times) }));
}
export function resetTimes(date) {
  delete st.times[date];
  send(C.removeFields('state/times', [date]));
}

/* ---------- dinner votes ---------- */
export const votes = (date) => st.votes[date] || {};
// kind is 'food' (what we feel like) or 'place' (where to go). Tapping your choice again takes the vote back.
export function vote(date, name, kind, choice) {
  const mine = { ...(votes(date)[name] || {}) };
  const v = mine[kind] === choice ? '' : choice;
  mine[kind] = v;
  st.votes[date] = { ...votes(date), [name]: mine };
  send(C.setFields('state/votes', { [`${date}.${name}.${kind}`]: v }));
}

/* ---------- lists: messages, shouts, diary photos ---------- */
const live = (coll) => Object.values(st[coll]).filter((x) => !x.deleted).sort((a, b) => a.at - b.at);
function addTo(coll, item) {
  const id = C.newId();
  const row = { ...item, at: Date.now() };
  st[coll][id] = { id, ...row };
  send(C.setFields(`${coll}/${id}`, row, true));
  return id;
}
function hide(coll, id) {
  if (st[coll][id]) st[coll][id].deleted = true;
  send(C.setFields(`${coll}/${id}`, { deleted: true }, true));
}

export const messages = () => live('messages');
export const sendMessage = (text) => addTo('messages', { from: me() || 'Someone', text });

export const shouts = () => live('shouts');
export const addShout = (s) => addTo('shouts', s);
export const removeShout = (id) => hide('shouts', id);

export const photos = () => live('photos');
export async function addDiaryPhoto({ thumb, full, caption, date }) {
  const id = C.newId();
  await kvSet(`full:${id}`, full);
  const row = { by: me() || 'Someone', caption, date, thumb, at: Date.now() };
  st.photos[id] = { id, ...row };
  send(C.setFields(`photoFull/${id}`, { data: full }));
  send(C.setFields(`photos/${id}`, row, true));
  return id;
}
export const removeDiaryPhoto = (id) => hide('photos', id);
export async function fullPhoto(id) {
  const have = await kvGet(`full:${id}`);
  if (have) return have;
  if (!C.ready()) return null;
  const d = await C.getDoc(`photoFull/${id}`).catch(() => null);
  if (d && d.data) kvSet(`full:${id}`, d.data);
  return d ? d.data : null;
}

/* ---------- sending and checking ---------- */
function send(op) {
  outbox.push(op);
  kvSet('outbox', outbox);
  persist();
  changed();
  if (C.ready()) sync();
}

let busy = null;
export function sync() {
  if (!C.ready()) return Promise.resolve();
  if (busy) return busy.then(() => (outbox.length ? sync() : undefined));
  busy = run().finally(() => { busy = null; });
  return busy;
}

async function run() {
  const before = state;
  try {
    while (outbox.length) {
      try {
        await C.commit(outbox[0]);
      } catch (e) {
        if (!e.status || e.status >= 500 || e.status === 429) throw e;
        console.warn('Dropped a change the database would not take', e.status);
      }
      outbox.shift();
      kvSet('outbox', outbox);
    }
    if (await pull()) { persist(); changed(); }
    state = 'ok';
  } catch (e) {
    state = !navigator.onLine || !e.status ? 'offline' : 'error';
    if (e.status) console.warn('Family sharing problem', e.status);
  }
  if (state !== before) changed();
}

async function pull() {
  const meta = await C.getDoc('state/meta');
  const rev = meta ? meta.rev : 0;
  if (rev === st.rev) return false;
  const [r, t, v] = await Promise.all(['ready', 'times', 'votes'].map((d) => C.getDoc(`state/${d}`)));
  st.ready = r || {};
  st.times = Object.fromEntries(Object.entries(t || {}).map(([k, s]) => { try { return [k, JSON.parse(s)]; } catch { return [k, null]; } }).filter(([, x]) => x));
  st.votes = v || {};
  // Look back a minute to catch anything saved at the same moment as the last check.
  const colls = ['messages', 'shouts', 'photos'];
  const got = await Promise.all(colls.map((c) => C.changedSince(c, Math.max(0, (st.since[c] || 0) - 60000))));
  colls.forEach((coll, i) => got[i].forEach((x) => { st[coll][x.id] = x; st.since[coll] = Math.max(st.since[coll] || 0, x.ts || 0); }));
  st.rev = rev;
  return true;
}

// Called once the trip is unlocked.
export async function start(trip) {
  const saved = await kvGet('cloud');
  if (saved && saved.since) st = { ...EMPTY(), ...saved };
  outbox = (await kvGet('outbox')) || [];
  if (!C.init(trip)) return;
  state = navigator.onLine ? 'connecting' : 'offline';
  const tick = () => { if (document.visibilityState === 'visible') sync(); };
  if (!timer) {
    timer = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
  }
  sync();
}
