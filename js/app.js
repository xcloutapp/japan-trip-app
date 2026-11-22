import * as I from './icons.js';
import { unlock, savedCode, forgetCode, openFile } from './lock.js';
import { addPhoto, removePhoto, photosFor, shrink } from './store.js';
import * as S from './shared.js';
import * as Wx from './weather.js';
import { moneyScreen, wireMoney } from './money.js';
import { mapScreen, wireMap } from './map.js';

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
const header = (title, lead, color, dark = false) => `
  <header class="bar${dark ? ' dark-text' : ''}" style="background:${color}">
    <div class="back-space"></div>
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
        <a class="card card-link tonight" href="#/hotel/${tonight.id}">${I.hotel(40)}<span class="grow"><span class="title" style="display:block">${esc(tonight.short)}</span><span class="sub" style="display:block">${esc(tonight.city)}</span></span>${I.chevron()}</a></div>` : ''}
      ${todays.length ? `<div class="section"><p class="section-title">Also today</p><div class="stack">${todays.map(journeyCard).join('')}</div></div>` : ''}
      ${places.length ? `<div class="section"><p class="section-title">Today's big things</p><div class="stack">${places.map(placeCard).join('')}</div></div>` : ''}`;
  }

  const placeImg = (T.places.find((p) => p.date >= t) || T.places[0]).img;
  return `<div class="screen">
    <header class="hero">
      <div class="sun"></div>
      <a class="hero-gear" href="#/settings" aria-label="Settings">${I.gear(26)}</a>
      <p class="who">${esc(T.families)}</p>
      <h1>${esc(T.title)}</h1>
      ${heroBottom}
    </header>
    ${nextCard}
    ${homeMornings(t)}
    ${todayBlock}
    <div class="tiles">
      <a class="big-tile" href="#/trip" style="background:var(--blue);color:#FFFFFF">${I.bulletTrain(64)}<span>Getting around</span></a>
      <a class="big-tile" href="#/bags" style="background:var(--orange)">${I.bigBag(44)}<span>Our bags</span></a>
      <a class="big-tile" href="#/hotels" style="background:#FFD6E4">${I.hotel(44)}<span>Hotels</span></a>
      <a class="big-tile" href="#/tickets" style="background:#FFE58A">${I.ticket(44)}<span>Tickets</span></a>
      <a class="wide-tile" href="#/places"><img src="${placeImg}" alt=""><span>Places and big days</span></a>
      <a class="big-tile small" href="#/phrases" style="background:#D6F1F8"><span class="say" lang="ja">こんにちは</span><span>Phrases and translate</span></a>
    </div>
    ${familyTiles()}
    <div class="section">
      <a class="card card-link money-link" href="#/money"><span class="money-icon">¥</span><span class="grow"><span class="title" style="display:block">Money converter</span><span class="sub" style="display:block">Yen to Australian dollars, and back</span></span>${I.chevron()}</a>
      <a class="card card-link money-link" href="#/map" style="margin-top:10px"><span class="money-icon" style="background:#0E7FA0">🗾</span><span class="grow"><span class="title" style="display:block">Trip map</span><span class="sub" style="display:block">Where we are going, day by day</span></span>${I.chevron()}</a>
    </div>
    <div class="section">
      <p class="section-title">Find nearby</p>
      <div class="nearby">
        <a href="https://maps.apple.com/?q=7-Eleven" target="_blank" rel="noopener"><span class="seven">7</span>7-Eleven</a>
        <a href="https://maps.apple.com/?q=restaurants" target="_blank" rel="noopener"><span class="dot" style="background:var(--red)"></span>Food</a>
        <a href="https://maps.apple.com/?q=train%20station" target="_blank" rel="noopener"><span class="dot" style="background:var(--green)"></span>Station</a>
        <a href="https://maps.apple.com/?q=ATM" target="_blank" rel="noopener"><span class="dot" style="background:var(--blue)"></span>ATM</a>
      </div>
      <p class="sub" style="margin-top:6px">Opens Apple Maps near where you are. 7-Eleven ATMs take Australian cards.</p>
    </div>
    <div class="section">
      <a class="row section-link" href="#/weather"><span class="section-title grow" style="margin:0">${during ? 'Weather today and tomorrow' : 'Weather in Japan'}</span><span class="more">All days ${I.chevron(16)}</span></a>
      <div class="stack tight" data-weather="next" style="margin-top:10px"><p class="sub">Loading the weather…</p></div>
    </div>
    ${todo.length ? `<div class="section">
      <p class="section-title">Still to book</p>
      <a class="card card-link" href="#/tickets">
        <span class="num-badge">${todo.length}</span>
        <span class="grow" style="font-size:15px">${esc(summariseTodo(todo))}</span>
        ${I.chevron()}
      </a></div>` : ''}
    <div class="section"><div class="link-row" style="justify-content:center;margin:0"><a href="#/mornings">${I.clock(20)} Morning plans</a><a href="#/parent">${I.lock(18)} ${S.parent() ? `Parent mode (${esc(S.parent())})` : 'Parent mode'}</a><a href="#/settings">${I.gear(18)} Settings</a></div></div>
    <p class="small-print" style="margin-top:12px">Trip details updated ${fmt(T.updated)}</p>
    <div class="end-space"></div>
  </div>`;
}

function homeMornings(t) {
  const tom = iso(new Date(parse(t).getTime() + 86400000));
  const cards = [];
  const mt = morningFor(t);
  if (mt) cards.push(morningCard(mt, 'Today'));
  const mn = morningFor(tom);
  if (mn) cards.push(morningCard(mn, 'Tomorrow'));
  return cards.length ? `<div class="section stack tight">${cards.join('')}</div>` : '';
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

// Getting around: the journey cards under each date, as before. Tap a date to fold that day up or open it again.
let closedDays = new Set();
function trip() {
  const f = FILTERS.find((x) => x.id === tripFilter) || FILTERS[0];
  const list = T.journeys.filter((j) => !f.kinds || f.kinds.includes(j.kind));
  const t = today();
  const dates = [...new Set(list.map((j) => j.date))];
  const groups = dates.map((d) => {
    const js = list.filter((j) => j.date === d);
    const open = !closedDays.has(d);
    return `<div class="day-group${open ? ' open' : ''}">
      <button type="button" class="day-label day-toggle" data-day="${d}" aria-expanded="${open}">
        <span class="grow">${fmt(d)}${d === t ? '<span class="today-pill">Today</span>' : ''}${open ? '' : `<small>${js.length} journey${js.length > 1 ? 's' : ''}</small>`}</span>
        <span class="day-chev">${I.chevron(18)}</span>
      </button>
      ${open ? `<div class="stack">${js.map(journeyCard).join('')}</div>` : ''}
    </div>`;
  }).join('');
  const todo = T.journeys.filter((j) => status(j) === 'book').length;
  return `<div class="screen">
    ${header('Getting around', `${T.journeys.length} journeys · ${todo} still to book`, 'var(--blue)')}
    <div class="section" style="padding-bottom:0"><a class="card card-link money-link" href="#/map"><span class="money-icon" style="background:#0E7FA0">🗾</span><span class="grow"><span class="title" style="display:block">See the trip on a map</span><span class="sub" style="display:block">Hotels and routes, day by day</span></span>${I.chevron()}</a></div>
    <div class="day-tools"><button type="button" class="chip" data-act="open-all">Expand all</button><button type="button" class="chip" data-act="close-all">Collapse all</button></div>
    <div class="section stack" style="padding-top:6px">${groups || '<p class="empty">Nothing here.</p>'}</div>
    <div class="end-space"></div>
  </div>`;
}

// Step through the trip one journey at a time: buttons at the bottom, or swipe left and right.
function journeyNav(j) {
  const i = T.journeys.indexOf(j);
  const prev = T.journeys[i - 1];
  const next = T.journeys[i + 1];
  const btn = (x, dir) => x ? `<a class="jnav ${dir}" href="#/journey/${x.id}" data-swipe="${dir}">${dir === 'prev' ? I.back() : ''}<span class="grow"><small>${dir === 'prev' ? 'Before' : 'Next'} · ${esc(fmt(x.date))}</small><b>${esc(x.title)}</b></span>${dir === 'next' ? I.chevron(18) : ''}</a>` : '<span class="jnav empty"></span>';
  return `<div class="section jnav-row">${btn(prev, 'prev')}${btn(next, 'next')}</div>`;
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
    ? `<div class="photo-head"><img src="${j.photo}" alt=""></div>`
    : `<div class="plain-head" style="background:${k.tint}"><div style="display:flex;justify-content:flex-end">${I.kindTile(j.kind, 96)}</div></div>`;

  let bagNote;
  if (j.bags === 'big') bagNote = `<div class="note note-orange"><span style="display:flex;flex-shrink:0">${I.suitcase(44)}${I.backpack(40)}</span><div><p class="title">Suitcases and backpacks</p><p>Everyone brings their big suitcase and their backpack.</p></div></div>`;
  else if (j.bags === 'small') bagNote = `<div class="note note-green"><span style="flex-shrink:0">${I.backpack(48)}</span><div><p class="title">Backpacks only today</p><p>${esc(j.bagNote || 'Just your backpack today.')}</p></div></div>`;
  else bagNote = `<div class="note note-blue"><div><p class="title">Day bags only</p><p>Leave the big bags at the hotel. Bring water, a jacket and your Suica.</p></div></div>`;

  const steps = j.steps.map((s, i) => {
    const b = s.booking && bookings.find((x) => x.id === s.booking);
    const homeBar = s.back && !(j.steps[i - 1] || {}).back ? `<div class="home-bar">${I.hotel(28)} Getting back to the hotel</div>` : '';
    return `${homeBar}<div class="step">
      <div class="rail">${I.kindTile(s.kind, 60, true)}${i < j.steps.length - 1 ? '<div class="line"></div>' : ''}</div>
      <div class="body">
        <p class="time">${esc(s.time)}</p>
        <p class="title" style="margin-top:2px">${esc(s.title)}</p>
        <p class="detail">${esc(s.detail)}</p>
        ${b ? (b.status === 'booked' && b.ticket ? `<a class="ticket-slot" href="#/ticket/${b.ticket}">${I.qr(40)}<p><b>Booked.</b> Tap for the booking number and QR code.</p></a>` : `<div class="ticket-slot">${I.qr(40)}<p>Not booked yet. The booking number and QR code will show here once it is.</p></div>`) : ''}
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
    ${morningFor(j.date) && T.journeys.find((x) => x.date === j.date) === j ? `<div style="margin:12px 16px 0">${morningCard(morningFor(j.date), 'Before we go')}</div>` : ''}
    ${bagNote}
    ${j.tip ? `<div class="note note-yellow"><div><p class="title">Tip</p><p>${esc(j.tip)}</p></div></div>` : ''}
    <div class="steps">${steps}</div>
    ${helpers ? `<div style="padding-top:4px">${helpers}</div>` : ''}
    ${todo.length ? '<p class="small-print">Times are examples until the tickets are booked.</p>' : ''}
    ${tonight && isLastOfDay ? `<div class="section"><a class="card card-link" href="#/hotel/${tonight.id}">${I.hotel(40)}<span class="grow"><span class="eyebrow" style="display:block">Tonight</span><span class="title" style="display:block">${esc(tonight.short)}</span></span>${I.chevron()}</a></div>` : ''}
    ${journeyNav(j)}
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

/* ---------- bags ---------- */
const bagPics = (w, s = 34) => w === 'us' ? `${I.suitcase(s)}<span style="margin-left:-10px">${I.backpack(s - 4)}</span>` : w === 'truck' ? I.truck(s) : I.backpack(s);
const hotelName = (id) => id === 'haneda' ? 'Haneda Airport, Terminal 3' : ((T.hotels.find((h) => h.id === id) || {}).short || id);
const SEND_STATUS = { planned: ['Planned', 'st-booked'], optional: ['Optional', 'st-tap'], sent: ['Sent', 'st-sent'] };
const sendStatus = (s) => { const [l, c] = SEND_STATUS[s.tracking ? 'sent' : s.status] || SEND_STATUS.optional; return `<span class="status ${c}">${l}</span>`; };

function sendCard(s) {
  return `<a class="card card-link send-card" href="#/send/${s.id}">
    ${I.truck(44)}
    <span class="grow"><span class="eyebrow" style="display:block">${fmt(s.date)}</span>
    <span class="title" style="display:block;font-size:17px;margin-top:2px">${esc(hotelName(s.from))} to ${esc(hotelName(s.to))}</span></span>
    ${sendStatus(s)}
  </a>`;
}

function bags() {
  return `<div class="screen">
    ${header('Our bags', 'Where are the big suitcases each day? Tap a day for more.', 'var(--orange)', true)}
    <div class="legend">
      <div><span class="pics">${I.suitcase(40)}<span style="margin-left:-8px">${I.backpack(34)}</span></span><p>Suitcases and backpacks</p></div>
      <div><span class="pics">${I.truck(40)}</span><p>On the truck</p></div>
      <div><span class="pics">${I.backpack(40)}</span><p>Backpacks only</p></div>
    </div>
    <div class="section"><p class="section-title">Sending suitcases ahead</p>
      <p class="sub" style="margin:-4px 0 10px">The hotel front desk sends them to the next hotel for us. ${esc(T.bags.cost)}.</p>
      <div class="stack tight">${T.bags.sends.map(sendCard).join('')}</div></div>
    <div class="section"><p class="section-title">Day by day</p><div class="stack tight">
      ${T.bags.days.map((d) => `<a class="bag-day card-link" href="#/bagday/${d.id}"><div class="when">${esc(d.dates)}</div><div class="pics">${bagPics(d.where)}</div><p class="grow">${esc(d.text)}</p>${I.chevron(18)}</a>`).join('')}
    </div></div>
    <div class="end-space"></div>
  </div>`;
}

function sendPage(id) {
  const s = T.bags.sends.find((x) => x.id === id);
  if (!s) return notFound();
  const to = T.hotels.find((h) => h.id === s.to);
  const facts = [
    ['Send on', fmt(s.date)], ['Bags ready by', s.readyBy], ['Where', s.readyWhere],
    ['Goes to', hotelName(s.to)], ['Arrives', fmt(s.arrive)], ['Who sends them', T.bags.company], ['Cost', T.bags.cost]
  ];
  return `<div class="screen">
    ${header(`${esc(hotelName(s.from))} to ${esc(hotelName(s.to))}`, s.status === 'optional' ? 'Optional. Only if we decide to.' : 'Planned', 'var(--purple)')}
    <div class="section"><div class="card pad">
      <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    </div></div>
    <div class="note note-yellow"><div><p class="title">Why</p><p>${esc(s.why)}</p></div></div>
    <div class="note note-green">${I.backpack(44)}<div><p class="title">Your backpack</p><p>${esc(s.bagsNote)}</p></div></div>
    ${s.todo ? `<div class="note note-orange"><div><p class="title">Before we go</p><p>${esc(s.todo)}</p></div></div>` : ''}
    <div class="section">
      <button type="button" class="btn ink" data-big="send:${s.id}">Show the front desk</button>
      <div class="card pad" style="margin-top:12px"><p class="eyebrow">Tracking number</p><p class="title" style="margin-top:4px">${s.tracking ? esc(s.tracking) : 'Added once the bags are sent'}</p></div>
    </div>
    ${to ? `<div class="section"><a class="card card-link" href="#/hotel/${to.id}">${I.hotel(40)}<span class="grow"><span class="eyebrow" style="display:block">Where they go</span><span class="title" style="display:block">${esc(to.short)}</span></span>${I.chevron()}</a></div>` : ''}
    <div class="end-space"></div>
  </div>`;
}

function bagDay(id) {
  const d = T.bags.days.find((x) => x.id === id);
  if (!d) return notFound();
  const send = d.send && T.bags.sends.find((s) => s.id === d.send);
  const stay = hotelFor(d.date);
  const label = { us: 'Suitcases and backpacks are with us', truck: 'Suitcases are on the truck', pack: 'Backpacks only today' }[d.where];
  return `<div class="screen">
    ${header(esc(d.dates), esc(label), 'var(--orange)', true)}
    <div class="section"><div class="card pad row">${'<span class="pics" style="display:flex;align-items:flex-end">' + bagPics(d.where, 52) + '</span>'}<p class="title grow" style="font-size:17px">${esc(d.text)}</p></div></div>
    ${d.readyBy ? `<div class="section"><div class="card pad"><dl class="facts"><dt>Bags ready by</dt><dd>${esc(d.readyBy)}</dd><dt>Where</dt><dd>${esc(d.readyWhere)}</dd></dl></div></div>` : ''}
    ${(d.detail || []).length ? `<div class="section"><div class="card pad"><ul class="bullets">${d.detail.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
    ${send ? `<div class="section"><p class="section-title">${send.status === 'optional' ? 'Option: send suitcases ahead' : 'Sending suitcases ahead'}</p>${sendCard(send)}</div>` : ''}
    ${stay ? `<div class="section"><a class="card card-link" href="#/hotel/${stay.id}">${I.hotel(40)}<span class="grow"><span class="eyebrow" style="display:block">Staying at</span><span class="title" style="display:block">${esc(stay.short)}</span></span>${I.chevron()}</a></div>` : ''}
    <div class="end-space"></div>
  </div>`;
}

/* ---------- hotels ---------- */
function hotels() {
  const t = today();
  const nights = T.hotels.reduce((n, h) => n + daysBetween(h.checkIn, h.checkOut), 0);
  return `<div class="screen" style="background:#FFF4F7">
    ${header('Our hotels', `${T.hotels.length} hotels · ${nights} nights. Tap one for details.`, 'var(--pink)')}
    <div class="section stack" style="gap:16px">
      ${T.hotels.map((h) => {
        const n = daysBetween(h.checkIn, h.checkOut);
        const now = h.checkIn <= t && t < h.checkOut;
        return `<a class="card photo-card card-link-block${now ? ' tonight' : ''}" href="#/hotel/${h.id}">
          <img src="${h.img}" alt="${esc(h.name)}" loading="lazy">
          <div class="pad stack tight">
            <div class="row" style="gap:10px"><span class="nights">${n} night${n > 1 ? 's' : ''}</span><span class="title grow" style="font-size:17px">${fmt(h.checkIn)} to ${fmt(h.checkOut)}</span>${I.chevron()}</div>
            ${now ? '<p class="eyebrow" style="color:var(--pink)">We are here tonight</p>' : ''}
            <p class="sub" style="margin:0">${esc(h.note)}</p>
          </div>
        </a>`;
      }).join('')}
    </div>
    <div class="end-space"></div>
  </div>`;
}

// Opens the phone's Mail app with the subject and booking details already typed in.
const mailto = (to, subject, body) => `mailto:${to || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const KLOOK_BOOKINGS = 'https://www.klook.com/en-AU/bookings/';

function hotelPage(id) {
  const h = T.hotels.find((x) => x.id === id);
  if (!h) return notFound();
  const n = daysBetween(h.checkIn, h.checkOut);
  const q = encodeURIComponent(`${h.name}, ${h.address}`);
  const facts = [
    ['Dates', `${fmt(h.checkIn)} to ${fmt(h.checkOut)} (${n} night${n > 1 ? 's' : ''})`],
    ['Check-in', h.checkInTime], ['Check-out', h.checkOutTime], ['Rooms', h.rooms],
    ['Breakfast', h.breakfast ? 'Included' : 'Not included'], ['Booked on', h.bookedVia]
  ];
  return `<div class="screen" style="background:#FFF4F7">
    <div class="photo-head"><img src="${h.img}" alt="${esc(h.name)}"></div>
    <div class="card lift overlap">
      <p class="eyebrow">${esc(h.city)}</p>
      <h1>${esc(h.name)}</h1>
      <p class="sub" style="font-size:15px;margin-top:6px">${esc(h.note)}</p>
    </div>
    <div class="section"><div class="card pad"><dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${h.extra ? `<p class="sub" style="margin-top:10px">${esc(h.extra)}</p>` : ''}
      <div class="row" style="gap:6px;font-size:13px;font-weight:600;margin-top:12px">${h.bags === 'big' ? I.suitcase() + I.backpack() + '<span>Suitcases and backpacks</span>' : I.backpack() + '<span>Backpacks only</span>'}</div>
    </div></div>
    <div class="section"><div class="card pad">
      <p class="eyebrow">Address</p><p class="title" style="margin-top:4px;font-size:17px">${esc(h.address)}</p>
      <a class="btn" href="https://maps.apple.com/?q=${q}" target="_blank" rel="noopener">Open in Maps ${I.external()}</a>
      <button type="button" class="btn ink" data-big="hotel:${h.id}">Show the taxi driver</button>
      <div class="link-row">
        ${h.phone ? `<a href="tel:${h.phone.replace(/[^+\d]/g, '')}">Call ${esc(h.phone)}</a>` : ''}
        <a href="${mailto(h.email, `Our booking: ${fmt(h.checkIn)} to ${fmt(h.checkOut)}, 8 guests`, `Hello ${h.name},\n\nWe have a booking with you from ${fmt(h.checkIn)} to ${fmt(h.checkOut)} for 8 guests (${h.rooms}). ${h.bookedVia ? `Booked on ${h.bookedVia}.` : ''}\n\n\n\nThank you,\n${S.me() || ''}`)}">Email the hotel</a>
        <a href="https://www.google.com/search?q=${encodeURIComponent(h.name + ' official website')}" target="_blank" rel="noopener">Hotel website ${I.external(14)}</a>
      </div>
    </div></div>
    <div class="end-space"></div>
  </div>`;
}

/* ---------- phrases and translating ---------- */
function phrases() {
  return `<div class="screen">
    ${header('Phrases and translating', 'Tap a phrase to show it big, or to hear it.', 'var(--teal)')}
    <div class="section"><div class="card pad">
      <p class="title">Translate a sign or menu</p>
      <ol class="steps-list">
        <li>Open the <b>Translate</b> app (it comes with every iPhone).</li>
        <li>Tap <b>Camera</b> at the bottom.</li>
        <li>Point it at the sign or menu. The English appears on top.</li>
      </ol>
      <p class="sub">Download Japanese first so it works with no internet: Translate app, then the language button, then Download Languages, Japanese.</p>
      <a class="btn" href="https://translate.google.com/?sl=ja&amp;tl=en&amp;op=images" target="_blank" rel="noopener">Or use Google Translate ${I.external()}</a>
    </div></div>
    ${T.phrases.map((g, gi) => `<div class="section"><p class="section-title">${esc(g.group)}</p><div class="card phrase-list">
      ${g.items.map(([en, jp, ro], i) => `<button type="button" class="phrase" data-big="phrase:${gi}:${i}"><span class="grow"><span class="en">${esc(en)}</span><span class="ro">${esc(ro)}</span></span><span class="jp" lang="ja">${esc(jp)}</span></button>`).join('')}
    </div></div>`).join('')}
    <div class="section"><div class="card pad emergency">
      <p class="title">Emergency numbers in Japan</p>
      <div class="row" style="margin-top:10px;gap:10px">
        <a class="sos" href="tel:110"><b>110</b><span>Police</span></a>
        <a class="sos" href="tel:119"><b>119</b><span>Ambulance and fire</span></a>
      </div>
    </div></div>
    <div class="end-space"></div>
  </div>`;
}

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* no voice available */ }
}

function showBig(key) {
  const [type, a, b] = key.split(':');
  let jp, en, extra = '';
  if (type === 'phrase') {
    const [e, j, r] = T.phrases[+a].items[+b];
    jp = j; en = e; extra = r;
  } else if (type === 'hotel') {
    const h = T.hotels.find((x) => x.id === a);
    jp = 'このホテルまでお願いします'; en = 'Please take me to this hotel';
    extra = `<b>${esc(h.name)}</b><br>${esc(h.address)}`;
  } else if (type === 'send') {
    const s = T.bags.sends.find((x) => x.id === a);
    const to = T.hotels.find((x) => x.id === s.to);
    jp = 'この荷物をこのホテルに送りたいです'; en = 'I want to send this luggage to this hotel';
    extra = to ? `<b>${esc(to.name)}</b><br>${esc(to.address)}<br>Arrive by ${fmt(s.arrive)}. Guest name: Katrina Clout.` : `<b>Haneda Airport, Terminal 3</b><br>Cathay Pacific CX549, ${fmt(s.arrive)}. Guest name: Katrina Clout.`;
  }
  const el = document.createElement('div');
  el.className = 'big-show';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', en);
  el.innerHTML = `<p class="big-jp" lang="ja">${esc(jp)}</p>
    <p class="big-extra">${type === 'phrase' ? esc(extra) : extra}</p>
    <p class="big-en">${esc(en)}</p>
    <div class="big-actions"><button type="button" data-act="speak">Say it out loud</button><button type="button" data-act="close">Close</button></div>`;
  el.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'speak') speak(jp);
    if (act === 'close') el.remove();
  });
  document.body.appendChild(el);
}

/* ---------- tickets wallet ---------- */
function tickets() {
  const todo = toBook();
  const nights = T.hotels.reduce((n, h) => n + daysBetween(h.checkIn, h.checkOut), 0);
  return `<div class="screen">
    ${header('Tickets', 'Booking numbers, tickets and what is still to book', '#FFC93C', true)}
    <div class="section"><p class="section-title">Our tickets</p><div class="stack">
      ${T.tickets.map((k) => `<a class="card tk card-link" href="#/ticket/${k.id}">${I.kindTile(k.kind, 56)}<div class="grow"><p class="eyebrow">${fmt(k.date)}</p><p class="title" style="margin-top:2px">${esc(k.title)}</p>${k.refs && k.refs[0] ? `<p class="ref-line">${esc(k.refs[0].value)}</p>` : `<p class="sub">${esc(k.detail)}</p>`}${k.print ? `<span class="print-flag">${I.printer()} Print before we go</span>` : ''}</div>${I.chevron()}</a>`).join('')}
      <a class="card tk card-link" href="#/hotels" style="align-items:center">${I.hotel(48)}<span class="grow"><span class="title" style="display:block">All ${T.hotels.length} hotels</span><span class="sub" style="display:block">${nights} nights for all 8, booked on Booking.com.</span></span>${I.chevron()}</a>
    </div></div>
    ${todo.length ? `<div class="section"><p class="section-title">Still to book (${todo.length})</p><div class="stack">
      ${todo.map((b) => `<a class="card card-link" href="#/journey/${b.journey.id}">${I.kindTile(b.journey.kind, 56)}<span class="grow"><span class="eyebrow" style="display:block">${fmt(b.journey.date)}</span><span class="title" style="display:block;font-size:17px;margin-top:2px">${esc(b.label)}</span></span><span class="status st-book">Book now</span></a>`).join('')}
    </div></div>` : ''}
    <div class="end-space"></div>
  </div>`;
}

function ticketPage(id) {
  const k = T.tickets.find((x) => x.id === id);
  if (!k) return notFound();
  const qrs = (k.files || []).filter((f) => f.qr);
  const files = (k.files || []).filter((f) => !f.qr);
  return `<div class="screen">
    ${header(esc(k.title), `${fmt(k.date)} · ${esc(k.detail)}`, '#FFC93C', true)}
    ${k.print ? `<div class="note note-yellow">${I.printer(36)}<div><p class="title">Print these before we go</p><p>The gates only take paper tickets.</p></div></div>` : ''}
    ${qrs.length ? `<div class="section"><p class="section-title">Scan at the gate</p><div class="stack">${qrs.map((f) => `<figure class="card qr-card"><img data-file="${f.src}" data-zoom data-qr alt="${esc(f.label)}"><figcaption><b>${esc(f.label)}</b><br>Tap the code to show it full screen. Turn your screen brightness up.</figcaption></figure>`).join('')}</div></div>` : ''}
    ${k.seats ? seatTickets(k) : ''}
    ${(k.refs || []).length ? `<div class="section"><div class="stack tight">${k.refs.map((r) => `<button type="button" class="card ref-card" data-copy="${esc(r.value)}"><span class="eyebrow">${esc(r.label)}</span><span class="ref-big">${esc(r.value)}</span><span class="copy-hint">Tap to copy</span></button>`).join('')}</div></div>` : ''}
    ${(k.people || []).length ? `<div class="section"><p class="section-title">${esc(k.people[0].label)} for each person</p><div class="card phrase-list">${k.people.map((p) => `<button type="button" class="phrase" data-copy="${esc(p.value)}"><span class="grow en">${esc(p.name)}</span><span class="mono">${esc(p.value)}</span></button>`).join('')}</div></div>` : ''}
    ${files.length ? `<div class="section"><p class="section-title">Tickets and QR codes</p><div class="stack">${files.map((f) => `<figure class="card ticket-pic"><img data-file="${f.src}" alt="${esc(f.label)}"><figcaption>${esc(f.label)}</figcaption></figure>`).join('')}</div></div>` : ''}
    <div class="section"><div class="stack tight">
      ${k.klook ? `<a class="btn klook" href="${KLOOK_BOOKINGS}" target="_blank" rel="noopener">Open in Klook ${I.external()}</a>` : ''}
      <a class="btn ink" href="${mailto(k.email, `${k.title}${k.refs && k.refs[0] ? ` (${k.refs[0].value})` : ''}`, `Hello,\n\nAbout our booking: ${k.title}, ${fmt(k.date)}.\n${(k.refs || []).map((r) => `${r.label}: ${r.value}`).join('\n')}\n\n\n\nThank you,\n${S.me() || ''}`)}">Email about this booking</a>
    </div></div>
    ${(k.notes || []).length ? `<div class="section"><div class="card pad"><ul class="bullets">${k.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
    <div class="section"><p class="section-title">On this phone</p>
      <div class="local-photos" data-photos="${k.id}"></div>
      <label class="btn ink add-photo">Add a photo or screenshot<input type="file" accept="image/*" data-add="${k.id}" hidden></label>
      <p class="sub" style="margin-top:8px">Only you see these. Handy for your own ticket screenshot. They work with no internet.</p>
    </div>
    <div class="end-space"></div>
  </div>`;
}

// Tickets with one QR code per person (bullet trains): you see your own, parents see everyone's.
function seatTickets(k) {
  const who = S.me();
  const mine = k.seats.find((x) => x.name === who);
  const label = (x) => `${x.name}: Car ${x.car}, seat ${x.seat}`;
  const card = (x, big) => `<figure class="card qr-card${big ? '' : ' small'}"><img data-file="${x.file}" data-zoom data-qr data-caption="${esc(label(x))}" alt="QR ticket for ${esc(x.name)}"><figcaption><b>${esc(big ? `Car ${x.car}, seat ${x.seat}` : x.name)}</b>${big ? '<br>Tap the code to show it full screen at the ticket gate.' : `<br>Car ${x.car}, seat ${esc(x.seat)}`}</figcaption></figure>`;
  const own = mine
    ? `<div class="section"><p class="section-title">Your ticket, ${esc(who)}</p>${card(mine, true)}</div>`
    : `<div class="section"><a class="card card-link pad" href="#/me"><span class="grow"><span class="title" style="display:block">Who are you?</span><span class="sub" style="display:block">Pick your name to see your own ticket.</span></span>${I.chevron()}</a></div>`;
  const all = S.parent()
    ? `<div class="section"><p class="section-title">Everyone's tickets (parent view)</p><div class="qr-grid">${k.seats.map((x) => card(x, false)).join('')}</div></div>`
    : '';
  return own + all;
}

async function hydrate() {
  for (const img of app.querySelectorAll('img[data-file]')) {
    try { img.src = await openFile(T, img.dataset.file); } catch { img.alt = 'Could not open this picture. Connect to the internet once and try again.'; }
  }
  for (const box of app.querySelectorAll('[data-photos]')) {
    const list = await photosFor(box.dataset.photos).catch(() => []);
    box.innerHTML = list.map((p) => `<figure class="local-photo"><img src="${URL.createObjectURL(p.blob)}" alt="Saved photo" data-zoom><button type="button" data-remove="${p.id}" aria-label="Remove photo">Remove</button></figure>`).join('');
  }
}

function zoom(src, qr, caption) {
  const el = document.createElement('div');
  el.className = `big-show photo-zoom${qr ? ' qr-zoom' : ''}`;
  el.innerHTML = `${caption ? `<p class="zoom-cap">${esc(caption)}</p>` : ''}<img src="${src}" alt=""><div class="big-actions"><button type="button" data-act="close">Close</button></div>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

/* ---------- morning plans ---------- */
const NAMES = () => T.travellers.map((p) => p.name);
let editing = null; // date of the morning plan a parent is changing

const to24 = (t) => { const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(t || ''); if (!m) return ''; let h = +m[1] % 12; if (m[3].toLowerCase() === 'pm') h += 12; return `${String(h).padStart(2, '0')}:${m[2]}`; };
const to12 = (v) => { const [h, m] = v.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`; };
const morningFor = (date) => T.mornings.find((m) => m.date === date);
const TIME_ICON = { bags: () => I.backpack(36), food: () => I.food(), lobby: () => I.lobby() };

function morningCard(m, label) {
  const first = S.timesFor(m)[0];
  const r = S.ready(m.date);
  const n = NAMES().filter((x) => r[x]).length;
  return `<a class="card card-link morning-card" href="#/morning/${m.date}">${I.clock(40)}
    <span class="grow"><span class="eyebrow" style="display:block">${label} · ${fmt(m.date)}</span>
    <span class="title" style="display:block;margin-top:2px">Morning plan</span>
    <span class="sub" style="display:block">${esc(S.timesFor(m).filter((t) => t.kind).map((t) => `${t.title.split(' ')[0]} ${t.time}`).slice(0, 3).join(' · ') || first.time)}</span>
    ${n ? `<span class="sub" style="display:block;font-weight:700;color:var(--green)">${n} of 8 ready</span>` : ''}</span>${I.chevron()}</a>`;
}

function morning(date) {
  const m = morningFor(date);
  if (!m) return notFound();
  const isParent = !!S.parent();
  const times = S.timesFor(m);
  const r = S.ready(date);
  const names = NAMES();
  const count = names.filter((n) => r[n]).length;
  const notReady = names.filter((n) => !r[n]);
  const rows = editing === date
    ? `<form class="stack tight" id="timeform" data-date="${date}">
        ${times.map((t, i) => `<div class="card pad edit-row"><label>Time<input type="time" name="time${i}" value="${to24(t.time)}" required></label><label class="grow">What<input name="title${i}" value="${esc(t.title)}" required></label></div>`).join('')}
        <button class="btn" type="submit">Save times</button>
        <button class="btn ink" type="button" data-act="cancel-edit">Cancel</button>
        ${S.changedTimes(date) ? '<button class="btn ink" type="button" data-act="reset-times">Go back to the suggested times</button>' : ''}
      </form>`
    : times.map((t) => `<div class="card time-row"><div class="t">${esc(t.time.replace(/(am|pm)$/, ''))}<small>${esc((t.time.match(/(am|pm)$/) || [''])[0])}</small></div><div class="grow"><p class="title" style="font-size:17px">${esc(t.title)}</p>${t.detail ? `<p class="sub">${esc(t.detail)}</p>` : ''}</div>${TIME_ICON[t.kind] ? `<span class="time-ico">${TIME_ICON[t.kind]()}</span>` : ''}</div>`).join('');
  return `<div class="screen" style="background:#FFF6E5">
    <header class="bar dark-text" style="background:#FFC93C">
      <div class="back-space"></div>
      <p class="eyebrow">${fmt(date)} · ${esc(m.where)}</p>
      <h1>Morning plan</h1>
      <p class="lead">${esc(m.headline)}</p>
    </header>
    <div class="section stack tight">${rows}</div>
    ${editing === date ? '' : `
    ${isParent ? `<div class="section"><button type="button" class="btn ink" data-act="edit-times">${I.lock(20)} Change the times</button></div>` : ''}
    <div class="section">
      <h2 class="section-title" style="font-size:22px;font-weight:900">Packed and ready?</h2>
      <p class="sub" style="margin:-4px 0 12px">Tap your name when your bag is zipped and you're ready to go.</p>
      <div class="ready-grid">${names.map((n) => `<button type="button" class="ready-btn" data-ready="${date}|${esc(n)}" aria-pressed="${!!r[n]}"><span class="tick" aria-hidden="true">${r[n] ? '✓' : ''}</span>${esc(n)}</button>`).join('')}</div>
      <p class="ready-count">${count === names.length ? 'Everyone is ready. Let’s go!' : `${count} of ${names.length} ready`}</p>
      ${isParent && notReady.length && count ? `<p class="sub" style="text-align:center">Still getting ready: ${esc(notReady.join(', '))}</p>` : ''}
    </div>
    <div class="note note-blue">${I.clock(36)}<div><p class="title">${S.changedTimes(date) ? 'Times changed by a parent' : 'Suggested times'}</p><p>Parents can change these with the parent PIN. Ticks and time changes show on everyone's phone.</p></div></div>${syncLine()}`}
    <div class="end-space"></div>
  </div>`;
}

function mornings() {
  return `<div class="screen" style="background:#FFF6E5">
    ${header('Morning plans', 'Wake-up, bags, breakfast and lobby times for each big morning.', '#FFC93C', true)}
    ${remindCard()}
    <div class="section stack tight">${T.mornings.map((m) => morningCard(m, m.headline.split(/[.!]/)[0])).join('')}</div>
    <div class="end-space"></div>
  </div>`;
}

/* ---------- parent mode ---------- */
function parentScreen() {
  const who = S.parent();
  return `<div class="screen">
    ${header('Parent mode', who ? `Unlocked for ${esc(who)} on this phone.` : 'For Steve, Katrina and Kim.', 'var(--ink)')}
    ${who ? `<div class="section stack">
        <div class="card pad"><p class="title">You can now</p><ul class="bullets" style="margin-top:8px"><li>Change the times on any morning plan</li><li>See who still isn't ready</li></ul></div>
        <a class="btn" href="#/mornings">Go to morning plans</a>
        <button type="button" class="btn ink" data-act="leave-parent">Leave parent mode</button>
      </div>`
    : `<form class="section stack" id="pinform">
        <div class="card pad"><p class="title">Who are you?</p><div class="chips" style="padding:10px 0 0">${T.parents.map((n, i) => `<label class="chip-radio"><input type="radio" name="who" value="${esc(n)}"${i === 0 ? ' checked' : ''}><span>${esc(n)}</span></label>`).join('')}</div></div>
        <div class="card pad"><label class="title" for="pin">Parent PIN</label><input id="pin" class="pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" required></div>
        <p class="err-inline" id="pinerr" role="alert"></p>
        <button class="btn" type="submit">${I.lock(20)} Unlock</button>
      </form>`}
    <div class="end-space"></div>
  </div>`;
}

/* ---------- weather ---------- */
function weatherScreen() {
  return `<div class="screen">
    ${header('Weather and what to wear', 'Forecasts start about 2 weeks ahead. Before that, the usual December weather.', 'var(--teal)')}
    <div class="section stack tight" data-weather="all"><p class="empty">Loading the weather…</p></div>
    <p class="small-print">Forecasts from Open-Meteo. Temperatures in °C.</p>
    <div class="end-space"></div>
  </div>`;
}

function wxCard(w, big = false) {
  const d = Wx.describe(w.code);
  return `<div class="card wx-card${big ? ' big' : ''}">
    <div class="row">
      <span class="wx-ico">${I.weatherIcon(d.icon, big ? 56 : 44)}</span>
      <div class="grow"><p class="eyebrow">${fmt(w.date)} · ${esc(w.placeName)}</p>
      <p class="title" style="margin-top:2px">${w.max}° <span class="lo">/ ${w.min}°</span> <span class="wx-label">${esc(w.forecast ? d.label : 'Usual for December')}</span></p>
      ${w.forecast && w.rain !== null ? `<p class="sub">${w.rain}% chance of rain</p>` : ''}</div>
    </div>
    <ul class="wear">${Wx.whatToWear(w).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </div>`;
}

async function hydrateWeather() {
  const boxes = app.querySelectorAll('[data-weather]');
  if (!boxes.length) return;
  const t = today();
  const all = await Wx.tripWeather(T, t < T.start ? T.start : t).catch(() => null);
  if (!all) return;
  boxes.forEach((box) => {
    const mode = box.dataset.weather;
    let list = all.filter((w) => w.date >= t);
    if (mode === 'next') list = list.slice(0, 2);
    box.innerHTML = list.length ? list.map((w, i) => wxCard(w, mode === 'next' && i === 0)).join('') : '<p class="empty">The trip is over. Welcome home!</p>';
  });
}

function notFound() {
  return `<div class="screen">${header('Not found', 'That page is not in the trip.', 'var(--ink)')}</div>`;
}

/* ---------- family sharing: who am I, messages, Shout, photo diary ---------- */
const timeStr = (ms) => { const d = new Date(ms); return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? 'am' : 'pm'}`; };
const dayStr = (ms) => fmt(iso(new Date(ms)));
const familyOf = (n) => (T.travellers.find((p) => p.name === n) || {}).family;
const FAMILIES = () => [...new Set(T.travellers.map((p) => p.family))];
const plural = (f) => `${f}s`;

function syncLine() {
  const s = S.status();
  const w = S.waiting();
  let txt = 'Shared with the whole family.';
  if (s === 'off') txt = 'Family sharing is not switched on yet.';
  else if (s === 'error') txt = 'Could not reach the family database. Let Steve know.';
  else if (s === 'offline') txt = w ? `No internet right now. ${w} change${w > 1 ? 's' : ''} will send when you're back online.` : 'No internet right now. Showing what this phone saved last.';
  else if (s === 'connecting') txt = w ? 'Sending…' : 'Connecting to the family…';
  else if (w) txt = 'Sending…';
  return `<p class="sync-line sync-${s}">${esc(txt)}</p>`;
}

function whoGate(title, color) {
  const cur = S.me();
  return `<div class="screen">
    ${header(title, cur ? `This phone is set to ${esc(cur)}.` : 'First, who is using this phone?', color)}
    <div class="section"><div class="ready-grid">${NAMES().map((n) => `<button type="button" class="ready-btn" data-me="${esc(n)}" aria-pressed="${n === cur}"><span class="tick" aria-hidden="true">${n === cur ? '✓' : ''}</span>${esc(n)}</button>`).join('')}</div>
    <p class="sub" style="margin-top:12px;text-align:center">You only need to do this once. You can change it at the bottom of Home.</p></div>
    <div class="end-space"></div>
  </div>`;
}
const meScreen = () => whoGate('Who are you?', 'var(--ink)');

/* messages */
const seen = () => { try { return Number(localStorage.getItem('seen')) || 0; } catch { return 0; } };
const unread = () => { const me = S.me(); const s = seen(); return S.messages().filter((m) => m.from !== me && m.at > s).length; };
function chat() {
  const me = S.me();
  if (!me) return whoGate('Messages', 'var(--green)');
  const list = S.messages().slice(-200);
  if (list.length) { try { localStorage.setItem('seen', String(Math.max(seen(), list[list.length - 1].at))); } catch { /* ignore */ } }
  let lastDay = '';
  const rows = list.map((m) => {
    const d = dayStr(m.at);
    const sep = d !== lastDay ? `<p class="chat-day">${d}</p>` : '';
    lastDay = d;
    const mine = m.from === me;
    return `${sep}<div class="bubble${mine ? ' mine' : ''}">${mine ? '' : `<b>${esc(m.from)}</b>`}<p>${esc(m.text)}</p><time>${timeStr(m.at)}</time></div>`;
  }).join('');
  return `<div class="screen chat-screen">
    ${header('Messages', 'The whole family sees these.', 'var(--green)')}
    <div class="chat-list">${rows || '<p class="empty">No messages yet. Say hello!</p>'}</div>
    ${syncLine()}
    <form class="chat-form" id="chatform"><textarea name="text" rows="1" placeholder="Message the family" maxlength="1000" required></textarea><button type="submit" class="send-btn">Send</button></form>
  </div>`;
}

/* Shout: who paid and who owes who */
const UNIT = { JPY: 1, AUD: 0.01 };
const money = (units, cur) => cur === 'AUD' ? `A$${(units / 100).toFixed(2)}` : `¥${Math.round(units).toLocaleString('en-AU')}`;
function netFor(list, cur) {
  const net = Object.fromEntries(NAMES().map((n) => [n, 0]));
  list.filter((s) => s.cur === cur).forEach((s) => {
    const among = s.among && s.among.length ? s.among : NAMES();
    const total = Math.round(s.amount / UNIT[cur]);
    const share = Math.floor(total / among.length);
    const rem = total - share * among.length;
    among.forEach((n, i) => { net[n] = (net[n] || 0) - share - (i < rem ? 1 : 0); });
    net[s.by] = (net[s.by] || 0) + total;
  });
  return net;
}
function settle(net) {
  const owe = Object.entries(net).filter(([, v]) => v < 0).map(([n, v]) => [n, -v]).sort((a, b) => b[1] - a[1]);
  const get = Object.entries(net).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const out = [];
  let i = 0; let j = 0;
  while (i < owe.length && j < get.length) {
    const amt = Math.min(owe[i][1], get[j][1]);
    if (amt > 0) out.push({ from: owe[i][0], to: get[j][0], amt });
    owe[i][1] -= amt; get[j][1] -= amt;
    if (!owe[i][1]) i++;
    if (!get[j][1]) j++;
  }
  return out;
}
function shout() {
  if (!S.me()) return whoGate('Shout', 'var(--yellow)');
  const list = S.shouts();
  const curs = ['JPY', 'AUD'].filter((c) => list.some((s) => s.cur === c));
  const summary = curs.map((cur) => {
    const net = netFor(list, cur);
    const fam = {};
    Object.entries(net).forEach(([n, v]) => { const f = familyOf(n); fam[f] = (fam[f] || 0) + v; });
    const famMoves = settle(fam);
    const people = settle(net);
    return `<div class="card pad">
      <p class="eyebrow">${cur === 'JPY' ? 'Japanese yen' : 'Australian dollars'}</p>
      <p class="title" style="margin-top:4px">${famMoves.length ? famMoves.map((m) => `The ${esc(plural(m.from))} owe the ${esc(plural(m.to))} <span class="amt">${money(m.amt, cur)}</span>`).join('<br>') : 'The families are all square.'}</p>
      ${people.length ? `<details class="owe-more"><summary>Person by person</summary><ul class="owe-list">${people.map((m) => `<li><b>${esc(m.from)}</b> pays <b>${esc(m.to)}</b><span class="amt">${money(m.amt, cur)}</span></li>`).join('')}</ul></details>` : ''}
    </div>`;
  }).join('');
  const rows = list.slice().reverse().map((s) => {
    const among = s.among && s.among.length ? s.among : NAMES();
    const who = among.length === NAMES().length ? 'everyone' : FAMILIES().find((f) => { const fm = NAMES().filter((n) => familyOf(n) === f); return fm.length === among.length && fm.every((n) => among.includes(n)); });
    const split = who === 'everyone' ? 'Split between everyone' : who ? `Split between the ${plural(who)}` : `Split between ${among.join(', ')}`;
    return `<div class="card shout-row"><div class="grow"><p class="title" style="font-size:17px">${esc(s.what)}</p><p class="sub">${esc(s.by)} paid · ${dayStr(s.at)}</p><p class="sub">${esc(split)}</p></div>
      <div class="shout-side"><span class="amt">${money(Math.round(s.amount / UNIT[s.cur]), s.cur)}</span><button type="button" class="link-btn" data-unshout="${s.id}">Remove</button></div></div>`;
  }).join('');
  return `<div class="screen">
    ${header('Shout', 'Who paid, and who owes who.', '#FFC93C', true)}
    <div class="section"><a class="btn" href="#/shoutadd" style="margin-top:0">${I.coins(28)} Add who paid</a></div>
    <div class="section stack">${summary || '<p class="empty">Nothing added yet. When someone pays for the group, add it here and the app works out who owes who.</p>'}</div>
    ${rows ? `<div class="section"><p class="section-title">Everything paid</p><div class="stack tight">${rows}</div></div>` : ''}
    ${syncLine()}
    <div class="end-space"></div>
  </div>`;
}
function shoutAdd() {
  const me = S.me();
  if (!me) return whoGate('Shout', 'var(--yellow)');
  return `<div class="screen">
    ${header('Add a shout', 'Who paid, how much, and who it was for.', '#FFC93C', true)}
    <form class="section stack" id="shoutform">
      <div class="card pad"><label class="title" for="what">What was it?</label><input id="what" name="what" class="text-input" placeholder="Dinner at the ramen place" maxlength="80" required></div>
      <div class="card pad"><label class="title" for="amount">How much?</label>
        <div class="row" style="margin-top:10px"><input id="amount" name="amount" class="text-input" inputmode="decimal" placeholder="0" required style="margin:0">
        <div class="chips" style="padding:0;flex:none"><label class="chip-radio"><input type="radio" name="cur" value="JPY" checked><span>¥ Yen</span></label><label class="chip-radio"><input type="radio" name="cur" value="AUD"><span>A$</span></label></div></div></div>
      <div class="card pad"><p class="title">Who paid?</p><div class="chips" style="padding:10px 0 0">${NAMES().map((n) => `<label class="chip-radio"><input type="radio" name="by" value="${esc(n)}"${n === me ? ' checked' : ''}><span>${esc(n)}</span></label>`).join('')}</div></div>
      <div class="card pad"><p class="title">Who was it for?</p>
        <div class="chips" style="padding:10px 0 0"><button type="button" class="chip" data-preset="all">Everyone</button>${FAMILIES().map((f) => `<button type="button" class="chip" data-preset="${esc(f)}">The ${esc(plural(f))}</button>`).join('')}</div>
        <div class="chips" style="padding:10px 0 0">${NAMES().map((n) => `<label class="chip-radio"><input type="checkbox" name="among" value="${esc(n)}" checked><span>${esc(n)}</span></label>`).join('')}</div>
        <p class="sub" style="margin-top:8px">It is split evenly between the people ticked.</p></div>
      <p class="err-inline" id="shouterr" role="alert"></p>
      <button class="btn" type="submit">Save</button>
    </form>
    <div class="end-space"></div>
  </div>`;
}

/* photo diary */
function diary() {
  if (!S.me()) return whoGate('Photo diary', 'var(--pink)');
  const list = S.photos().slice().reverse();
  const days = [];
  list.forEach((p) => { const d = p.date || iso(new Date(p.at)); let g = days.find((x) => x.d === d); if (!g) days.push(g = { d, items: [] }); g.items.push(p); });
  return `<div class="screen">
    ${header('Photo diary', 'Our best photos, day by day. Everyone sees them.', 'var(--pink)')}
    <div class="section"><label class="btn" style="margin-top:0">${I.camera(28)} Add a photo<input type="file" accept="image/*" data-diary hidden></label></div>
    ${days.map((g) => `<div class="section"><p class="section-title">${fmt(g.d)}</p><div class="diary-grid">${g.items.map((p) => `<figure class="diary-item"><button type="button" class="diary-pic" data-full="${p.id}"><img src="${esc(p.thumb)}" alt="${esc(p.caption || 'Photo')}"></button><figcaption>${p.caption ? `${esc(p.caption)} ` : ''}<span>${esc(p.by)}</span>${p.by === S.me() ? ` <button type="button" class="link-btn" data-undiary="${p.id}">Remove</button>` : ''}</figcaption></figure>`).join('')}</div></div>`).join('') || '<p class="empty">No photos yet. Add the first one!</p>'}
    ${syncLine()}
    <div class="end-space"></div>
  </div>`;
}
const toDataURL = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
async function diaryPrompt(file) {
  const preview = URL.createObjectURL(file);
  const el = document.createElement('div');
  el.className = 'big-show sheet';
  el.innerHTML = `<form class="sheet-card" id="diaryform"><img src="${preview}" alt=""><label class="title" for="cap">Add a caption (optional)</label><input id="cap" class="text-input" maxlength="120" placeholder="Snow monkeys!"><button class="btn" type="submit">Add to the diary</button><button class="btn ink" type="button" data-act="cancel">Cancel</button></form>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); URL.revokeObjectURL(preview); };
  el.querySelector('[data-act=cancel]').addEventListener('click', close);
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = el.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Adding…';
    const thumb = await toDataURL(await shrink(file, 360, 0.6));
    let full = await toDataURL(await shrink(file, 1280, 0.72));
    if (full.length > 900000) full = await toDataURL(await shrink(file, 900, 0.6));
    const t = today();
    await S.addDiaryPhoto({ thumb, full, caption: el.querySelector('#cap').value.trim(), date: t });
    close();
    render();
  });
}

/* dinner: what do we feel like, and where shall we go? */
const FOODS = [['ramen', 'Ramen', '🍜'], ['sushi', 'Sushi', '🍣'], ['okonomiyaki', 'Okonomiyaki', '🥞'], ['bbq', 'Barbecue', '🥩'], ['fried', 'Tempura or crumbed', '🍤'], ['hotpot', 'Hotpot', '🍲'], ['noodles', 'Udon or noodles', '🥢'], ['western', 'Pizza or burgers', '🍕'], ['konbini', '7-Eleven picnic', '🍙']];
const nights = () => { const out = []; for (let d = T.start; d < T.end; d = iso(new Date(parse(d).getTime() + 86400000))) out.push(d); return out; };
function dinner(arg) {
  const me = S.me();
  if (!me) return whoGate('Dinner', 'var(--red)');
  const all = nights();
  const t = today();
  const date = all.includes(arg) ? arg : all.includes(t) ? t : all[0];
  const hotel = hotelFor(date);
  const picks = ((T.dinners || {})[hotel && hotel.id] || []);
  const v = S.votes(date);
  const who = (kind, val) => Object.entries(v).filter(([, x]) => x && x[kind] === val).map(([n]) => n);
  const mine = v[me] || {};
  const foodCounts = FOODS.map(([id]) => who('food', id).length);
  const topFood = Math.max(0, ...foodCounts);
  const favs = FOODS.filter((f, i) => topFood && foodCounts[i] === topFood).map((f) => f[0]);
  const placeCounts = picks.map((p) => who('place', p.id).length);
  const topPlace = Math.max(0, ...placeCounts);
  const leader = topPlace ? picks[placeCounts.indexOf(topPlace)] : null;
  const isTonight = date === t;
  return `<div class="screen">
    <header class="bar" style="background:var(--red)">
      <div class="back-space"></div>
      <p class="eyebrow" style="color:#FFE3E0">${fmt(date)}${hotel ? ` · near ${esc(hotel.short)}` : ''}</p>
      <h1>${isTonight ? 'Dinner tonight' : 'Dinner'}</h1>
      <p class="lead">Vote for what you feel like and where to go. Everyone sees the votes.</p>
    </header>
    <div class="night-row">${all.map((d) => `<a href="#/dinner/${d}" class="night${d === date ? ' on' : ''}">${DAYS[parse(d).getDay()]}<b>${dayNum(d)}</b></a>`).join('')}</div>
    ${leader ? `<div class="note note-green"><span class="big-emoji">🏆</span><div><p class="title">${esc(leader.name)} is winning</p><p>${topPlace} vote${topPlace > 1 ? 's' : ''}: ${esc(who('place', leader.id).join(', '))}</p></div></div>` : ''}
    <div class="section"><h2 class="section-title">What do we feel like?</h2>
      <div class="food-grid">${FOODS.map(([id, label, em], i) => `<button type="button" class="food-btn${favs.includes(id) ? ' top' : ''}" data-vote="${date}|food|${id}" aria-pressed="${mine.food === id}"><span class="em">${em}</span><span class="lbl">${label}</span>${foodCounts[i] ? `<span class="cnt">${foodCounts[i]}</span>` : ''}</button>`).join('')}</div>
      ${topFood ? `<p class="sub" style="margin-top:8px">${FOODS.filter((f) => favs.includes(f[0])).map((f) => `${f[1]}: ${esc(who('food', f[0]).join(', '))}`).join('<br>')}</p>` : ''}
    </div>
    <div class="section"><h2 class="section-title">Where shall we go?</h2>
      ${picks.length ? `<div class="stack">${picks.map((p, i) => `<div class="card pad dine${favs.includes(p.food) ? ' match' : ''}">
        ${favs.includes(p.food) ? '<p class="match-tag">Matches what we feel like</p>' : ''}
        <div class="row" style="align-items:flex-start"><span class="big-emoji">${(FOODS.find((f) => f[0] === p.food) || [0, 0, '🍽️'])[2]}</span>
        <div class="grow"><p class="title">${esc(p.name)}</p><p class="jp" lang="ja">${esc(p.jp)}</p><p class="sub">${esc(p.area)} · ${esc(p.price)}</p></div></div>
        <p style="margin-top:8px;font-size:15px;line-height:1.4">${esc(p.note)}</p>
        ${p.book ? '<p class="sub" style="font-weight:700;color:var(--orange)">Best to book ahead for 8 (ask the hotel front desk).</p>' : ''}
        <div class="row" style="margin-top:10px;gap:10px">
          <button type="button" class="vote-btn" data-vote="${date}|place|${p.id}" aria-pressed="${mine.place === p.id}">${mine.place === p.id ? '✓ My vote' : 'Vote'}${placeCounts[i] ? ` · ${placeCounts[i]}` : ''}</button>
          <a class="map-btn" href="https://maps.apple.com/?q=${encodeURIComponent(`${p.jp} ${hotel.city.split(' ')[0]}`)}" target="_blank" rel="noopener">Map</a>
        </div>
        ${placeCounts[i] ? `<p class="sub">${esc(who('place', p.id).join(', '))}</p>` : ''}
      </div>`).join('')}</div>` : '<p class="empty">No picks for this night. We will be travelling or at the park.</p>'}
      <p class="sub" style="margin-top:12px">Open hours change, so check the map before walking over. Tap your vote again to take it back.</p>
    </div>
    ${syncLine()}
    <div class="end-space"></div>
  </div>`;
}

/* ---------- settings ---------- */
function settings() {
  const me = S.me();
  const p = S.pushPrefs();
  const sw = (key, label, sub) => `<label class="switch-row"><span class="grow"><b>${label}</b><small>${sub}</small></span><input type="checkbox" class="switch" data-pref="${key}"${p[key] ? ' checked' : ''}></label>`;
  return `<div class="screen">
    ${header('Settings', 'For this phone, plus the family checklists.', 'var(--ink)')}
    <div class="section"><p class="section-title">Notifications</p>
      ${pushOn() ? `<div class="card">${sw('remind', 'Morning reminders', '10 minutes before each morning plan time')}${sw('chat', 'Message alerts', 'When someone sends a family message')}</div>` : remindCard().replace('class="note', 'class="note flush')}
    </div>
    <div class="section"><p class="section-title">Family</p><div class="stack tight">
      <a class="card card-link" href="#/apps">${I.phone(36)}<span class="grow"><span class="title" style="display:block">Travel apps</span><span class="sub" style="display:block">The apps we need, and who has them</span></span>${I.chevron()}</a>
      <a class="card card-link" href="#/passports">${I.passport(36)}<span class="grow"><span class="title" style="display:block">Passports</span><span class="sub" style="display:block">Locked. Only parents can see everyone's.</span></span>${I.chevron()}</a>
    </div></div>
    <div class="section"><p class="section-title">This phone</p><div class="stack tight">
      <a class="card card-link" href="#/me">${I.chat(36)}<span class="grow"><span class="title" style="display:block">Who are you?</span><span class="sub" style="display:block">${me ? `Set to ${esc(me)}` : 'Not set yet'}</span></span>${I.chevron()}</a>
      <a class="card card-link" href="#/parent">${I.lock(36)}<span class="grow"><span class="title" style="display:block">Parent mode</span><span class="sub" style="display:block">${S.parent() ? `On (${esc(S.parent())})` : 'Off'}</span></span>${I.chevron()}</a>
    </div></div>
    ${syncLine()}
    <div class="end-space"></div>
  </div>`;
}

/* ---------- travel apps checklist ---------- */
const APPS = [
  { id: 'suica', name: 'Suica in Apple Wallet', who: 'all', why: 'Tap on trains and buses, and pay at 7-Eleven. In the Wallet app tap +, then Transit Card, then Suica.', search: '' },
  { id: 'vjw', name: 'Visit Japan Web', who: 'parents', why: 'Immigration and customs QR codes for arriving in Japan. A parent can add the whole family.', link: 'https://www.vjw.digital.go.jp/' },
  { id: 'cathay', name: 'Cathay Pacific', who: 'all', why: 'Check in and boarding passes for our flights.', search: 'Cathay Pacific' },
  { id: 'gmaps', name: 'Google Maps', who: 'all', why: 'Best for train times and walking directions in Japan.', search: 'Google Maps' },
  { id: 'translate', name: 'Google Translate', who: 'all', why: 'Point the camera at a sign or menu to read it in English.', search: 'Google Translate' },
  { id: 'disney', name: 'Tokyo Disney Resort', who: 'all', why: 'Park tickets, wait times and ride passes at Disneyland and DisneySea.', search: 'Tokyo Disney Resort' },
  { id: 'usj', name: 'Universal Studios Japan', who: 'parents', why: 'Book Super Nintendo World entry as soon as we are inside the park.', search: 'Universal Studios Japan' },
  { id: 'klook', name: 'Klook', who: 'parents', why: 'Where our Universal and Disney tickets were bought.', search: 'Klook' },
  { id: 'smartex', name: 'SmartEX', who: 'parents', why: 'Our bullet train bookings and seats.', search: 'SmartEX' }
];
const appLink = (a) => a.link || (a.search ? `https://apps.apple.com/au/search?term=${encodeURIComponent(a.search)}` : '');
function appsScreen() {
  const me = S.me();
  if (!me) return whoGate('Travel apps', 'var(--ink)');
  const got = S.apps();
  const has = (a, n) => !!((got[a.id] || {})[n]);
  const isParent = !!S.parent();
  const needs = (a, n) => a.who === 'all' || T.parents.includes(n);
  const mine = APPS.filter((a) => needs(a, me));
  const grid = isParent ? `<div class="section"><p class="section-title">Who has what</p>
    <div class="card app-grid-wrap"><table class="app-grid"><thead><tr><th></th>${NAMES().map((n) => `<th><span>${esc(n)}</span></th>`).join('')}</tr></thead>
    <tbody>${APPS.map((a) => `<tr><th>${esc(a.name)}</th>${NAMES().map((n) => needs(a, n) ? `<td><button type="button" class="cell${has(a, n) ? ' yes' : ''}" data-app="${a.id}|${esc(n)}" aria-label="${esc(n)} ${esc(a.name)}">${has(a, n) ? '✓' : ''}</button></td>` : '<td class="na">·</td>').join('')}</tr>`).join('')}</tbody></table></div>
    <p class="sub" style="margin-top:8px">Tap a box to tick it for someone. A dot means they don't need it.</p></div>` : '';
  return `<div class="screen">
    ${header('Travel apps', 'Get these before we fly, then tick them off.', 'var(--ink)')}
    <div class="section"><div class="stack tight">${mine.map((a) => `<div class="card pad app-row">
      <div class="row" style="align-items:flex-start"><div class="grow"><p class="title">${esc(a.name)}</p><p class="sub">${esc(a.why)}</p></div>
      <button type="button" class="vote-btn" data-app="${a.id}|${esc(me)}" aria-pressed="${has(a, me)}">${has(a, me) ? '✓ Got it' : 'Got it?'}</button></div>
      ${appLink(a) ? `<a class="map-btn" style="margin-top:10px" href="${appLink(a)}" target="_blank" rel="noopener">${a.link ? 'Open the website' : 'Find it in the App Store'}</a>` : ''}
    </div>`).join('')}</div></div>
    ${grid}
    ${syncLine()}
    <div class="end-space"></div>
  </div>`;
}

/* ---------- passports ----------
   Each passport is scrambled on the phone with the family's passport lock before it is saved.
   Anyone can lock their own passport in; only the parent password can open them all. */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let vaultKey = null; // the opened private key, while the app is open
async function passKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function lockFor(pub, obj) {
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const d = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(obj)));
  const pk = await crypto.subtle.importKey('spki', unb64(pub), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pk, await crypto.subtle.exportKey('raw', k));
  return JSON.stringify({ k: b64(wrapped), iv: b64(iv), d: b64(d) });
}
async function unlockBox(box) {
  const b = JSON.parse(box);
  const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, vaultKey, unb64(b.k));
  const k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, k, unb64(b.d))));
}
async function openVault(password, lock) {
  const k = await passKey(password, unb64(lock.salt));
  const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(lock.iv) }, k, unb64(lock.priv));
  vaultKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
}
async function makeVault(password) {
  const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await passKey(password, salt);
  const priv = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const lock = { pub: b64(await crypto.subtle.exportKey('spki', pair.publicKey)), priv: b64(priv), salt: b64(salt), iv: b64(iv) };
  await S.vaultPut('lock', lock);
  vaultKey = pair.privateKey;
  return lock;
}

const PP_FIELDS = [['given', 'Given names'], ['surname', 'Surname'], ['number', 'Passport number'], ['nationality', 'Nationality'], ['dob', 'Date of birth'], ['issued', 'Date of issue'], ['expires', 'Date of expiry']];
const myPassport = () => { try { return JSON.parse(localStorage.getItem('myPassport')) || null; } catch { return null; } };
let ppState = { lock: undefined, people: {}, editing: null, error: '' };

function passports() {
  const me = S.me();
  if (!me) return whoGate('Passports', 'var(--ink)');
  const isParent = !!S.parent();
  const lock = ppState.lock;
  let body;
  if (lock === undefined) body = '<p class="empty">Opening…</p>';
  else if (!lock) {
    body = isParent
      ? `<form class="section stack" id="ppsetup"><div class="card pad"><p class="title">Choose the passport password</p>
          <p class="sub" style="margin-top:6px">Steve, Katrina and Kim will all use it. At least 8 letters or numbers. Don't write it in the app or in messages: tell the other parents in person.</p>
          <input class="text-input" type="password" name="p1" minlength="8" autocomplete="new-password" placeholder="Password" required>
          <input class="text-input" type="password" name="p2" minlength="8" autocomplete="new-password" placeholder="Type it again" required></div>
          <p class="err-inline">${esc(ppState.error)}</p>
          <button class="btn" type="submit">${I.lock(20)} Lock passports with this password</button></form>`
      : '<div class="note note-yellow"><div><p class="title">Not ready yet</p><p>A parent needs to set up the passport lock first.</p></div></div>';
  } else if (ppState.editing) {
    const who = ppState.editing;
    const cur = (who === me && myPassport()) || ppState.people[who] || {};
    body = `<form class="section stack" id="ppform" data-who="${esc(who)}"><div class="card pad">
        <p class="title">${esc(who)}'s passport</p><p class="sub" style="margin-top:4px">Type it exactly as it's printed on the photo page.</p>
        ${PP_FIELDS.map(([k, l]) => `<label class="field"><span>${l}</span><input class="text-input" name="${k}" value="${esc(cur[k] || '')}" ${k === 'dob' || k === 'issued' || k === 'expires' ? 'placeholder="e.g. 14 MAR 2031"' : ''} autocomplete="off" autocapitalize="characters" required></label>`).join('')}
      </div>
      <button class="btn" type="submit">${I.lock(20)} Lock it in</button>
      <button class="btn ink" type="button" data-act="pp-cancel">Cancel</button></form>`;
  } else {
    const mine = myPassport();
    const saved = new Set(Object.keys(ppState.people).concat(ppState.savedNames || []));
    const card = (n, p) => `<div class="card pad pp-card"><div class="row"><p class="title grow">${esc(n)}</p>${isParent || n === me ? `<button type="button" class="link-btn" data-pp-edit="${esc(n)}" style="color:var(--blue)">${p || (ppState.savedNames || []).includes(n) ? 'Change' : 'Add'}</button>` : ''}</div>
      ${p ? `<dl class="pp">${PP_FIELDS.map(([k, l]) => `<div><dt>${l}</dt><dd${k === 'number' ? ` data-copy="${esc(p[k])}"` : ''}>${esc(p[k])}</dd></div>`).join('')}</dl>` : `<p class="sub">${saved.has(n) ? 'Saved and locked.' : 'Not added yet.'}</p>`}
    </div>`;
    body = isParent && !vaultKey
      ? `<form class="section stack" id="ppopen"><div class="card pad"><p class="title">Open everyone's passports</p>
          <input class="text-input" type="password" name="p" autocomplete="current-password" placeholder="Passport password" required></div>
          <p class="err-inline">${esc(ppState.error)}</p>
          <button class="btn" type="submit">${I.lock(20)} Open</button></form>
          <div class="section">${card(me, mine)}</div>`
      : isParent
        ? `<div class="section stack tight">${NAMES().map((n) => card(n, ppState.people[n])).join('')}</div>`
        : `<div class="section">${card(me, mine)}${mine ? '' : `<button class="btn" type="button" data-pp-edit="${esc(me)}">Add my passport</button>`}</div>`;
  }
  return `<div class="screen">
    ${header('Passports', 'Scrambled before they leave the phone. Only the parent password opens them all.', 'var(--ink)')}
    ${body}
    <p class="small-print">Your own passport also stays on your phone, so it works with no internet. Tap a passport number to copy it.</p>
    <div class="end-space"></div>
  </div>`;
}
async function loadPassports() {
  if (!location.hash.startsWith('#/passports')) return;
  const lock = await S.vaultGet('lock');
  const people = {};
  const savedNames = [];
  for (const n of NAMES()) {
    const d = await S.vaultGet(`pp-${n}`);
    if (d && d.box) { savedNames.push(n); if (vaultKey) { try { people[n] = await unlockBox(d.box); } catch { /* wrong key */ } } }
  }
  const changed = JSON.stringify([lock, people, savedNames]) !== JSON.stringify([ppState.lock, ppState.people, ppState.savedNames]);
  ppState = { ...ppState, lock: lock || null, people, savedNames };
  if (changed && location.hash.startsWith('#/passports')) render();
}

/* ---------- coming up: everything in the next 24 hours ---------- */
const clockOf = (s, fallback) => {
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(s || '');
  if (m) { let h = Number(m[1]) % 12; if (m[3].toLowerCase() === 'pm') h += 12; return h * 60 + Number(m[2]); }
  if (/morning/i.test(s || '')) return 9 * 60;
  if (/afternoon/i.test(s || '')) return 14 * 60;
  return fallback;
};
const showClock = (mins) => `${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')}${mins < 720 ? 'am' : 'pm'}`;
function itemsFor(date) {
  const out = [];
  const add = (mins, icon, title, sub, href) => out.push({ date, mins, icon, title, sub, href });
  const m = morningFor(date);
  if (m) S.timesFor(m).forEach((t) => add(clockOf(t.time, 360), TIME_ICON[t.kind] ? TIME_ICON[t.kind]() : I.clock(36), t.title, t.detail, `#/morning/${date}`));
  T.journeys.filter((j) => j.date === date).forEach((j) => {
    const first = j.steps.map((s) => clockOf(s.time, null)).find((x) => x !== null);
    add(first ?? 9 * 60, I.kindTile(j.kind, 40, true), j.title, j.sub, `#/journey/${j.id}`);
  });
  T.hotels.filter((h) => h.checkOut === date).forEach((h) => add(clockOf(h.checkOutTime, 660), I.hotel(36), `Check out of ${h.short}`, `By ${h.checkOutTime}. Check under the beds!`, `#/hotel/${h.id}`));
  T.hotels.filter((h) => h.checkIn === date).forEach((h) => add(clockOf(h.checkInTime, 900), I.hotel(36), `Check in at ${h.short}`, `Check-in ${h.checkInTime}`, `#/hotel/${h.id}`));
  ((T.bags || {}).sends || []).filter((s) => s.date === date && s.status === 'planned').forEach((s) => add(clockOf(s.readyBy, 540), I.truck(36), 'Big suitcases go to the front desk', s.readyWhere, `#/send/${s.id}`));
  T.places.filter((p) => p.date === date).forEach((p) => add(-1, `<img class="ci-img" src="${p.img}" alt="">`, p.name, p.note, '#/places'));
  if (hotelFor(date) && (T.dinners || {})[hotelFor(date).id]) {
    const v = S.votes(date);
    const picks = T.dinners[hotelFor(date).id];
    const count = (id) => Object.values(v).filter((x) => x && x.place === id).length;
    const best = picks.slice().sort((a, b) => count(b.id) - count(a.id))[0];
    add(18 * 60 + 30, '<span class="big-emoji">🍜</span>', 'Dinner', best && count(best.id) ? `${best.name} is winning the vote` : 'Vote for where to eat', `#/dinner/${date}`);
  }
  return out;
}
function comingUp() {
  const now = new Date();
  const t = today();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const tom = iso(new Date(parse(t).getTime() + 86400000));
  const list = [...itemsFor(t).filter((x) => x.mins < 0 || x.mins >= nowMins - 30), ...itemsFor(tom).filter((x) => x.mins < 0 || x.mins <= nowMins)];
  const group = (d, label) => {
    const its = list.filter((x) => x.date === d).sort((a, b) => a.mins - b.mins);
    if (!its.length) return '';
    return `<div class="section"><p class="day-label up-day">${label} · ${fmt(d)}</p>
      <div class="up-list">${its.map((x) => `<a class="up-item" href="${x.href}"><span class="up-time">${x.mins < 0 ? 'All day' : showClock(x.mins)}</span><span class="up-ico">${x.icon}</span><span class="grow"><b>${esc(x.title)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></a>`).join('')}</div></div>`;
  };
  const body = group(t, 'Today') + group(tom, 'Tomorrow');
  return `<div class="screen">
    ${header('Coming up', 'Everything in the next 24 hours. Check it the night before!', 'var(--red)')}
    <div class="section"><div class="stack tight" data-weather="next"><p class="sub">Loading the weather…</p></div></div>
    ${body || '<p class="empty">Nothing planned in the next 24 hours. Enjoy!</p>'}
    <div class="end-space"></div>
  </div>`;
}

/* phone notifications: morning reminders and new messages */
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const standalone = () => window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
const pushOn = () => pushSupported() && Notification.permission === 'granted' && S.pushSaved();
function remindCard() {
  if (pushOn()) return `<div class="note note-green">${I.bell(36)}<div><p class="title">Reminders are on</p><p>This phone buzzes 10 minutes before each morning plan time, and when someone sends a message.</p></div></div>`;
  if (!pushSupported()) {
    const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return `<div class="note note-yellow">${I.bell(36)}<div><p class="title">Reminders</p><p>${apple && !standalone() ? 'To get reminders, open the app from its Home Screen icon, then turn them on here.' : 'This phone or browser can not get reminders from the app.'}</p></div></div>`;
  }
  if (Notification.permission === 'denied') return `<div class="note note-yellow">${I.bell(36)}<div><p class="title">Reminders are blocked</p><p>On iPhone: open Settings, then Notifications, then Japan 2026, and switch on Allow Notifications.</p></div></div>`;
  return `<div class="note note-blue">${I.bell(36)}<div class="grow"><p class="title">Turn on reminders</p><p>Get a buzz 10 minutes before each morning plan time, and when someone sends a message.</p><button type="button" class="btn" data-act="push-on" style="margin-top:10px;min-height:48px;font-size:17px">Turn on reminders</button></div></div>`;
}
const b64u = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); return Uint8Array.from(atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)); };
async function turnOnPush(btn) {
  btn.disabled = true;
  btn.textContent = 'Turning on…';
  try {
    // Ask first: iPhones only show the question straight after a tap.
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('denied');
    const key = await S.pushKey();
    if (!key) throw new Error('nokey');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    S.savePush(hash, JSON.stringify(sub));
    flash(btn, 'Reminders are on');
  } catch (e) {
    flash(btn, e.message === 'denied' ? 'Notifications were not allowed.' : e.message === 'nokey' ? 'Not ready yet. Steve is still switching reminders on.' : 'Could not turn them on. Try again with internet.');
  }
  render();
}

function familyTiles() {
  const n = unread();
  return `<div class="section"><p class="section-title">Family</p><div class="fam-tiles">
    <a href="#/chat" style="background:#D7F2E6">${I.chat(40)}<span>Messages</span>${n ? `<b class="count-dot">${n}</b>` : ''}</a>
    <a href="#/shout" style="background:#FFF3C4">${I.coins(40)}<span>Shout</span></a>
    <a href="#/diary" style="background:#FFD6E4">${I.photoBook(40)}<span>Photo diary</span></a>
    <a href="#/dinner" style="background:#FFE0DB"><span class="big-emoji" style="font-size:34px">🍜</span><span>Dinner vote</span></a>
  </div></div>${pushOn() ? '' : remindCard()}`;
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
  { id: 'home', label: 'Home', icon: I.tab.home, match: ['home', 'hotels', 'hotel', 'places', 'phrases', 'weather', 'mornings', 'morning', 'parent', 'chat', 'shout', 'shoutadd', 'diary', 'me', 'dinner', 'settings', 'apps', 'passports', 'next', 'money'] },
  { id: 'trip', label: 'Trip', icon: I.tab.trip, match: ['trip', 'journey', 'map'] },
  { id: 'bags', label: 'Bags', icon: I.tab.bags, match: ['bags', 'bagday', 'send'] },
  { id: 'tickets', label: 'Tickets', icon: I.tab.tickets, match: ['tickets', 'ticket'] }
];
// Where the floating back button goes from each screen.
const BACK = {
  journey: ['#/trip', 'Trip'], morning: ['#/mornings', 'Mornings'], hotel: ['#/hotels', 'Hotels'], bagday: ['#/bags', 'Bags'], send: ['#/bags', 'Bags'], ticket: ['#/tickets', 'Tickets'], shoutadd: ['#/shout', 'Shout'], apps: ['#/settings', 'Settings'], passports: ['#/settings', 'Settings'], map: ['#/trip', 'Trip']
};

const mapCtx = () => ({ T, I, esc, fmt, header, hotelFor });

function render() {
  const [, name = 'home', arg] = (location.hash || '#/home').split('/');
  const screens = {
    home, trip, bags, hotels, places, tickets, phrases, weather: weatherScreen, mornings, parent: parentScreen, chat, shout, shoutadd: shoutAdd, diary, me: meScreen, dinner: () => dinner(arg), settings, apps: appsScreen, passports, next: comingUp, money: () => moneyScreen(header), map: () => mapScreen(mapCtx()),
    journey: () => journey(arg), hotel: () => hotelPage(arg), send: () => sendPage(arg), bagday: () => bagDay(arg), ticket: () => ticketPage(arg), morning: () => morning(arg)
  };
  const view = (screens[name] || notFound)();
  const current = TABS.find((t) => t.match.includes(name));
  const [backTo, backLabel] = BACK[name] || ['#/home', 'Home'];
  const fab = name === 'home' ? '' : `<a class="back-fab" href="${backTo}">${I.back()} ${backLabel}</a>`;
  app.innerHTML = fab + view + `<div class="tabbar"><nav aria-label="Main">${TABS.map((t) => `<a href="#/${t.id}"${current === t ? ' aria-current="page"' : ''}>${t.icon}${t.label}</a>`).join('')}</nav></div>`;
  document.title = name === 'home' ? 'Japan 2026' : `${(app.querySelector('h1') || {}).textContent || 'Japan 2026'} · Japan 2026`;
  hydrate();
  hydrateWeather();
  if (name === 'passports') loadPassports();
  if (name === 'money') wireMoney(app);
  if (name === 'map') wireMap(app, mapCtx());
  if (name === 'chat') requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
}

// One listener for every button on every screen.
app.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-filter],[data-big],[data-copy],[data-remove],[data-zoom],[data-ready],[data-act],[data-me],[data-preset],[data-unshout],[data-undiary],[data-full],[data-vote],[data-day],[data-app],[data-pp-edit]');
  if (!t) return;
  const act = t.dataset.act;
  if (t.dataset.me) { S.setMe(t.dataset.me); if (location.hash === '#/me') location.hash = '#/home'; else render(); return; }
  if (t.dataset.app) { const [a, n] = t.dataset.app.split('|'); S.toggleApp(a, n); render(); return; }
  if (t.dataset.ppEdit) { ppState.editing = t.dataset.ppEdit; render(); window.scrollTo(0, 0); return; }
  if (act === 'pp-cancel') { ppState.editing = null; render(); return; }
  if (t.dataset.day) { const d = t.dataset.day; if (closedDays.has(d)) closedDays.delete(d); else closedDays.add(d); render(); return; }
  if (act === 'open-all') { closedDays = new Set(); render(); return; }
  if (act === 'close-all') { closedDays = new Set(T.journeys.map((j) => j.date)); render(); return; }
  if (t.dataset.vote) { const [d, kind, val] = t.dataset.vote.split('|'); S.vote(d, S.me(), kind, val); render(); return; }
  if (t.dataset.preset) {
    const p = t.dataset.preset;
    t.closest('form').querySelectorAll('input[name=among]').forEach((c) => { c.checked = p === 'all' || familyOf(c.value) === p; });
    return;
  }
  if (t.dataset.unshout || t.dataset.undiary) {
    if (!t.dataset.armed) { t.dataset.armed = '1'; t.textContent = 'Tap again to remove'; return; }
    if (t.dataset.unshout) S.removeShout(t.dataset.unshout); else S.removeDiaryPhoto(t.dataset.undiary);
    render();
    return;
  }
  if (t.dataset.full) {
    const img = t.querySelector('img');
    zoom(img.src);
    const big = await S.fullPhoto(t.dataset.full);
    const shown = document.querySelector('.photo-zoom img');
    if (big && shown) shown.src = big;
    return;
  }
  if (t.dataset.ready) { const [d, n] = t.dataset.ready.split('|'); S.toggleReady(d, n); render(); return; }
  if (act === 'edit-times') { editing = location.hash.split('/')[2]; render(); return; }
  if (act === 'cancel-edit') { editing = null; render(); return; }
  if (act === 'reset-times') { S.resetTimes(editing); editing = null; render(); return; }
  if (act === 'push-on') { turnOnPush(t); return; }
  if (act === 'leave-parent') { S.leaveParent(); render(); return; }
  if (act) return;
  if (t.dataset.filter) { tripFilter = t.dataset.filter; render(); }
  else if (t.dataset.big) showBig(t.dataset.big);
  else if (t.dataset.copy) {
    try { await navigator.clipboard.writeText(t.dataset.copy); flash(t, 'Copied'); } catch { flash(t, 'Press and hold to copy'); }
  } else if (t.dataset.remove) {
    await removePhoto(Number(t.dataset.remove));
    hydrate();
  } else if ('zoom' in t.dataset) zoom(t.src, 'qr' in t.dataset, t.dataset.caption);
});
app.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'pinform') {
    const ok = await S.checkPin(T, f.querySelector('#pin').value);
    if (!ok) { f.querySelector('#pinerr').textContent = 'That PIN did not work. Try again.'; return; }
    S.setParent(f.querySelector('input[name=who]:checked').value);
    render();
  } else if (f.id === 'ppsetup') {
    if (f.p1.value !== f.p2.value) { ppState.error = 'The two passwords are different. Try again.'; render(); return; }
    f.querySelector('button').disabled = true;
    ppState.lock = await makeVault(f.p1.value);
    ppState.error = '';
    render();
  } else if (f.id === 'ppopen') {
    f.querySelector('button').textContent = 'Opening…';
    try { await openVault(f.p.value, ppState.lock); ppState.error = ''; } catch { ppState.error = 'That password did not work.'; }
    render();
    loadPassports();
  } else if (f.id === 'ppform') {
    const who = f.dataset.who;
    const data = Object.fromEntries(PP_FIELDS.map(([k]) => [k, String(new FormData(f).get(k) || '').trim().toUpperCase()]));
    f.querySelector('button[type=submit]').disabled = true;
    await S.vaultPut(`pp-${who}`, { box: await lockFor(ppState.lock.pub, data) });
    if (who === S.me()) { try { localStorage.setItem('myPassport', JSON.stringify(data)); } catch { /* ignore */ } }
    if (vaultKey) ppState.people[who] = data;
    ppState.savedNames = [...new Set([...(ppState.savedNames || []), who])];
    ppState.editing = null;
    render();
  } else if (f.id === 'chatform') {
    const text = f.text.value.trim();
    if (!text) return;
    S.sendMessage(text);
    render();
  } else if (f.id === 'shoutform') {
    const fd = new FormData(f);
    const cur = fd.get('cur');
    const amount = Number(String(fd.get('amount')).replace(/[^0-9.]/g, ''));
    const among = fd.getAll('among');
    const err = f.querySelector('#shouterr');
    if (!(amount > 0)) { err.textContent = 'Type how much it cost.'; return; }
    if (!among.length) { err.textContent = 'Tick at least one person it was for.'; return; }
    S.addShout({ what: String(fd.get('what')).trim(), amount: cur === 'JPY' ? Math.round(amount) : Math.round(amount * 100) / 100, cur, by: fd.get('by'), among: among.length === NAMES().length ? [] : among });
    location.hash = '#/shout';
  } else if (f.id === 'timeform') {
    const m = morningFor(f.dataset.date);
    const fd = new FormData(f);
    const times = S.timesFor(m).map((t, i) => ({ ...t, time: to12(fd.get(`time${i}`)), title: String(fd.get(`title${i}`)).trim() || t.title }));
    S.saveTimes(m.date, times);
    editing = null;
    render();
  }
});
app.addEventListener('change', async (e) => {
  if (e.target.dataset.pref) { S.setPushPref(e.target.dataset.pref, e.target.checked); return; }
  const pick = e.target.closest('[data-diary]');
  if (pick && pick.files.length) { const file = pick.files[0]; pick.value = ''; diaryPrompt(file); return; }
  const input = e.target.closest('[data-add]');
  if (!input || !input.files.length) return;
  for (const f of input.files) await addPhoto(input.dataset.add, await shrink(f));
  input.value = '';
  hydrate();
});
function flash(el, text) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

// Re-draw the screen when the family changes something, unless someone is typing.
const QUIET = ['shoutadd', 'parent', 'passports', 'money', 'map'];
let redrawLater = false;
const typing = () => { const a = document.activeElement; return !!(a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio'); };
function redraw() {
  const name = (location.hash || '#/home').split('/')[1] || 'home';
  if (editing || QUIET.includes(name) || document.querySelector('.sheet') || typing()) { redrawLater = true; return; }
  redrawLater = false;
  render();
}
app.addEventListener('focusout', () => { if (redrawLater) setTimeout(redraw, 400); });

async function start() {
  if (!started) {
    S.onChange(redraw);
    await S.start(T);
    window.addEventListener('hashchange', () => { editing = null; render(); window.scrollTo(0, 0); S.sync(); });
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

// Swipe left or right on a journey to go to the next or previous one.
let swipeStart = null;
app.addEventListener('touchstart', (e) => {
  swipeStart = location.hash.startsWith('#/journey/') && e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY] : null;
}, { passive: true });
app.addEventListener('touchend', (e) => {
  if (!swipeStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipeStart[0];
  const dy = t.clientY - swipeStart[1];
  swipeStart = null;
  if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;
  const link = app.querySelector(`.jnav[data-swipe="${dx < 0 ? 'next' : 'prev'}"]`);
  if (link) { location.hash = link.getAttribute('href'); window.scrollTo(0, 0); }
}, { passive: true });
