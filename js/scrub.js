// スクロールでコマ送りする再生部（AI映像を静止画に分けたものを、canvasに描く）
// frames/story/manifest.json = { count, width, height, ext, keyframes: [0, 60, 120, 180, 239] }
const ease = (x) => x * x * (3 - 2 * x);

export async function createScrub(canvas, base = 'frames/story/') {
  const res = await fetch(base + 'manifest.json', { cache: 'no-store' });
  const man = await res.json();
  const { count, ext = 'webp' } = man;
  const keys = man.keyframes || [0, count - 1];
  const ctx = canvas.getContext('2d');
  const imgs = new Array(count);
  const name = (i) => `${base}${String(i + 1).padStart(4, '0')}.${ext}`;

  // 読み込む順番：最初の数コマ → 粗く全体 → 細かく埋める（どこへスクロールしても近いコマがある）
  const order = [];
  const seen = new Set();
  const push = (i) => { if (i >= 0 && i < count && !seen.has(i)) { seen.add(i); order.push(i); } };
  for (let i = 0; i < 12; i++) push(i);
  for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < count; i += step) push(i);

  let loaded = 0, current = -1, dirty = true;
  const queue = order.slice();
  const PAR = 6;
  const next = () => {
    const i = queue.shift();
    if (i === undefined) return;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { imgs[i] = im; loaded++; dirty = true; next(); };
    im.onerror = next;
    im.src = name(i);
  };
  for (let k = 0; k < PAR; k++) next();

  let w = 1, h = 1;
  function resize(cw, ch) {
    const dpr = Math.min(devicePixelRatio, 2);
    w = canvas.width = Math.round(cw * dpr);
    h = canvas.height = Math.round(ch * dpr);
    dirty = true;
  }

  // p(0〜1) → コマ番号。絵（キーフレーム）の前後でゆっくりになるよう、区間ごとに緩急をつける
  function frameAt(p) {
    const segs = keys.length - 1;
    const x = Math.min(0.99999, Math.max(0, p)) * segs;
    const s = Math.floor(x);
    const t = ease(x - s);
    return Math.round(keys[s] + (keys[s + 1] - keys[s]) * t);
  }

  function nearest(i) {
    if (imgs[i]) return imgs[i];
    for (let d = 1; d < count; d++) {
      if (imgs[i - d]) return imgs[i - d];
      if (imgs[i + d]) return imgs[i + d];
    }
    return null;
  }

  // 縦長画面では絵を少し上寄せ（下に文字が来るため）
  function draw(p) {
    const i = frameAt(p);
    if (i === current && !dirty) return;
    const im = nearest(i);
    if (!im) return;
    current = i; dirty = false;
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2 - (h > w ? h * 0.08 : 0);
    ctx.fillStyle = '#070707';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(im, dx, dy, dw, dh);
  }

  return { resize, draw, keys, count, get loaded() { return loaded; } };
}
