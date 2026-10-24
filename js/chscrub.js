// 章ごとの写真級動画を、スクロールでなめらかにコマ送りする（PC用＝横・スマホ用＝縦を自動で選ぶ）
// frames/<章>/<pc|sp>/manifest.json = { count, ext }
// なめらかさ：隣り合う2コマを重ねて描く（コマの間も途切れない）／読み込み途中は一番近いコマで代用

// stills = { start: { pc, sp }, end: { pc, sp }, fadeIn, fadeOut } … 止まって見る最初と最後の場面だけ、高画質化した静止画に差し替える（動画のコマより精細）
export async function createChapterScrub(canvas, base, stills = {}) {
  const still = { start: {}, end: {} };
  for (const pos of ['start', 'end']) for (const [k, url] of Object.entries(stills[pos] || {})) {
    const im = new Image(); im.decoding = 'async'; im.onload = () => { still[pos][k] = im; }; im.src = url;
  }
  const portrait = () => innerHeight > innerWidth;
  const sets = {}, pending = {};
  const load = async (kind) => {
    if (sets[kind] || pending[kind]) return sets[kind];
    pending[kind] = true; // 毎フレーム呼ばれても読み込みは1回だけ
    const dir = `${base}/${kind}/`;
    let man;
    try { man = await (await fetch(dir + 'manifest.json', { cache: 'no-store' })).json(); }
    catch (e) { setTimeout(() => { pending[kind] = false; }, 2000); throw e; } // 失敗したら2秒後にもう一度
    const imgs = new Array(man.count);
    const set = { man, imgs, dir, loaded: 0 };
    // 読む順番：最初と最後 → 粗く全体 → 細かく埋める
    const order = [];
    const seen = new Set();
    const push = (i) => { if (i >= 0 && i < man.count && !seen.has(i)) { seen.add(i); order.push(i); } };
    push(0); push(man.count - 1);
    for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < man.count; i += step) push(i);
    let k = 0;
    const next = () => {
      const i = order[k++];
      if (i === undefined) return;
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { if (sets[kind] === set) { imgs[i] = im; set.loaded++; } next(); }); };
      im.onerror = next;
      im.src = `${dir}${String(i + 1).padStart(4, '0')}.${man.ext || 'webp'}`;
    };
    for (let n = 0; n < 6; n++) next();
    sets[kind] = set;
    return set;
  };

  const ctx = canvas.getContext('2d');
  let w = 1, h = 1;
  function resize() {
    // 元のコマ（長い辺1928px）より細かく描いても精細にならない → 上限を合わせて描く量を減らす
    const dpr = Math.min(devicePixelRatio, 2, 1928 / Math.max(innerWidth, innerHeight));
    const nw = Math.round(innerWidth * Math.max(dpr, 1)), nh = Math.round(innerHeight * Math.max(dpr, 1));
    if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh; canvas.__drawn = null; }
    w = nw; h = nh;
  }
  resize();
  addEventListener('resize', resize);
  load(portrait() ? 'sp' : 'pc').catch(() => {});

  const near = (imgs, i) => {
    if (imgs[i]) return imgs[i];
    for (let d = 1; d < imgs.length; d++) { if (imgs[i - d]) return imgs[i - d]; if (imgs[i + d]) return imgs[i + d]; }
    return null;
  };
  const cover = (im, alpha) => {
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };

  // t = 0〜1（章の中の進み具合）
  function draw(t) {
    const kind = portrait() ? 'sp' : 'pc';
    const set = sets[kind];
    if (!set) load(kind).catch(() => {});
    const S0 = still.start[kind], S1 = still.end[kind];
    const imgs = set ? set.imgs : [];
    const tt = Math.min(Math.max(t, 0), 1);
    const f = tt * Math.max(imgs.length - 1, 0);
    const i = Math.floor(f), a = f - i;
    // コマがまだ届いていない間は、近い方の静止画で代わりに見せる（前の章の絵が残らないように）
    const A = imgs.length ? near(imgs, i) : null;
    const fallback = tt >= 0.5 ? (S1 || S0) : (S0 || S1);
    if (!A && !fallback) return false;
    const B0 = A && imgs[i] && imgs[i + 1] ? imgs[i + 1] : null;
    const key = `${base}|${kind}|${A ? A.src : fallback.src}|${B0 ? Math.round(a * 64) : 0}|${Math.round(tt * 400)}|${!!S0}|${!!S1}|${w}`;
    if (canvas.__drawn === key) return true;
    canvas.__drawn = key;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#070707';
    ctx.fillRect(0, 0, w, h);
    if (!A) { cover(fallback, 1); ctx.globalAlpha = 1; return true; }
    // 重ねるのは「隣り合う2コマが両方そろっている時」だけ（離れたコマ同士を重ねると二重に見える）
    const B = imgs[i] && imgs[i + 1] ? imgs[i + 1] : null;
    cover(A, 1);
    if (B && a > 0.01) cover(B, a);
    // 始まりと終わり際は高画質の静止画へ溶かす
    const f0 = stills.fadeIn ?? 0.04, f1 = stills.fadeOut ?? 0.04; // 溶かす長さ（動画の端に乱れがある章だけ長くする）
    if (S0 && tt < f0) cover(S0, Math.min((f0 - tt) / f0, 1));
    if (S1 && tt > 1 - f1) cover(S1, Math.min((tt - (1 - f1)) / f1, 1));
    ctx.globalAlpha = 1;
    return true;
  }
  function release() { for (const k of Object.keys(sets)) delete sets[k]; for (const k of Object.keys(pending)) delete pending[k]; }
  const prefetch = () => load(portrait() ? 'sp' : 'pc').catch(() => {});
  return { draw, resize, release, prefetch };
}
