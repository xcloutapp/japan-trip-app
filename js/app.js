import * as I from './icons.js';
import { unlock, savedCode, forgetCode, openFile } from './lock.js';
import { addPhoto, removePhoto, photosFor, shrink } from './store.js';

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
      <a class="big-tile small" href="#/phrases" style="background:#D6F1F8"><span class="say" lang="ja">こんにちは</span><span>Phrases and translate</span></a>
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
    ? `<div class="photo-head"><img src="${j.photo}" alt=""></div>`
    : `<div class="plain-head" style="background:${k.tint}"><div style="display:flex;justify-content:flex-end">${I.kindTile(j.kind, 96)}</div></div>`;

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
    ${bagNote}
    ${j.tip ? `<div class="note note-yellow"><div><p class="title">Tip</p><p>${esc(j.tip)}</p></div></div>` : ''}
    <div class="steps">${steps}</div>
    ${helpers ? `<div style="padding-top:4px">${helpers}</div>` : ''}
    ${todo.length ? '<p class="small-print">Times are examples until the tickets are booked.</p>' : ''}
    ${tonight && isLastOfDay ? `<div class="section"><a class="card card-link" href="#/hotel/${tonight.id}">${I.hotel(40)}<span class="grow"><span class="eyebrow" style="display:block">Tonight</span><span class="title" style="display:block">${esc(tonight.short)}</span></span>${I.chevron()}</a></div>` : ''}
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
  return `<div class="screen">
    ${header(esc(k.title), `${fmt(k.date)} · ${esc(k.detail)}`, '#FFC93C', true)}
    ${k.print ? `<div class="note note-yellow">${I.printer(36)}<div><p class="title">Print these before we go</p><p>The gates only take paper tickets.</p></div></div>` : ''}
    ${(k.refs || []).length ? `<div class="section"><div class="stack tight">${k.refs.map((r) => `<button type="button" class="card ref-card" data-copy="${esc(r.value)}"><span class="eyebrow">${esc(r.label)}</span><span class="ref-big">${esc(r.value)}</span><span class="copy-hint">Tap to copy</span></button>`).join('')}</div></div>` : ''}
    ${(k.people || []).length ? `<div class="section"><p class="section-title">${esc(k.people[0].label)} for each person</p><div class="card phrase-list">${k.people.map((p) => `<button type="button" class="phrase" data-copy="${esc(p.value)}"><span class="grow en">${esc(p.name)}</span><span class="mono">${esc(p.value)}</span></button>`).join('')}</div></div>` : ''}
    ${(k.files || []).length ? `<div class="section"><p class="section-title">Tickets and QR codes</p><div class="stack">${k.files.map((f) => `<figure class="card ticket-pic"><img data-file="${f.src}" alt="${esc(f.label)}"><figcaption>${esc(f.label)}</figcaption></figure>`).join('')}</div></div>` : ''}
    ${(k.notes || []).length ? `<div class="section"><div class="card pad"><ul class="bullets">${k.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
    <div class="section"><p class="section-title">On this phone</p>
      <div class="local-photos" data-photos="${k.id}"></div>
      <label class="btn ink add-photo">Add a photo or screenshot<input type="file" accept="image/*" data-add="${k.id}" hidden></label>
      <p class="sub" style="margin-top:8px">Only you see these. Handy for your own ticket screenshot. They work with no internet.</p>
    </div>
    <div class="end-space"></div>
  </div>`;
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

function zoom(src) {
  const el = document.createElement('div');
  el.className = 'big-show photo-zoom';
  el.innerHTML = `<img src="${src}" alt=""><div class="big-actions"><button type="button" data-act="close">Close</button></div>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
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
  { id: 'home', label: 'Home', icon: I.tab.home, match: ['home', 'hotels', 'hotel', 'places', 'phrases'] },
  { id: 'trip', label: 'Trip', icon: I.tab.trip, match: ['trip', 'journey'] },
  { id: 'bags', label: 'Bags', icon: I.tab.bags, match: ['bags', 'bagday', 'send'] },
  { id: 'tickets', label: 'Tickets', icon: I.tab.tickets, match: ['tickets', 'ticket'] }
];
// Where the floating back button goes from each screen.
const BACK = {
  journey: ['#/trip', 'Trip'], hotel: ['#/hotels', 'Hotels'], bagday: ['#/bags', 'Bags'], send: ['#/bags', 'Bags'], ticket: ['#/tickets', 'Tickets']
};

function render() {
  const [, name = 'home', arg] = (location.hash || '#/home').split('/');
  const screens = {
    home, trip, bags, hotels, places, tickets, phrases,
    journey: () => journey(arg), hotel: () => hotelPage(arg), send: () => sendPage(arg), bagday: () => bagDay(arg), ticket: () => ticketPage(arg)
  };
  const view = (screens[name] || notFound)();
  const current = TABS.find((t) => t.match.includes(name));
  const [backTo, backLabel] = BACK[name] || ['#/home', 'Home'];
  const fab = name === 'home' ? '' : `<a class="back-fab" href="${backTo}">${I.back()} ${backLabel}</a>`;
  app.innerHTML = fab + view + `<div class="tabbar"><nav aria-label="Main">${TABS.map((t) => `<a href="#/${t.id}"${current === t ? ' aria-current="page"' : ''}>${t.icon}${t.label}</a>`).join('')}</nav></div>`;
  document.title = name === 'home' ? 'Japan 2026' : `${(app.querySelector('h1') || {}).textContent || 'Japan 2026'} · Japan 2026`;
  hydrate();
}

// One listener for every button on every screen.
app.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-filter],[data-big],[data-copy],[data-remove],[data-zoom]');
  if (!t) return;
  if (t.dataset.filter) { tripFilter = t.dataset.filter; render(); }
  else if (t.dataset.big) showBig(t.dataset.big);
  else if (t.dataset.copy) {
    try { await navigator.clipboard.writeText(t.dataset.copy); flash(t, 'Copied'); } catch { flash(t, 'Press and hold to copy'); }
  } else if (t.dataset.remove) {
    await removePhoto(Number(t.dataset.remove));
    hydrate();
  } else if ('zoom' in t.dataset) zoom(t.src);
});
app.addEventListener('change', async (e) => {
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
