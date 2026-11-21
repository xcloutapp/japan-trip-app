// Things the family changes in the app: "I'm ready" ticks, parent changes to morning times,
// and parent mode. For now these are kept on this phone. The family sharing update (Firebase)
// will swap this file so every phone sees the same ticks and times.
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or private mode */ } };

export const ready = (date) => get(`ready:${date}`, {});
export function toggleReady(date, name) {
  const r = ready(date);
  r[name] = !r[name];
  put(`ready:${date}`, r);
  return r;
}

export const timesFor = (morning) => get(`times:${morning.date}`, null) || morning.times;
export const changedTimes = (date) => !!get(`times:${date}`, null);
export const saveTimes = (date, times) => put(`times:${date}`, times);
export const resetTimes = (date) => { try { localStorage.removeItem(`times:${date}`); } catch { /* ignore */ } };

export const parent = () => get('parent', null);
export const setParent = (name) => put('parent', name);
export const leaveParent = () => { try { localStorage.removeItem('parent'); } catch { /* ignore */ } };

export async function checkPin(trip, pin) {
  const data = new TextEncoder().encode(trip.parentPin.salt + String(pin).trim());
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hash === trip.parentPin.hash;
}
