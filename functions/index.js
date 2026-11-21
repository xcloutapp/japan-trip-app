// Sends the family's phone notifications (runs on Google's servers in Tokyo):
//  - each morning plan time, 10 minutes before (for example "5:50am: Backpacks packed")
//  - new family messages, to everyone except the person who wrote it
// Phones sign up for notifications in the app; their sign-ups are saved under trips/<trip>/push.
// The morning plan comes from trips/<trip>/state/schedule, with any parent changes from state/times.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: 'asia-northeast1', maxInstances: 2, memory: '256MiB' });

const AHEAD = 10 * 60 * 1000;

// The keys that prove notifications come from us. Made once and kept where phones can't read them.
async function setup() {
  const ref = db.doc('server/vapid');
  let k = (await ref.get()).data();
  if (!k) { k = webpush.generateVAPIDKeys(); await ref.set(k); }
  webpush.setVapidDetails('https://xcloutapp.github.io/japan-trip-app/', k.publicKey, k.privateKey);
  return k;
}

// "5:50am" on "2026-12-18" at UTC+9 -> milliseconds.
function toMs(date, time, offset) {
  const t = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(time).trim());
  if (!t) return NaN;
  let h = Number(t[1]) % 12;
  if (t[3].toLowerCase() === 'pm') h += 12;
  const [y, mo, d] = date.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, h, Number(t[2])) - offset * 3600 * 1000;
}

async function sendAll(trip, note, skipWho) {
  const subs = await trip.collection('push').get();
  const body = JSON.stringify(note);
  await Promise.all(subs.docs.map(async (doc) => {
    const p = doc.data();
    if (skipWho && p.who === skipWho) return;
    try {
      await webpush.sendNotification(JSON.parse(p.sub), body, { TTL: 900, urgency: 'high' });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await doc.ref.delete(); // that phone turned them off
      else console.warn('push failed', e.statusCode || e.message);
    }
  }));
}

exports.reminders = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Asia/Tokyo' }, async () => {
  const k = await setup();
  const now = Date.now();
  for (const trip of await db.collection('trips').listDocuments()) {
    const state = trip.collection('state');
    const push = await state.doc('push').get();
    if (!push.exists || push.data().publicKey !== k.publicKey) await state.doc('push').set({ publicKey: k.publicKey });
    const sched = (await state.doc('schedule').get()).data();
    if (!sched || now < toMs(sched.start, '12:00am', 14) || now > toMs(sched.end, '11:59pm', -12)) continue;
    const changes = (await state.doc('times').get()).data() || {};
    const sentRef = state.doc('sent');
    const sent = (await sentRef.get()).data() || {};
    const due = [];
    for (const m of sched.mornings) {
      let times = m.times;
      if (changes[m.date]) { try { times = JSON.parse(changes[m.date]); } catch { /* keep the plan */ } }
      for (const t of times) {
        const at = toMs(m.date, t.time, m.offset);
        const key = `${m.date} ${t.time} ${t.title}`.replace(/[.\/]/g, ' ');
        if (now >= at - AHEAD && now < at && !sent[key]) due.push({ key, t, date: m.date });
      }
    }
    for (const d of due) {
      await sendAll(trip, { title: `${d.t.time}: ${d.t.title}`, body: d.t.detail ? `In 10 minutes. ${d.t.detail}` : 'In 10 minutes.', url: `#/morning/${d.date}`, tag: d.key });
      await sentRef.set({ [d.key]: now }, { merge: true });
    }
  }
});

exports.newMessage = onDocumentCreated('trips/{trip}/messages/{id}', async (event) => {
  const m = event.data && event.data.data();
  if (!m || !m.text) return;
  await setup();
  const trip = db.collection('trips').doc(event.params.trip);
  const text = m.text.length > 140 ? `${m.text.slice(0, 137)}…` : m.text;
  await sendAll(trip, { title: `${m.from || 'Family'} says`, body: text, url: '#/chat', tag: 'chat' }, m.from);
});
