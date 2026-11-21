// Weather from Open-Meteo (free, no account). Forecasts reach about 16 days ahead;
// before that we show the usual December weather. The last forecast is saved for offline use.
const API = 'https://api.open-meteo.com/v1/forecast';
const MAX_AHEAD = 15;
const FRESH_MS = 3 * 60 * 60 * 1000;

const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

async function fetchPlace(key, p, start, end) {
  const cacheKey = `wx:${key}`;
  const cached = load(cacheKey);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.days;
  try {
    const url = `${API}?latitude=${p.lat}&longitude=${p.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(p.tz)}&start_date=${start}&end_date=${end}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather');
    const j = await res.json();
    const days = {};
    j.daily.time.forEach((t, i) => {
      days[t] = {
        max: Math.round(j.daily.temperature_2m_max[i]),
        min: Math.round(j.daily.temperature_2m_min[i]),
        code: j.daily.weather_code[i],
        rain: j.daily.precipitation_probability_max ? j.daily.precipitation_probability_max[i] : null
      };
    });
    save(cacheKey, { at: Date.now(), days: { ...(cached ? cached.days : {}), ...days } });
    return { ...(cached ? cached.days : {}), ...days };
  } catch {
    return cached ? cached.days : {};
  }
}

// Returns one entry per trip day: forecast if we have it, otherwise the usual December weather.
export async function tripWeather(trip, today) {
  const last = addDays(today, MAX_AHEAD);
  const wanted = trip.days.filter((d) => d.date >= today && d.date <= last);
  const byPlace = {};
  wanted.forEach((d) => { (byPlace[d.place] = byPlace[d.place] || []).push(d.date); });
  const results = {};
  await Promise.all(Object.entries(byPlace).map(async ([key, dates]) => {
    const days = await fetchPlace(key, trip.weatherPlaces[key], dates[0], dates[dates.length - 1]);
    dates.forEach((dt) => { if (days[dt]) results[dt] = { ...days[dt], forecast: true }; });
  }));
  return trip.days.map((d) => {
    const p = trip.weatherPlaces[d.place];
    const w = results[d.date] || { max: p.usual[0], min: p.usual[1], code: null, rain: null, forecast: false };
    return { ...d, placeName: p.name, ...w };
  });
}

export function describe(code) {
  if (code === null || code === undefined) return { label: 'Usual for December', icon: 'part' };
  if (code === 0) return { label: 'Sunny', icon: 'sun' };
  if (code <= 2) return { label: 'Some cloud', icon: 'part' };
  if (code === 3) return { label: 'Cloudy', icon: 'cloud' };
  if (code <= 48) return { label: 'Foggy', icon: 'cloud' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Rain', icon: 'rain' };
  if (code <= 77 || code === 85 || code === 86) return { label: 'Snow', icon: 'snow' };
  return { label: 'Storms', icon: 'rain' };
}

// Plain-English clothes advice from the temperatures, rain chance and kind of day.
export function whatToWear(w) {
  const tips = [];
  if (w.min <= 0) tips.push('Very cold: puffer jacket, beanie, gloves, scarf and a thermal layer.');
  else if (w.min <= 5) tips.push('Cold: warm jacket, jumper and long pants. Beanie for the evening.');
  else if (w.max <= 16) tips.push('Cool: a jacket and a jumper.');
  else if (w.max >= 25) tips.push('Warm: T-shirt and shorts, plus a hat and sunscreen.');
  else tips.push('Mild: a light jacket or jumper.');
  if (w.code !== null && describe(w.code).icon === 'snow') tips.push('Snow possible: waterproof shoes if you have them.');
  if ((w.rain ?? 0) >= 50 || (w.code !== null && describe(w.code).icon === 'rain')) tips.push('Bring an umbrella (7-Eleven sells cheap ones).');
  if (w.type === 'park') tips.push('Comfy shoes for a long day on your feet.');
  if (w.type === 'travel') tips.push('Wear layers: trains are warm, platforms are cold.');
  return tips;
}
