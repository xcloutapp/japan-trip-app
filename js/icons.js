// Drawn pictures used across the app. Colours follow the approved mock-ups.
const INK = '#14213D';

export const KIND = {
  bullet: { label: 'Bullet train', color: '#1E6FD9', tint: '#DCEBFF' },
  metro: { label: 'Train', color: '#1A9E6B', tint: '#D7F2E6' },
  bus: { label: 'Bus', color: '#7B4FD6', tint: '#E9E1FB' },
  van: { label: 'Van', color: '#F08A24', tint: '#FFE8D1' },
  car: { label: 'Car', color: '#E8473C', tint: '#FDE2DF' },
  plane: { label: 'Plane', color: '#0E7FA0', tint: '#D6F1F8' },
  walk: { label: 'Walk', color: '#4A5875', tint: '#EEF1F7' },
  truck: { label: 'Luggage truck', color: '#7B4FD6', tint: '#E9E1FB' },
  suitcase: { label: 'Suitcases', color: '#F08A24', tint: '#FFE8D1' },
  ticket: { label: 'Ticket', color: '#E8473C', tint: '#FFF3C4' }
};

const svg = (w, h, vb, body, label) =>
  `<svg width="${w}" height="${h}" viewBox="${vb}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${body}</svg>`;

const BODY = {
  bullet: (c) => `<path d="M4 30 L4 16 Q4 11 9 11 L40 11 Q54 11 61 26 Q62 30 58 30 Z" fill="#FFFFFF" stroke="${INK}" style="stroke-width:2.5;stroke-linejoin:round"/><path d="M4 24 L59 24" stroke="${c}" style="stroke-width:3"/><rect x="9" y="15" width="7" height="5" rx="1.5" fill="${INK}"/><rect x="19" y="15" width="7" height="5" rx="1.5" fill="${INK}"/><rect x="29" y="15" width="7" height="5" rx="1.5" fill="${INK}"/><path d="M42 15 L48 15 Q52 16 54 20 L42 20 Z" fill="${INK}"/><path d="M2 35 L62 35" stroke="${INK}" style="stroke-width:2.5;stroke-linecap:round"/>`,
  van: () => `<path d="M6 30 L6 12 Q6 8 10 8 L42 8 Q46 8 49 12 L57 21 Q59 23 59 26 L59 30 Z" fill="#F08A24" stroke="${INK}" style="stroke-width:2.4;stroke-linejoin:round"/><path d="M11 12 L23 12 L23 19 L11 19 Z" fill="#FFFFFF"/><path d="M27 12 L39 12 L39 19 L27 19 Z" fill="#FFFFFF"/><path d="M43 12 L46 12 L52 19 L43 19 Z" fill="#FFFFFF"/><circle cx="17" cy="31" r="5" fill="${INK}"/><circle cx="48" cy="31" r="5" fill="${INK}"/><circle cx="17" cy="31" r="2" fill="#FFFFFF"/><circle cx="48" cy="31" r="2" fill="#FFFFFF"/>`,
  car: () => `<path d="M6 30 L6 22 Q6 19 9 18 L16 17 L22 10 Q24 8 27 8 L40 8 Q43 8 45 10 L51 17 L56 18 Q59 19 59 22 L59 30 Z" fill="#E8473C" stroke="${INK}" style="stroke-width:2.4;stroke-linejoin:round"/><path d="M24 12 L31 12 L31 17 L19 17 Z" fill="#FFFFFF"/><path d="M34 12 L41 12 L46 17 L34 17 Z" fill="#FFFFFF"/><circle cx="18" cy="31" r="5" fill="${INK}"/><circle cx="47" cy="31" r="5" fill="${INK}"/><circle cx="18" cy="31" r="2" fill="#FFFFFF"/><circle cx="47" cy="31" r="2" fill="#FFFFFF"/>`,
  metro: () => `<g transform="translate(0,-2)"><rect x="14" y="3" width="36" height="31" rx="7" fill="#1A9E6B" stroke="${INK}" style="stroke-width:2.4"/><rect x="19" y="8" width="26" height="12" rx="2.5" fill="#FFFFFF"/><circle cx="22" cy="27" r="2.6" fill="#FFE58A"/><circle cx="42" cy="27" r="2.6" fill="#FFE58A"/><path d="M20 35 L13 40 M44 35 L51 40" stroke="${INK}" style="stroke-width:2.6;stroke-linecap:round"/></g>`,
  bus: () => `<rect x="4" y="7" width="56" height="23" rx="5" fill="#7B4FD6" stroke="${INK}" style="stroke-width:2.4"/><rect x="8" y="11" width="9" height="8" rx="1.5" fill="#FFFFFF"/><rect x="20" y="11" width="9" height="8" rx="1.5" fill="#FFFFFF"/><rect x="32" y="11" width="9" height="8" rx="1.5" fill="#FFFFFF"/><rect x="44" y="11" width="11" height="12" rx="1.5" fill="#FFFFFF"/><circle cx="16" cy="31" r="5" fill="${INK}"/><circle cx="48" cy="31" r="5" fill="${INK}"/><circle cx="16" cy="31" r="2" fill="#FFFFFF"/><circle cx="48" cy="31" r="2" fill="#FFFFFF"/>`,
  plane: () => `<path d="M8 18 L6 8 L11 8 L17 17 Z" fill="#0E7FA0" stroke="${INK}" style="stroke-width:2;stroke-linejoin:round"/><path d="M6 21 Q6 17 12 17 L52 17 Q60 17 62 20 Q60 23 52 23 L12 23 Q6 23 6 21 Z" fill="#FFFFFF" stroke="${INK}" style="stroke-width:2.2;stroke-linejoin:round"/><path d="M26 19 L35 5 L40 5 L36 19 Z" fill="#0E7FA0" stroke="${INK}" style="stroke-width:2;stroke-linejoin:round"/><path d="M26 22 L35 35 L40 35 L36 22 Z" fill="#0E7FA0" stroke="${INK}" style="stroke-width:2;stroke-linejoin:round"/>`,
  walk: () => `<circle cx="34" cy="7" r="4.5" fill="${INK}"/><path d="M33 13 L28 25 L22 36 M29 23 L38 36 M30 15 L22 20 M32 15 L41 21" fill="none" stroke="${INK}" style="stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round"/>`,
  truck: () => `<rect x="4" y="8" width="34" height="22" rx="3" fill="#7B4FD6" stroke="${INK}" style="stroke-width:2.4"/><path d="M38 14 L49 14 L58 23 L58 30 L38 30 Z" fill="#FFFFFF" stroke="${INK}" style="stroke-width:2.4;stroke-linejoin:round"/><circle cx="15" cy="31" r="5" fill="${INK}"/><circle cx="48" cy="31" r="5" fill="${INK}"/><circle cx="15" cy="31" r="2" fill="#FFFFFF"/><circle cx="48" cy="31" r="2" fill="#FFFFFF"/>`,
  suitcase: () => `<g transform="translate(14,-2) scale(1.75)"><rect x="5" y="7" width="14" height="14" rx="2.5" fill="#F08A24" stroke="${INK}" style="stroke-width:1.4"/><path d="M9 7 V4 H15 V7" fill="none" stroke="${INK}" style="stroke-width:1.4"/><path d="M9.5 11 V17 M14.5 11 V17" stroke="${INK}" style="stroke-width:1.4;stroke-linecap:round"/></g>`,
  ticket: () => `<g transform="translate(8,-4) scale(2)"><path d="M3 7 H21 V10 A2 2 0 0 0 21 14 V17 H3 V14 A2 2 0 0 0 3 10 Z" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.4;stroke-linejoin:round"/><path d="M15 7 V17" stroke="${INK}" style="stroke-width:1.2"/><circle cx="9" cy="12" r="2" fill="#E8473C"/></g>`
};

// A transport picture inside a rounded tile (used on cards) or circle (used on step lists).
export function kindTile(kind, size = 72, round = false) {
  const k = KIND[kind] || KIND.walk;
  const draw = BODY[kind] || BODY.walk;
  const w = Math.round(size * 0.84);
  const h = Math.round(w * 0.64);
  return `<span class="tile${round ? ' tile-round' : ''}" style="width:${size}px;height:${size}px;background:${k.tint}">${svg(w, h, '0 0 64 40', draw(k.color), k.label)}</span>`;
}

export const suitcase = (s = 22) => svg(s, s, '0 0 24 24', `<rect x="5" y="7" width="14" height="14" rx="2.5" fill="#F08A24" stroke="${INK}" style="stroke-width:1.6"/><path d="M9 7 V4 H15 V7" fill="none" stroke="${INK}" style="stroke-width:1.6"/><path d="M9.5 11 V17 M14.5 11 V17" stroke="${INK}" style="stroke-width:1.6;stroke-linecap:round"/>`);
export const backpack = (s = 22) => svg(s, s, '0 0 24 24', `<path d="M6 10 Q6 5 12 5 Q18 5 18 10 L18 20 Q18 21 17 21 L7 21 Q6 21 6 20 Z" fill="#1A9E6B" stroke="${INK}" style="stroke-width:1.6"/><rect x="9" y="13" width="6" height="5" rx="1" fill="#FFFFFF"/><path d="M10 5 Q12 2 14 5" fill="none" stroke="${INK}" style="stroke-width:1.6"/>`);
export const truck = (s = 34) => svg(Math.round(s * 1.2), s, '0 0 30 24', `<rect x="2" y="6" width="16" height="11" rx="1.5" fill="#7B4FD6" stroke="${INK}" style="stroke-width:1.3"/><path d="M18 9 L23 9 L27 13 L27 17 L18 17 Z" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.3;stroke-linejoin:round"/><circle cx="7" cy="18" r="2.5" fill="${INK}"/><circle cx="22" cy="18" r="2.5" fill="${INK}"/>`);
export const hotel = (s = 44) => svg(s, s, '0 0 24 24', `<path d="M3 20 V10 L12 4 L21 10 V20 Z" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.6;stroke-linejoin:round"/><rect x="10" y="14" width="4" height="6" fill="#D6336C"/><rect x="6" y="11" width="3" height="3" fill="${INK}"/><rect x="15" y="11" width="3" height="3" fill="${INK}"/>`);
export const ticket = (s = 44) => svg(s, s, '0 0 24 24', `<path d="M3 7 H21 V10 A2 2 0 0 0 21 14 V17 H3 V14 A2 2 0 0 0 3 10 Z" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.6;stroke-linejoin:round"/><path d="M15 7 V17" stroke="${INK}" style="stroke-width:1.4"/><circle cx="9" cy="12" r="2" fill="#E8473C"/>`);
export const bigBag = (s = 44) => svg(s, s, '0 0 24 24', `<rect x="5" y="7" width="14" height="14" rx="2.5" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.6"/><path d="M9 7 V4 H15 V7" fill="none" stroke="${INK}" style="stroke-width:1.6"/><path d="M9.5 11 V17 M14.5 11 V17" stroke="${INK}" style="stroke-width:1.6;stroke-linecap:round"/>`);
export const camera = (s = 44) => svg(s, s, '0 0 24 24', `<rect x="3" y="7" width="18" height="13" rx="3" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.6"/><path d="M8 7 L9.5 4.5 H14.5 L16 7" fill="none" stroke="${INK}" style="stroke-width:1.6;stroke-linejoin:round"/><circle cx="12" cy="13.5" r="3.6" fill="#1E6FD9" stroke="${INK}" style="stroke-width:1.4"/>`);
export const plane = (s = 58) => svg(s, Math.round(s * 0.62), '0 0 64 40', BODY.plane());
export const bulletTrain = (s = 64, stripe = '#E8473C', rail = '#FFFFFF') => svg(s, Math.round(s * 0.62), '0 0 64 40', BODY.bullet(stripe).replace(`stroke="${INK}" style="stroke-width:2.5;stroke-linecap:round"/>`, `stroke="${rail}" style="stroke-width:2.5;stroke-linecap:round"/>`));
export const qr = (s = 44) => svg(s, s, '0 0 24 24', `<rect x="3" y="3" width="7" height="7" fill="${INK}"/><rect x="14" y="3" width="7" height="7" fill="${INK}"/><rect x="3" y="14" width="7" height="7" fill="${INK}"/><rect x="14" y="14" width="3" height="3" fill="${INK}"/><rect x="18" y="18" width="3" height="3" fill="${INK}"/>`);
export const printer = (s = 22) => svg(s, s, '0 0 24 24', `<rect x="6" y="3" width="12" height="6" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.6"/><rect x="3" y="9" width="18" height="8" rx="2" fill="#FFE58A" stroke="${INK}" style="stroke-width:1.6"/><rect x="7" y="14" width="10" height="7" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.6"/>`);

const stroke = (d, s = 24, w = 2.2) => svg(s, s, '0 0 24 24', `<path d="${d}" fill="none" stroke="currentColor" style="stroke-width:${w};stroke-linecap:round;stroke-linejoin:round"/>`);
export const back = (s = 18) => stroke('M15 5 L8 12 L15 19', s, 2.6);
export const chevron = (s = 20) => stroke('M9 5 L16 12 L9 19', s, 2.4);
export const external = (s = 18) => stroke('M14 4 H20 V10 M20 4 L11 13 M18 14 V19 A1 1 0 0 1 17 20 H5 A1 1 0 0 1 4 19 V7 A1 1 0 0 1 5 6 H10', s, 2.2);

export const tab = {
  home: stroke('M3 11 L12 4 L21 11 M5 9.5 V20 H10 V14 H14 V20 H19 V9.5', 26, 2),
  trip: stroke('M5 17 H19 M7 17 V8 Q7 5 10 5 H14 Q17 5 17 8 V17 M7 11 H17 M8 20 L10 17 M16 20 L14 17', 26, 2),
  bags: stroke('M6 8 H18 A1.5 1.5 0 0 1 19.5 9.5 V19 A1.5 1.5 0 0 1 18 20.5 H6 A1.5 1.5 0 0 1 4.5 19 V9.5 A1.5 1.5 0 0 1 6 8 Z M9 8 V5 H15 V8 M9.5 12 V17 M14.5 12 V17', 26, 2),
  tickets: stroke('M3 7 H21 V10 A2 2 0 0 0 21 14 V17 H3 V14 A2 2 0 0 0 3 10 Z M15 7 V17', 26, 2)
};

const SUN = '<circle cx="12" cy="12" r="5" fill="#FFC93C" stroke="#14213D" style="stroke-width:1.4"/><path d="M12 2.5V5 M12 19V21.5 M2.5 12H5 M19 12H21.5 M5.2 5.2L6.9 6.9 M17.1 17.1L18.8 18.8 M5.2 18.8L6.9 17.1 M17.1 6.9L18.8 5.2" stroke="#14213D" style="stroke-width:1.4;stroke-linecap:round"/>';
const CLOUD = (y = 0) => `<path d="M7 ${18 + y} H17.5 A3.5 3.5 0 0 0 17.5 ${11 + y} A5 5 0 0 0 8 ${10 + y} A4 4 0 0 0 7 ${18 + y} Z" fill="#FFFFFF" stroke="#14213D" style="stroke-width:1.4;stroke-linejoin:round"/>`;
export const weatherIcon = (kind, s = 40) => {
  const body = {
    sun: SUN,
    part: `<g transform="translate(-3,-4) scale(0.8)">${SUN}</g>${CLOUD(2)}`,
    cloud: CLOUD(0),
    rain: `${CLOUD(-2)}<path d="M9 19 L8 22 M13 19 L12 22 M17 19 L16 22" stroke="#1E6FD9" style="stroke-width:1.8;stroke-linecap:round"/>`,
    snow: `${CLOUD(-2)}<circle cx="9" cy="20.5" r="1.2" fill="#7FB3F0"/><circle cx="13" cy="21.5" r="1.2" fill="#7FB3F0"/><circle cx="17" cy="20.5" r="1.2" fill="#7FB3F0"/>`
  }[kind] || CLOUD(0);
  return svg(s, s, '0 0 24 24', body);
};
export const clock = (s = 40) => svg(s, s, '0 0 24 24', `<circle cx="12" cy="12" r="9" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.6"/><path d="M12 7 V12 L15 14" fill="none" stroke="${INK}" style="stroke-width:1.8;stroke-linecap:round"/>`);
export const food = (s = 36) => svg(s, s, '0 0 24 24', `<path d="M4 12 H20 A8 8 0 0 1 4 12 Z" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.5;stroke-linejoin:round"/><path d="M8 9 Q9 6 8 4 M12 9 Q13 6 12 4 M16 9 Q17 6 16 4" fill="none" stroke="#E8473C" style="stroke-width:1.5;stroke-linecap:round"/>`);
export const lobby = (s = 36) => svg(s, s, '0 0 24 24', `<rect x="5" y="3" width="14" height="18" rx="1.5" fill="#FFFFFF" stroke="${INK}" style="stroke-width:1.5"/><path d="M12 3 V21" stroke="${INK}" style="stroke-width:1.5"/><circle cx="10" cy="12" r="1" fill="${INK}"/><circle cx="14" cy="12" r="1" fill="${INK}"/>`);
export const lock = (s = 22) => svg(s, s, '0 0 24 24', `<rect x="5" y="10" width="14" height="11" rx="2" fill="#FFC93C" stroke="${INK}" style="stroke-width:1.6"/><path d="M8 10 V7 A4 4 0 0 1 16 7 V10" fill="none" stroke="${INK}" style="stroke-width:1.6"/>`);
