// Money: turn yen into Australian dollars and back.
// The rate is saved on the phone, so it still works with no internet. When online it checks for a
// fresh rate (at most every few hours) from free public exchange-rate services.
const KEY = 'fx';
const FALLBACK = { rate: 100, at: 0 }; // rough guess, only used until the phone has been online once
const STALE = 6 * 3600 * 1000;

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || FALLBACK; } catch { return FALLBACK; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } };

const yen = (n) => `¥${Math.round(n).toLocaleString('en-AU')}`;
const aud = (n) => `A$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (s) => { const v = parseFloat(String(s).replace(/[^\d.]/g, '')); return Number.isFinite(v) ? v : 0; };

async function fetchRate() {
  const sources = [
    ['https://api.frankfurter.app/latest?from=AUD&to=JPY', (j) => j.rates && j.rates.JPY],
    ['https://open.er-api.com/v6/latest/AUD', (j) => j.rates && j.rates.JPY]
  ];
  for (const [url, pick] of sources) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const rate = Number(pick(await r.json()));
      if (rate > 10 && rate < 1000) return rate;
    } catch { /* try the next one */ }
  }
  return null;
}

const when = (at) => {
  if (!at) return 'A rough guess. Open this page with internet to get today’s rate.';
  const d = new Date(at);
  return `Rate from ${d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
};

const QUICK = [500, 1000, 3000, 5000, 10000];

export function moneyScreen(header) {
  const { rate, at } = load();
  return `<div class="screen">
    ${header('Money', 'Yen and Australian dollars', '#2BB673', true)}
    <div class="section">
      <div class="card pad fx">
        <label class="fx-row"><span class="fx-cur">¥</span><input id="fx-jpy" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="Yen"><span class="fx-code">JPY</span></label>
        <div class="fx-eq">=</div>
        <label class="fx-row"><span class="fx-cur">A$</span><input id="fx-aud" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="Australian dollars"><span class="fx-code">AUD</span></label>
      </div>
      <div class="fx-quick">${QUICK.map((v) => `<button type="button" class="chip" data-fx="${v}">${yen(v)}</button>`).join('')}</div>
    </div>
    <div class="section">
      <div class="card pad">
        <p class="title" id="fx-rate">A$1 = ¥${rate.toFixed(1)}</p>
        <p class="sub" id="fx-when" style="margin-top:4px">${when(at)}</p>
        <p class="sub" id="fx-rule" style="margin-top:10px">${rule(rate)}</p>
      </div>
    </div>
    <div class="end-space"></div>
  </div>`;
}

const rule = (rate) => `Quick guide: ${yen(1000)} is about ${aud(1000 / rate)}, and ${yen(10000)} is about ${aud(10000 / rate)}. Card payments and ATMs add a small fee.`;

export function wireMoney(root) {
  const jpy = root.querySelector('#fx-jpy');
  const a = root.querySelector('#fx-aud');
  if (!jpy || !a) return;
  let { rate } = load();
  const fromYen = () => { const v = num(jpy.value); a.value = v ? (v / rate).toFixed(2) : ''; };
  const fromAud = () => { const v = num(a.value); jpy.value = v ? Math.round(v * rate).toLocaleString('en-AU') : ''; };
  jpy.addEventListener('input', fromYen);
  a.addEventListener('input', fromAud);
  root.querySelectorAll('[data-fx]').forEach((b) => b.addEventListener('click', () => { jpy.value = Number(b.dataset.fx).toLocaleString('en-AU'); fromYen(); }));
  const saved = load();
  if (navigator.onLine && Date.now() - saved.at > STALE) {
    fetchRate().then((r) => {
      if (!r) return;
      rate = r;
      const v = { rate: r, at: Date.now() };
      save(v);
      const el = (id) => root.querySelector(id);
      if (el('#fx-rate')) el('#fx-rate').textContent = `A$1 = ¥${r.toFixed(1)}`;
      if (el('#fx-when')) el('#fx-when').textContent = when(v.at);
      if (el('#fx-rule')) el('#fx-rule').textContent = rule(r);
      if (document.activeElement === a) fromAud(); else fromYen();
    });
  }
}
