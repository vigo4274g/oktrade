// FINISH：仕上げ3色を写真で見せる（回さない・2026-10-23 源斗さん判断）。色の切り替えは前の色からふわっと溶かす
// 写真＝assets/photos/finish-<色>-<pc|sp>.webp（10本スポーク・高画質化＋中央にO&Kのロゴを合成済み。2026-10-24 源斗さん判断で商品01〜03版から戻した）
export function createTurntable(canvas, base, names) {
  const ctx = canvas.getContext('2d');
  const portrait = () => innerHeight > innerWidth;
  const imgs = {};
  function load(name, kind) {
    const key = `${name}-${kind}`;
    if (key in imgs) return imgs[key];
    imgs[key] = null;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { imgs[key] = im; }); };
    im.onerror = () => { delete imgs[key]; };
    im.src = `${base}/finish-${key}.webp`;
    return null;
  }
  const cover = (im, alpha) => {
    const w = canvas.width, h = canvas.height;
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };

  let cur = names[0], prev = null, mix = 1; // mix：前の色→今の色の溶け具合
  function setFinish(name) {
    if (name === cur) return;
    prev = cur; cur = name; mix = 0;
    load(cur, portrait() ? 'sp' : 'pc');
  }
  function preload() { const k = portrait() ? 'sp' : 'pc'; names.forEach((n) => load(n, k)); } // 3色とも先に読む（押した瞬間に出るように）
  // alpha＝この層全体の濃さ（06の部屋から溶けて入る）／dt＝秒
  function draw(alpha, dt) {
    const kind = portrait() ? 'sp' : 'pc';
    const A = load(cur, kind);
    if (!A) return false;
    mix = Math.min(1, mix + dt / 0.45);
    const P = prev && mix < 1 ? load(prev, kind) : null;
    const key = `finish|${cur}|${P ? prev : ''}|${Math.round(mix * 32)}|${Math.round(alpha * 64)}|${canvas.width}x${canvas.height}`;
    if (canvas.__drawn === key) return true; // 前回と同じ絵なら描き直さない
    canvas.__drawn = key;
    if (alpha >= 1) { ctx.globalAlpha = 1; ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (P) { cover(P, alpha); cover(A, alpha * mix); } else cover(A, alpha);
    ctx.globalAlpha = 1;
    return true;
  }
  return { draw, setFinish, preload, addDrag() {} };
}
