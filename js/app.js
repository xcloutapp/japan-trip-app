import * as I from './icons.js';
import { unlock, savedCode, forgetCode } from './lock.js';

const app = document.getElementById('app');
let T = null; // the trip, once unlocked

/* ---------- small helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (iso) => { const d = parse(iso); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const dayNum = (iso) => parse(iso).getDate();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

// "?today=2026-12-18" lets us preview what the app looks like on a trip day.
function today() {
  const q = new URLSearchParams(location.search).get('today');
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : iso(new Date());
}

const allBookings = () => T.journeys.flatMap((j) => (j.bookings || []).map((b) => ({ ...b, journey: j })));
const toBook = () => allBookings().filter((b) => b.status !== 'booked');

function status(j) {
  const b = j.bookings || [];
  if (b.some((x) => x.status !== 'booked')) return 'book';
  if (j.booked || b.length) return 'booked';
  if (j.tapOn) return 'tap';
  return '';
}
const hotelFor = (date) => T.hotels.find((h) => h.checkIn <= date && date < h.checkOut);

/* ---------- shared pieces ---------- */
function bagBadge(bags) {
  if (bags === 'big') return `<span class="bag-badge bag-big">${I.suitcase()}${I.backpack()} Suitcases and backpacks</span>`;
  if (bags === 'small') return `<span class="bag-badge bag-small">${I.backpack()} Backpacks only</span>`;
  return `<span class="bag-badge bag-none">Day bags only</span>`;
}
function statusBadge(j) {
  const s = status(j);
  if (s === 'book') return '<span class="status st-book">Book now</span>';
  if (s === 'booked') return '<span class="status st-booked">Booked</span>';
  if (s === 'tap') return '<span class="status st-tap">Tap on with Suica</span>';
  return '';
}
function journeyCard(j) {
  return `<a class="card journey card-link" href="#/journey/${j.id}" style="display:flex">
    ${j.photo ? `<img class="photo" src="${j.photo}" alt="" loading="lazy">` : ''}
    <div class="row">
      ${I.kindTile(j.kind)}
      <div class="grow">
        <p class="eyebrow">${fmt(j.date)}</p>
        <p class="title" style="margin-top:3px">${esc(j.title)}</p>
        <p class="sub">${esc(j.sub)}</p>
      </div>
    </div>
    <div class="badges">${bagBadge(j.bags)}${statusBadge(j)}</div>
  </a>`;
}
const header = (title, lead, color, backTo = '#/home', backLabel = 'Home', dark = false) => `
  <header class="bar${dark ? ' dark-text' : ''}" style="background:${color}">
    <a class="back" href="${backTo}">${I.back()} ${backLabel}</a>
    <h1>${title}</h1>
    ${lead ? `<p class="lead">${lead}</p>` : ''}
  </header>`;

/* ---------- screens ---------- */
function home() {
  const t = today();
  const before = t < T.start;
  const after = t > T.end;
  const during = !before && !after;
  const left = daysBetween(t, T.start);
  const next = T.journeys.find((j) => j.date >= t);
  const todo = toBook();

  let heroBottom;
  if (before) heroBottom = `<div class="count"><b>${left}</b><span>${left === 1 ? 'day' : 'days'} to go!</span></div>`;
  else if (during) heroBottom = `<div class="count"><b>Day ${daysBetween(T.start, t) + 1}</b><span>of ${daysBetween(T.start, T.end) + 1} · ${fmt(t)}</span></div>`;
  else heroBottom = `<div class="count"><span>Welcome home! What a trip.</span></div>`;

  const nextCard = next ? `<a class="card lift pad row float-card" href="#/journey/${next.id}">
      ${I.kindTile(next.kind)}
      <div class="grow">
        <p class="eyebrow">${next.date === t ? 'Today' : 'Next up'} · ${fmt(next.date)}</p>
        <p class="title" style="margin-top:4px;font-size:19px">${esc(next.title)}</p>
        <p class="sub">${esc(next.sub)}</p>
      </div>
      <span style="color:var(--ink)">${I.chevron()}</span>
    </a>` : '<div class="float-card"></div>';

  let todayBlock = '';
  if (during) {
    const tonight = hotelFor(t);
    const todays = T.journeys.filter((j) => j.date === t && j.id !== (next && next.id));
    const places = T.places.filter((p) => p.date === t);
    todayBlock = `
      ${tonight ? `<div class="section"><p class="section-title">Tonight we sleep at</p>
        <a class="card card-link tonight" href="#/hotels">${I.hotel(40)}<span class="grow"><span class="title" style="display:block">${esc(tonight.short)}</span><span class="sub" style="display:block">${esc(tonight.city)}</span></span>${I.chevron()}</a></div>` : ''}
      ${todays.length ? `<div class="section"><p class="section-title">Also today</p><div class="stack">${todays.map(journeyCard).join('')}</div></div>` : ''}
      ${places.length ? `<div class="section"><p class="section-title">Today's big things</p><div class="stack">${places.map(placeCard).join('')}</div></div>` : ''}`;
  }

  const placeImg = (T.places.find((p) => p.date >= t) || T.places[0]).img;
  return `<div class="screen">
    <header class="hero">
      <div class="sun"></div>
      <p class="who">${esc(T.families)}</p>
      <h1>${esc(T.title)}</h1>
      ${heroBottom}
    </header>
    ${nextCard}
    ${todayBlock}
    <div class="tiles">
      <a class="big-tile" href="#/trip" style="background:var(--blue);color:#FFFFFF">${I.bulletTrain(64)}<span>Getting around</span></a>
      <a class="big-tile" href="#/bags" style="background:var(--orange)">${I.bigBag(44)}<span>Our bags</span></a>
      <a class="big-tile" href="#/hotels" style="background:#FFD6E4">${I.hotel(44)}<span>Hotels</span></a>
      <a class="big-tile" href="#/tickets" style="background:#FFE58A">${I.ticket(44)}<span>Tickets</span></a>
      <a class="wide-tile" href="#/places"><img src="${placeImg}" alt=""><span>Places and big days</span></a>
    </div>
    ${todo.length ? `<div class="section">
      <p class="section-title">Still to book</p>
      <a class="card card-link" href="#/tickets">
        <span class="num-badge">${todo.length}</span>
        <span class="grow" style="font-size:15px">${esc(summariseTodo(todo))}</span>
        ${I.chevron()}
      </a></div>` : ''}
    <p class="small-print" style="margin-top:24px">Trip details updated ${fmt(T.updated)}</p>
    <div class="end-space"></div>
  </div>`;
}

function summariseTodo(todo) {
  const n = { parking: 0, bullet: 0, bus: 0, van: 0 };
  todo.forEach((b) => {
    if (b.id === 'p7') n.parking++;
    else if (b.id.startsWith('nozomi')) n.bullet++;
    else if (b.id.startsWith('bus')) n.bus++;
    else n.van++;
  });
  const p = [];
  if (n.parking) p.push('Parking');
  if (n.bullet) p.push(`${n.bullet} bullet train${n.bullet > 1 ? 's' : ''}`);
  if (n.bus) p.push(`${n.bus} bus${n.bus > 1 ? 'es' : ''}`);
  if (n.van) p.push(`${n.van} airport van${n.van > 1 ? 's' : ''}`);
  return p.join(', ');
}

const FILTERS = [
  { id: 'all', label: 'All', kinds: null },
  { id: 'bullet', label: 'Bullet trains', kinds: ['bullet'] },
  { id: 'road', label: 'Cars and vans', kinds: ['car', 'van'] },
  { id: 'metro', label: 'Trains', kinds: ['metro'] },
  { id: 'bus', label: 'Bus', kinds: ['bus'] },
  { id: 'plane', label: 'Planes', kinds: ['plane'] }
];
let tripFilter = 'all';

function trip() {
  const f = FILTERS.find((x) => x.id === tripFilter) || FILTERS[0];
  const list = T.journeys.filter((j) => !f.kinds || f.kinds.includes(j.kind));
  const t = today();
  let lastDate = '';
  const cards = list.map((j) => {
    const label = j.date !== lastDate ? `<p class="day-label">${fmt(j.date)}${j.date === t ? '<span class="today-pill">Today</span>' : ''}</p>` : '';
    lastDate = j.date;
    return label + journeyCard(j);
  }).join('');
  const todo = T.journeys.filter((j) => status(j) === 'book').length;
  return `<div class="screen">
    ${header('Getting around', `${T.journeys.length} journeys · ${todo} still to book`, 'var(--blue)')}
    <div class="chips" role="group" aria-label="Show">
      ${FILTERS.map((x) => `<button type="button" class="chip" data-filter="${x.id}" aria-pressed="${x.id === f.id}">${x.label}</button>`).join('')}
    </div>
    <div class="section stack" style="padding-top:6px">${cards || '<p class="empty">Nothing here.</p>'}</div>
    <div class="end-space"></div>
  </div>`;
}

function journey(id) {
  const j = T.journeys.find((x) => x.id === id);
  if (!j) return notFound();
  const k = I.KIND[j.kind];
  const t = today();
  const bookings = j.bookings || [];
  const todo = bookings.filter((b) => b.status !== 'booked');
  const tonight = hotelFor(j.date);
  const isLastOfDay = T.journeys.filter((x) => x.date === j.date).pop() === j;

  const head = j.photo
    ? `<div class="photo-head"><img src="${j.photo}" alt=""><a class="back" href="#/trip">${I.back()} Trip</a></div>`
    : `<div class="plain-head" style="background:${k.tint}"><a class="back" href="#/trip">${I.back()} Trip</a><div style="display:flex;justify-content:flex-end;margin-top:-30px">${I.kindTile(j.kind, 96)}</div></div>`;

  let bagNote;
  if (j.bags === 'big') bagNote = `<div class="note note-orange"><span style="display:flex;flex-shrink:0">${I.suitcase(44)}${I.backpack(40)}</span><div><p class="title">Suitcases and backpacks</p><p>Everyone brings their big suitcase and their backpack.</p></div></div>`;
  else if (j.bags === 'small') bagNote = `<div class="note note-green"><span style="flex-shrink:0">${I.backpack(48)}</span><div><p class="title">Backpacks only today</p><p>${esc(j.bagNote || 'Just your backpack today.')}</p></div></div>`;
  else bagNote = `<div class="note note-blue"><div><p class="title">Day bags only</p><p>Leave the big bags at the hotel. Bring water, a jacket and your Suica.</p></div></div>`;

  const steps = j.steps.map((s, i) => {
    const b = s.booking && bookings.find((x) => x.id === s.booking);
    return `<div class="step">
      <div class="rail">${I.kindTile(s.kind, 60, true)}${i < j.steps.length - 1 ? '<div class="line"></div>' : ''}</div>
      <div class="body">
        <p class="time">${esc(s.time)}</p>
        <p class="title" style="margin-top:2px">${esc(s.title)}</p>
        <p class="detail">${esc(s.detail)}</p>
        ${b ? `<div class="ticket-slot">${I.qr(40)}<p>${b.status === 'booked' ? 'Booked. Your ticket details go in the Tickets tab.' : 'Not booked yet. The booking number and QR code will show here once it is.'}</p></div>` : ''}
      </div>
    </div>`;
  }).join('');

  const helpers = todo.map((b) => `<div class="card helper">
      <p class="eyebrow" style="color:var(--red)">Book it</p>
      <h3>${esc(b.label)}</h3>
      <p class="sub" style="margin-top:6px">Choose exactly this:</p>
      <ol>${b.choose.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
      ${b.tip ? `<p class="tip">${esc(b.tip)}</p>` : ''}
      <a class="btn" href="${esc(b.url)}" target="_blank" rel="noopener">Open ${esc(b.site)} ${I.external()}</a>
    </div>`).join('');

  return `<div class="screen">
    ${head}
    <div class="card lift overlap">
      <p class="eyebrow">${fmt(j.date)}${j.bigDay ? ' · Big travel day' : ''}${j.date === t ? ' · Today' : ''}</p>
      <h1>${esc(j.title)}</h1>
      <p class="sub" style="font-size:15px;margin-top:6px">${esc(j.sub)}</p>
      <div class="badges" style="margin-top:12px">${statusBadge(j)}</div>
    </div>
    ${bagNote}
    ${j.tip ? `<div class="note note-yellow"><div><p class="title">Tip</p><p>${esc(j.tip)}</p></div></div>` : ''}
    <div class="steps">${steps}</div>
    ${helpers ? `<div style="padding-top:4px">${helpers}</div>` : ''}
    ${todo.length ? '<p class="small-print">Times are examples until the tickets are booked.</p>' : ''}
    ${tonight && isLastOfDay ? `<div class="section"><a class="card card-link" href="#/hotels">${I.hotel(40)}<span class="grow"><span class="eyebrow" style="display:block">Tonight</span><span class="title" style="display:block">${esc(tonight.short)}</span></span>${I.chevron()}</a></div>` : ''}
    <div class="end-space"></div>
  </div>`;
}

function bags() {
  const fw = T.bags.forward;
  const pics = (w) => w === 'us' ? `${I.suitcase(34)}<span style="margin-left:-10px">${I.backpack(30)}</span>` : w === 'truck' ? I.truck(34) : I.backpack(34);
  return `<div class="screen">
    ${header('Our bags', 'Where are the big suitcases each day?', 'var(--orange)', '#/home', 'Home', true)}
    <div class="legend">
      <div><span class="pics">${I.suitcase(40)}<span style="margin-left:-8px">${I.backpack(34)}</span></span><p>Suitcases and backpacks</p></div>
      <div><span class="pics">${I.truck(40)}</span><p>On the truck</p></div>
      <div><span class="pics">${I.backpack(40)}</span><p>Backpacks only</p></div>
    </div>
    <div class="forward">
      <p class="eyebrow">${fmt(fw.date)} · Send the big bags</p>
      <p class="title">Hand them to the front desk at ${esc(fw.from)} before you leave</p>
      <p>They go to ${esc(fw.to)} and wait for us there. ${esc(fw.cost)}.</p>
      <div class="track">Tracking number: <b>${fw.tracking ? esc(fw.tracking) : 'added once they are sent'}</b></div>
    </div>
    <div class="note note-green">${I.backpack(44)}<div><p class="title">Pack your backpack on 16 Dec</p><p>${esc(T.bags.packTip.replace(/^On 16 Dec, p/, 'P'))}</p></div></div>
    <div class="section stack tight">
      ${T.bags.days.map((d) => `<div class="bag-day"><div class="when">${esc(d.dates)}</div><div class="pics">${pics(d.where)}</div><p>${esc(d.text)}</p></div>`).join('')}
    </div>
    <div class="end-space"></div>
  </div>`;
}

function hotels() {
  const t = today();
  const nights = T.hotels.reduce((n, h) => n + daysBetween(h.checkIn, h.checkOut), 0);
  return `<div class="screen" style="background:#FFF4F7">
    ${header('Our hotels', `${T.hotels.length} hotels · ${nights} nights`, 'var(--pink)')}
    <div class="section stack" style="gap:16px">
      ${T.hotels.map((h) => {
        const n = daysBetween(h.checkIn, h.checkOut);
        const now = h.checkIn <= t && t < h.checkOut;
        return `<div class="card photo-card${now ? ' tonight' : ''}">
          <img src="${h.img}" alt="${esc(h.name)}" loading="lazy">
          <div class="pad stack tight">
            <div class="row" style="gap:10px"><span class="nights">${n} night${n > 1 ? 's' : ''}</span><span class="title" style="font-size:17px">${fmt(h.checkIn)} to ${fmt(h.checkOut)}</span></div>
            ${now ? '<p class="eyebrow" style="color:var(--pink)">We are here tonight</p>' : ''}
            <p class="sub" style="margin:0">${esc(h.note)}</p>
            <div class="row" style="gap:6px;font-size:13px;font-weight:600">${h.bags === 'big' ? I.suitcase() + I.backpack() + '<span>Suitcases and backpacks</span>' : I.backpack() + '<span>Backpacks only</span>'}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="end-space"></div>
  </div>`;
}

function placeCard(p) {
  return `<div class="card photo-card place">
    <img src="${p.img}" alt="${esc(p.name)}" loading="lazy">
    <div class="pad row" style="gap:12px;padding:12px 16px 14px">
      <div class="date-block"><b>${dayNum(p.date)}</b><small>DEC</small></div>
      <p class="sub" style="margin:0">${esc(p.note)}</p>
    </div>
  </div>`;
}

function places() {
  return `<div class="screen">
    ${header('Places and big days', `${T.places.length} things we're excited about`, 'var(--ink)')}
    <div class="section stack" style="gap:14px">${T.places.map(placeCard).join('')}</div>
    <div class="end-space"></div>
  </div>`;
}

function tickets() {
  const todo = toBook();
  const nights = T.hotels.reduce((n, h) => n + daysBetween(h.checkIn, h.checkOut), 0);
  const booked = [...T.tickets];
  return `<div class="screen">
    ${header('Tickets', 'Everything booked, and what is still to book', '#FFC93C', '#/home', 'Home', true)}
    ${todo.length ? `<div class="section"><p class="section-title">Still to book (${todo.length})</p><div class="stack">
      ${todo.map((b) => `<a class="card card-link" href="#/journey/${b.journey.id}">${I.kindTile(b.journey.kind, 56)}<span class="grow"><span class="eyebrow" style="display:block">${fmt(b.journey.date)}</span><span class="title" style="display:block;font-size:17px;margin-top:2px">${esc(b.label)}</span></span><span class="status st-book">Book now</span></a>`).join('')}
    </div></div>` : ''}
    <div class="section"><p class="section-title">Booked</p><div class="stack">
      ${booked.map((k) => `<div class="card tk">${I.kindTile(k.kind, 56)}<div class="grow"><p class="eyebrow">${fmt(k.date)}</p><p class="title" style="margin-top:2px">${esc(k.title)}</p><p class="sub">${esc(k.detail)}</p>${k.print ? `<span class="print-flag">${I.printer()} Print before we go</span>` : ''}</div></div>`).join('')}
      <a class="card tk card-link" href="#/hotels" style="align-items:center">${I.hotel(48)}<span class="grow"><span class="title" style="display:block">All ${T.hotels.length} hotels</span><span class="sub" style="display:block">${nights} nights, all booked for 8 people.</span></span>${I.chevron()}</a>
    </div></div>
    <div class="note note-blue" style="margin-top:16px">${I.qr(40)}<div><p class="title">Coming soon</p><p>QR codes, booking numbers and screenshots will be saved here, so they open even with no internet.</p></div></div>
    <div class="end-space"></div>
  </div>`;
}

function notFound() {
  return `<div class="screen">${header('Not found', 'That page is not in the trip.', 'var(--ink)')}</div>`;
}

/* ---------- lock screen ---------- */
function lockScreen(error) {
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  app.innerHTML = `<form class="lock" id="lockform">
    <div class="sun"></div>
    <h1>Japan 2026</h1>
    <p>Our family trip app. Type the family code to open it. You only need to do this once on each phone.</p>
    ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
    <div><label for="code">Family code</label>
    <input id="code" name="code" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" required></div>
    <button class="btn" type="submit">Open the trip</button>
    ${standalone ? '' : `<div class="install"><b>Put it on your Home Screen:</b> in Safari, tap the Share button (the square with an arrow), then <b>Add to Home Screen</b>. Then open it from the new icon and type the code once more.</div>`}
  </form>`;
  document.getElementById('lockform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = 'Opening…';
    btn.disabled = true;
    try {
      T = await unlock(document.getElementById('code').value, true);
      start();
    } catch (err) {
      lockScreen(err.message === 'offline' ? 'No internet yet. Connect to wifi the first time you open the app.' : 'That code did not work. Check it and try again.');
    }
  });
}

/* ---------- router ---------- */
const TABS = [
  { id: 'home', label: 'Home', icon: I.tab.home, match: ['home', 'hotels', 'places'] },
  { id: 'trip', label: 'Trip', icon: I.tab.trip, match: ['trip', 'journey'] },
  { id: 'bags', label: 'Bags', icon: I.tab.bags, match: ['bags'] },
  { id: 'tickets', label: 'Tickets', icon: I.tab.tickets, match: ['tickets'] }
];

function render() {
  const [, name = 'home', arg] = (location.hash || '#/home').split('/');
  const screens = { home, trip, bags, hotels, places, tickets, journey: () => journey(arg) };
  const view = (screens[name] || notFound)();
  const current = TABS.find((t) => t.match.includes(name));
  app.innerHTML = view + `<div class="tabbar"><nav aria-label="Main">${TABS.map((t) => `<a href="#/${t.id}"${current === t ? ' aria-current="page"' : ''}>${t.icon}${t.label}</a>`).join('')}</nav></div>`;
  app.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { tripFilter = b.dataset.filter; render(); }));
  document.title = name === 'home' ? 'Japan 2026' : `${(app.querySelector('h1') || {}).textContent || 'Japan 2026'} · Japan 2026`;
}

function start() {
  if (!started) {
    window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
    started = true;
  }
  render();
}
let started = false;

/* ---------- boot ---------- */
(async function boot() {
  const code = savedCode();
  if (!code) return lockScreen();
  try {
    T = await unlock(code, false);
    start();
  } catch (err) {
    if (err.message !== 'offline') forgetCode();
    lockScreen(err.message === 'offline' ? 'No internet yet. Connect to wifi the first time you open the app.' : 'The family code has changed. Type the new one.');
  }
})();

/* ---------- offline + updates ---------- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
      });
    });
  }).catch(() => {});
}
function showUpdate() {
  if (document.querySelector('.update-toast')) return;
  const el = document.createElement('div');
  el.className = 'update-toast';
  el.innerHTML = '<span>The trip has been updated.</span><button type="button">Show me</button>';
  el.querySelector('button').addEventListener('click', () => location.reload());
  document.body.appendChild(el);
}
