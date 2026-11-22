// Trip map: a drawing of Japan with our hotels and routes. It is drawn by the app itself
// (no map website), so it works with no internet. Outline of Japan: Global Map Japan (GSI).
let land = null;           // rings of [x, y] in map units, loaded once
let st = { day: null, sel: null, view: null, me: null };

const K = 100;
const COS = Math.cos((35 * Math.PI) / 180);
const proj = ([lon, lat]) => [(lon - 136) * COS * K, -(lat - 35) * K];

async function loadLand() {
  if (land) return land;
  const j = await (await fetch('img/japan-map.json')).json();
  land = j.rings.map((r) => r.split(' ').map((p) => proj(p.split(',').map(Number))));
  return land;
}

export function mapScreen({ T, I, esc, fmt, header }) {
  const M = T.map;
  if (!M) return `<div class="screen">${header('Trip map', 'Not ready yet', '#0E7FA0')}</div>`;
  const dates = [...new Set(M.routes.map((r) => (T.journeys.find((j) => j.id === r[0]) || {}).date).filter(Boolean))].sort();
  const short = (d) => fmt(d).replace(/ Dec$/, '');
  const legend = ['bullet', 'metro', 'bus', 'van', 'plane'].map((k) => `<span><i class="lg-${k}" style="background:${I.KIND[k].color}"></i>${I.KIND[k].label}</span>`).join('');
  return `<div class="screen map-screen">
    ${header('Our trip map', `${T.hotels.length} hotels · pinch or tap + to zoom`, '#0E7FA0')}
    <div class="map-days" role="group" aria-label="Show">
      <button type="button" class="chip" data-mapday="" aria-pressed="${!st.day}">Whole trip</button>
      ${dates.map((d) => `<button type="button" class="chip" data-mapday="${d}" aria-pressed="${st.day === d}">${esc(short(d))}</button>`).join('')}
    </div>
    <div class="map-box" id="map-box">
      <svg id="map-svg" role="img" aria-label="Map of Japan with our trip"></svg>
      <div class="map-zoom"><button type="button" data-mapzoom="in" aria-label="Zoom in">+</button><button type="button" data-mapzoom="out" aria-label="Zoom out">−</button></div>
      <button type="button" class="map-me" data-mapme>◎ Where am I?</button>
      <p class="map-toast" id="map-toast" hidden></p>
    </div>
    <div id="map-below"></div>
    <div class="map-legend">${legend}</div>
    <p class="small-print">Map outline: Global Map Japan (GSI).</p>
    <div class="end-space"></div>
  </div>`;
}

export async function wireMap(root, ctx) {
  const { T, I, esc, fmt, hotelFor } = ctx;
  const M = T.map;
  const svg = root.querySelector('#map-svg');
  const box = root.querySelector('#map-box');
  if (!M || !svg) return;
  const P = Object.fromEntries(Object.entries(M.places).map(([k, v]) => [k, { xy: proj(v), label: v[2] }]));
  const jdate = (id) => (T.journeys.find((j) => j.id === id) || {}).date;
  const routes = M.routes.map(([id, kind, via]) => ({ id, kind, date: jdate(id), pts: via.map((p) => P[p].xy), via }));
  const span = (a, b) => `${Number(a.slice(8))}–${Number(b.slice(8))} Dec`;
  const hotelPins = M.hotels.map(([id, n, label]) => {
    const h = T.hotels.find((x) => x.id === id) || {};
    return { id, n, label, xy: P[id].xy, h, a: h.checkIn, b: h.checkOut, dates: h.checkIn ? span(h.checkIn, h.checkOut) : '' };
  });
  await loadLand().catch(() => null);

  const W = () => box.clientWidth;
  const H = () => box.clientHeight;
  const fit = (pts, pad = 40) => {
    const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const s = Math.min((W() - pad * 2) / Math.max(x1 - x0, 20), (H() - pad * 2) / Math.max(y1 - y0, 20));
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.min(s, 30) };
  };
  const tripPts = () => routes.filter((r) => r.kind !== 'plane').flatMap((r) => r.pts);
  const dayPts = (d) => {
    const pts = routes.filter((r) => r.date === d && r.kind !== 'plane').flatMap((r) => r.pts);
    const h = hotelFor(d);
    if (h && P[h.id]) pts.push(P[h.id].xy);
    return pts.length ? pts : tripPts();
  };
  const minS = () => fit(tripPts()).s * 0.6;
  const toScreen = ([x, y]) => [(x - st.view.cx) * st.view.s + W() / 2, (y - st.view.cy) * st.view.s + H() / 2];

  function draw() {
    const v = st.view; const w = W(); const h = H();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const tf = `translate(${w / 2 - v.cx * v.s} ${h / 2 - v.cy * v.s}) scale(${v.s})`;
    const ring = (r) => `M${r.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`;
    const landPath = land ? `<path d="${land.map(ring).join('')}" class="map-land" vector-effect="non-scaling-stroke"/>` : '';
    const on = (r) => !st.day || r.date === st.day;
    const lines = routes.map((r) => `<polyline points="${r.pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${I.KIND[r.kind].color}" stroke-width="${on(r) ? 5 : 3.5}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity="${on(r) ? 1 : 0.2}"${r.kind === 'plane' ? ' stroke-dasharray="8 7"' : ''}/>`).join('');
    // overlay in screen pixels
    const o = [];
    const label = (x, y, t, sub, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="map-lab">${esc(t)}</text>${sub ? `<text x="${x}" y="${y + 13}" text-anchor="${anchor}" class="map-lab sub">${esc(sub)}</text>` : ''}`;
    const fj = toScreen(P.fujisan.xy);
    o.push(`<path d="M${fj[0] - 13},${fj[1] + 8} L${fj[0]},${fj[1] - 11} L${fj[0] + 13},${fj[1] + 8}Z" fill="#8A9BB5"/><path d="M${fj[0] - 5},${fj[1] - 5} L${fj[0]},${fj[1] - 11} L${fj[0] + 5},${fj[1] - 5}Z" fill="#FFFFFF"/>${st.view.s > 4 ? label(fj[0], fj[1] + 22, 'Mt Fuji') : ''}`);
    if (st.day || st.view.s > 6) {
      const near = new Set(st.day ? routes.filter((r) => r.date === st.day).flatMap((r) => r.via) : Object.keys(P));
      Object.entries(P).forEach(([k, p]) => {
        if (!p.label || k === 'fujisan' || !near.has(k)) return;
        const [x, y] = toScreen(p.xy);
        o.push(`<circle cx="${x}" cy="${y}" r="5" fill="#FFFFFF" stroke="#14213D" stroke-width="2"/>${label(x + 9, y + 4, p.label, '', 'start')}`);
      });
    }
    // hotel pins; two that sit on top of each other share one pin
    const pins = hotelPins.map((p) => ({ ...p, sxy: toScreen(p.xy) }));
    const used = new Set();
    pins.forEach((p, i) => {
      if (used.has(i)) return;
      const q = pins[i + 1];
      const merged = q && Math.hypot(q.sxy[0] - p.sxy[0], q.sxy[1] - p.sxy[1]) < 26;
      if (merged) used.add(i + 1);
      const ids = merged ? [p.id, q.id] : [p.id];
      const [x, y] = merged ? [(p.sxy[0] + q.sxy[0]) / 2, (p.sxy[1] + q.sxy[1]) / 2] : p.sxy;
      const hot = !st.day || ids.some((id) => { const h = T.hotels.find((z) => z.id === id); return h && h.checkIn <= st.day && st.day <= h.checkOut; });
      const sel = ids.includes(st.sel);
      const n = merged ? `${p.n} ${q.n}` : p.n;
      const r = merged ? 16 : 13;
      const name = merged ? (p.id === 'shinjuku' ? 'Tokyo' : `${p.label} & ${q.label}`) : p.label;
      const dates = merged ? span(p.a, q.b) : p.dates;
      if (!hot) { o.push(`<g data-mappin="${ids[0]}"><circle cx="${x}" cy="${y}" r="8" fill="#E8473C" opacity="0.35" stroke="#FFFFFF" stroke-width="2"/></g>`); return; }
      const below = y + r + 14 < H() - 10;
      o.push(`<g data-mappin="${merged ? '' : ids[0]}" class="map-pin"><circle cx="${x}" cy="${y}" r="${r + 10}" fill="transparent"/><circle cx="${x}" cy="${y}" r="${r}" fill="${sel ? '#14213D' : '#E8473C'}" stroke="#FFFFFF" stroke-width="2.5"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" class="map-num">${n}</text>${label(x, below ? y + r + 14 : y - r - 18, name, dates)}</g>`);
    });
    if (st.me) {
      const [x, y] = toScreen(proj(st.me));
      o.push(`<circle cx="${x}" cy="${y}" r="16" fill="#1E6FD9" opacity="0.18"/><circle cx="${x}" cy="${y}" r="7" fill="#1E6FD9" stroke="#FFFFFF" stroke-width="3"/>`);
    }
    svg.innerHTML = `<rect width="${w}" height="${h}" class="map-sea"/><g transform="${tf}">${landPath}${lines}</g>${o.join('')}`;
  }

  function below() {
    const el = root.querySelector('#map-below');
    if (!el) return;
    const hotelOf = (id) => T.hotels.find((h) => h.id === id);
    if (st.day) {
      const js = T.journeys.filter((j) => j.date === st.day);
      const h = hotelFor(st.day);
      el.innerHTML = `<div class="map-sheet">
        <p class="eyebrow">${esc(fmt(st.day))}</p>
        <h2>${h ? `Tonight: ${esc(h.short)}` : 'Flying home'}</h2>
        ${js.map((j) => `<a class="map-step" href="#/journey/${j.id}"><i style="background:${I.KIND[j.kind].color}"></i><span class="grow"><b>${esc(j.title)}</b><small>${esc(j.sub)}</small></span>${I.chevron(16)}</a>`).join('')}
        ${h ? `<div class="map-btns"><a class="btn ink" href="#/hotel/${h.id}">Hotel</a><a class="btn light" href="https://maps.apple.com/?q=${encodeURIComponent(`${h.name}, ${h.address}`)}" target="_blank" rel="noopener">Directions</a></div>` : ''}
      </div>`;
    } else if (st.sel && hotelOf(st.sel)) {
      const h = hotelOf(st.sel);
      const p = hotelPins.find((x) => x.id === st.sel);
      el.innerHTML = `<div class="map-sheet">
        <p class="eyebrow">${p.n} · ${esc(fmt(h.checkIn))} to ${esc(fmt(h.checkOut))}</p>
        <h2>${esc(h.name)}</h2><p class="sub">${esc(h.city)}</p>
        <div class="map-btns"><a class="btn ink" href="#/hotel/${h.id}">Hotel</a><a class="btn light" href="https://maps.apple.com/?q=${encodeURIComponent(`${h.name}, ${h.address}`)}" target="_blank" rel="noopener">Directions</a></div>
        <button type="button" class="map-back" data-mapall>Show the whole trip</button>
      </div>`;
    } else {
      el.innerHTML = `<div class="map-stops">${hotelPins.map((p) => `<button type="button" class="map-stop" data-mappin="${p.id}"><i>${p.n}</i><span><b>${esc(p.label)}</b><small>${esc(p.dates)}</small></span></button>`).join('')}</div>`;
    }
  }

  const setView = (v) => { st.view = { ...v, s: Math.max(minS(), Math.min(v.s, 60)) }; draw(); };
  const showDay = (d) => { st.day = d || null; st.sel = null; setView(st.day ? fit(dayPts(st.day), 50) : fit(tripPts(), 24)); below(); root.querySelectorAll('[data-mapday]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.mapday || null) === st.day))); };
  const showHotel = (id) => { st.sel = id; st.day = null; setView({ cx: P[id].xy[0], cy: P[id].xy[1], s: 6 }); below(); root.querySelectorAll('[data-mapday]').forEach((b) => b.setAttribute('aria-pressed', String(!b.dataset.mapday))); };

  if (!st.view) st.view = st.day ? fit(dayPts(st.day), 50) : fit(tripPts(), 24);
  draw(); below();

  root.querySelector('.map-screen').addEventListener('click', (e) => {
    const t = e.target.closest('[data-mapday],[data-mapzoom],[data-mappin],[data-mapme],[data-mapall]');
    if (!t) return;
    if ('mapday' in t.dataset) showDay(t.dataset.mapday);
    else if (t.dataset.mapzoom) setView({ ...st.view, s: st.view.s * (t.dataset.mapzoom === 'in' ? 1.6 : 1 / 1.6) });
    else if ('mapall' in t.dataset) showDay('');
    else if (t.dataset.mappin) showHotel(t.dataset.mappin);
    else if ('mapme' in t.dataset) whereAmI();
  });

  function toast(msg) {
    const el = root.querySelector('#map-toast');
    if (!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4000);
  }
  function whereAmI() {
    if (!navigator.geolocation) { toast('This phone cannot share its location.'); return; }
    toast('Finding you…');
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll = [pos.coords.longitude, pos.coords.latitude];
      if (ll[0] < 128 || ll[0] > 146 || ll[1] < 30 || ll[1] > 46) { st.me = null; toast('You are not in Japan yet. Your dot shows here once you are.'); draw(); return; }
      st.me = ll; st.day = null; st.sel = null;
      const [x, y] = proj(ll);
      setView({ cx: x, cy: y, s: 8 }); below(); toast('That blue dot is you.');
    }, () => toast('Location is off. Allow it for this app in Settings, Privacy, Location.'), { enableHighAccuracy: true, timeout: 10000 });
  }

  // pinch and drag
  const ptrs = new Map();
  let start = null;
  svg.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-mappin]')) return; svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); start = { view: { ...st.view }, pts: [...ptrs.values()].map((p) => [...p]) }; });
  svg.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId) || !start) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const now = [...ptrs.values()];
    const v = start.view;
    if (now.length >= 2 && start.pts.length >= 2) {
      const d0 = Math.hypot(start.pts[0][0] - start.pts[1][0], start.pts[0][1] - start.pts[1][1]) || 1;
      const d1 = Math.hypot(now[0][0] - now[1][0], now[0][1] - now[1][1]);
      const m0 = [(start.pts[0][0] + start.pts[1][0]) / 2, (start.pts[0][1] + start.pts[1][1]) / 2];
      const m1 = [(now[0][0] + now[1][0]) / 2, (now[0][1] + now[1][1]) / 2];
      const s = Math.max(minS(), Math.min(v.s * (d1 / d0), 60));
      st.view = { s, cx: v.cx - (m1[0] - m0[0]) / s, cy: v.cy - (m1[1] - m0[1]) / s };
    } else {
      st.view = { ...v, cx: v.cx - (now[0][0] - start.pts[0][0]) / v.s, cy: v.cy - (now[0][1] - start.pts[0][1]) / v.s };
    }
    draw();
  });
  const end = (e) => { ptrs.delete(e.pointerId); start = ptrs.size ? { view: { ...st.view }, pts: [...ptrs.values()].map((p) => [...p]) } : null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (e) => { e.preventDefault(); setView({ ...st.view, s: st.view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15) }); }, { passive: false });
}
