// Copies the morning plan times into the family database, so the reminder sender knows when to send.
// Run after changing mornings in trip.json: node tools/push-schedule.mjs <trip.json> <trip-id file>
import { readFile } from 'node:fs/promises';

const [tripFile, idFile] = process.argv.slice(2);
const trip = JSON.parse(await readFile(tripFile, 'utf8'));
const tripId = (await readFile(idFile, 'utf8')).trim();
const { apiKey, projectId } = trip.firebase;
// Hours ahead of UTC on each morning: Sydney is on summer time (+11) in December, Japan is +9.
const offsetFor = (date) => (date <= '2026-12-10' ? 11 : 9);

const auth = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true })
})).json();
const s = (v) => ({ stringValue: v });
const mornings = trip.mornings.map((m) => ({ mapValue: { fields: {
  date: s(m.date), offset: { integerValue: String(offsetFor(m.date)) },
  times: { arrayValue: { values: m.times.map((t) => ({ mapValue: { fields: { time: s(t.time), title: s(t.title), detail: s(t.detail || '') } } })) } }
} } }));
const name = `projects/${projectId}/databases/(default)/documents/trips/${tripId}/state/schedule`;
const res = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${auth.idToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { start: s(trip.start), end: s(trip.end), mornings: { arrayValue: { values: mornings } } } })
});
console.log(res.ok ? `Saved ${trip.mornings.length} mornings` : `Failed ${res.status} ${await res.text()}`);
