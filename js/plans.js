// SPACEページ：空間ごとの間取り図（スクロールで線が描かれる）。寸法の数字は入れない（実物の寸法ではないため）
const P = (d, k = 0) => `<path pathLength="1" style="--d:${k}" d="${d}"/>`;
const C = (cx, cy, r, k = 0) => `<circle pathLength="1" style="--d:${k}" cx="${cx}" cy="${cy}" r="${r}"/>`;
const R = (x, y, w, h, k = 0, rx = 0) => `<rect pathLength="1" style="--d:${k}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;

// 部品
const wheelTable = (cx, cy, r, k) => C(cx, cy, r, k) + `<g class="pl-acc">${C(cx, cy, r * 0.72, k + 1)}${[0, 72, 144, 216, 288].map((a) => {
  const t = (a * Math.PI) / 180;
  return P(`M${cx} ${cy} L${(cx + Math.cos(t) * r * 0.68).toFixed(1)} ${(cy + Math.sin(t) * r * 0.68).toFixed(1)}`, k + 2);
}).join('')}${C(cx, cy, r * 0.14, k + 2)}</g>`;
const car = (x, y, w, h, k) => R(x, y, w, h, k, 18) + P(`M${x + 10} ${y + h * 0.3} Q${x + w / 2} ${y + h * 0.22} ${x + w - 10} ${y + h * 0.3}`, k + 1)
  + P(`M${x + 10} ${y + h * 0.72} Q${x + w / 2} ${y + h * 0.8} ${x + w - 10} ${y + h * 0.72}`, k + 1)
  + [[x - 6, y + h * 0.15], [x + w - 4, y + h * 0.15], [x - 6, y + h * 0.7], [x + w - 4, y + h * 0.7]].map(([a, b]) => R(a, b, 10, h * 0.15, k + 2, 3)).join('');
const sofaL = (x, y, w, d, side, k) => R(x, y, w, d, k, 6) + R(x, y, w, 10, k + 1, 4) + (side ? R(x, y, 10 + 46, d + 70, k + 1, 6) : '');
const shelf = (x, y, w, h, k) => R(x, y, w, h, k) + Array.from({ length: Math.floor(h / 22) }, (_, i) => P(`M${x} ${y + (i + 1) * 22} H${x + w}`, k + 1)).join('');
const stool = (cx, cy, k) => C(cx, cy, 7, k);
const door = (x, y, r, k) => P(`M${x} ${y} A${r} ${r} 0 0 1 ${x + r} ${y + r}`, k) + P(`M${x} ${y} V${y + r}`, k);
const walls = (gapFrom, gapTo, k = 0) => P(`M${gapTo} 280 H380 V20 H20 V280 H${gapFrom}`, k);

const PLANS = {
  '01': () => walls(150, 250) + P('M150 280 H250', 2).replace('d=', 'class="pl-dash" d=')
    + car(50, 60, 90, 190, 1) + wheelTable(285, 120, 30, 3) + sofaL(220, 175, 140, 34, false, 4)
    + C(300, 32, 9, 5) + shelf(352, 60, 22, 110, 5),
  '02': () => walls(300, 360) + door(300, 280, 60, 2) + sofaL(40, 40, 160, 40, true, 1) + wheelTable(170, 160, 34, 3)
    + C(170, 160, 50, 4).replace('<circle', '<circle class="pl-dash"') + shelf(330, 40, 30, 160, 4) + R(240, 230, 110, 30, 5),
  '03': () => walls(60, 110) + door(60, 280, 50, 1) + P('M220 20 V170 M220 220 V280', 1) + sofaL(36, 40, 150, 36, false, 2)
    + wheelTable(110, 150, 30, 3) + R(250, 50, 100, 140, 4, 6) + R(255, 55, 90, 30, 5, 4) + C(360, 250, 10, 5),
  '04': () => walls(30, 100) + door(30, 280, 70, 1) + R(60, 40, 280, 34, 2, 4) + [90, 150, 210, 270, 330].map((x, i) => stool(x, 92, 3 + (i % 2))).join('')
    + wheelTable(130, 200, 26, 3) + wheelTable(260, 200, 26, 4) + [130, 260].map((x) => stool(x - 40, 200, 5) + stool(x + 40, 200, 5)).join('') + C(355, 160, 9, 5),
  '05': () => P('M40 250 V40 H360 V250', 0) + [100, 160, 220, 280, 340].map((x, i) => C(x - 30, 62, 16, 1 + (i % 2))).join('')
    + wheelTable(200, 160, 40, 2) + [130, 270].map((x) => stool(x, 160, 4)).join('') + R(60, 200, 70, 30, 4, 4) + R(270, 200, 70, 30, 4, 4)
    + P('M20 280 H380', 5).replace('d=', 'class="pl-dash" d='),
};

export function planSvg(no, label) {
  const body = (PLANS[no] || PLANS['01'])();
  return `<svg class="plan" viewBox="0 0 400 300" role="img" aria-label="${label}の間取りイメージ">${body}</svg><span class="plan-label">${label.toUpperCase()} PLAN</span>`;
}
