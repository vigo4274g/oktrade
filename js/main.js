// O&K TRADE — TOP：スクロールとリアルタイム3D・文字の同期（車 → 分解 → ホイール → テーブル → 部屋 → 仕上げ）
// ※コマ送り方式（scrub.js / frames/story）は 2026-10-20 に試して、源斗さん判断で前の3Dに戻した（ファイルは残してある）
import { createStory } from './scene.js';
import { initMenu, initMotion, ITEMS, itemCard } from './common.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- opening ----------
const opening = $('#opening');
const endOpening = () => { opening?.classList.add('is-done'); document.body.classList.add('is-ready'); };
if (reduce || location.search.includes('p=')) endOpening(); else { setTimeout(endOpening, 1900); opening?.addEventListener('click', endOpening); }

// ---------- header / menu ----------
const header = $('.site-header');
initMenu();

// ---------- story ----------
const story = $('#story');
const caps = $$('.cap');
const dots = $$('.axis li');
const hint = $('.scroll-hint');
const glCanvas = $('#gl');
const chLayer = $('.ch-layer');
const heroImg = chLayer?.querySelector('.hero-photo img');
const chCanvas = $('#ch-canvas');
const callouts = $$('.co');
const calloutGroups = $$('.callouts[data-on]');
const hudFill = $('.hud-fill');
const hudNum = $('.hud-num b');
const hudTicks = $$('.hud-ticks li');
// 写真級の章（02〜06）：スクロールの範囲 t0→t1 でコマ送り、範囲の外は前の章の最後の絵で止まる
// 止まって見る最初と最後の絵だけ、高画質化した静止画に差し替える（end ＝ 次の章の start）
const PH = 'assets/photos/';
const CH = [
  { id: 'ch02', t0: .06, t1: .18, start: 'scene1', end: 'explode' },
  { id: 'ch03', t0: .23, t1: .335, end: 'pickup' },
  { id: 'ch04', t0: .39, t1: .495, end: 'restore' },
  { id: 'ch05', t0: .55, t1: .655, end: 'table', fadeOut: .2 }, // スマホ版の終わり2割にガラスの白い映り込み → 直した静止画へ早めに溶かす
  { id: 'ch06', t0: .71, t1: .815, end: 'space' },
];
CH.forEach((c, i) => { if (!c.start) c.start = CH[i - 1].end; });
const pair = (n) => ({ pc: `${PH}${n}-pc.webp`, sp: `${PH}${n}-sp.webp` });
let chScrubMod = null;
function ensureChapter(i) {
  const c = CH[i];
  if (!c || c.loading || !chCanvas) return;
  c.loading = true;
  (chScrubMod ||= import('./chscrub.js'))
    .then(({ createChapterScrub }) => createChapterScrub(chCanvas, `frames/${c.id}`, { start: pair(c.start), end: pair(c.end), fadeIn: c.fadeIn, fadeOut: c.fadeOut }))
    .then((sc) => { c.scrub = sc; })
    .catch((e) => { console.warn(`${c.id}のコマが読めない（3秒後にもう一度）`, e); setTimeout(() => { c.loading = false; }, 3000); });
}
ensureChapter(0);
// キャンバスに何か描けたら表に出し、下の最初の写真は隠す（重なって二重に見えないように）
// ※FINISHの位置で読み込み直した時（ブラウザがスクロール位置を戻す）もここを通す
function showCanvas() { chCanvas.style.opacity = '1'; heroImg.parentElement.style.visibility = 'hidden'; }
// FINISH（写真版）：仕上げ3色を写真で切り替える（回さない）
let turn = null;
if (chCanvas) import('./turntable.js').then(({ createTurntable }) => { turn = createTurntable(chCanvas, 'assets/photos', ['polish', 'black', 'gold']); });
// 注釈の位置：コマと同じ「画面いっぱいに切り抜く」計算で、画像の中の位置→画面の位置に変換
const IMG = { pc: [1928, 1072], sp: [1072, 1928] };
function placeCallouts() {
  const portrait = innerHeight > innerWidth;
  const [iw, ih] = IMG[portrait ? 'sp' : 'pc'];
  const sc = Math.max(innerWidth / iw, innerHeight / ih);
  const ox = (innerWidth - iw * sc) / 2, oy = (innerHeight - ih * sc) / 2;
  callouts.forEach((c) => {
    const [x, y] = c.dataset[portrait ? 'sp' : 'pc'].split(',').map(Number);
    c.style.left = `${(ox + x * iw * sc).toFixed(1)}px`;
    c.style.top = `${(oy + y * ih * sc).toFixed(1)}px`;
  });
}
if (callouts.length) { placeCallouts(); addEventListener('resize', placeCallouts); }
let sceneApi = null;
try {
  if (!chLayer) sceneApi = createStory($('#gl'));
} catch (e) {
  console.error(e);
  document.body.classList.add('no-webgl');
}

const resize = () => sceneApi?.resize(innerWidth, innerHeight);
addEventListener('resize', resize);
resize();

let pRaw = 0, p = 0, last = performance.now();
const debugP = new URLSearchParams(location.search).get('p'); // 検品用：?p=0.6 でその場面に固定
function readProgress() {
  const r = story.getBoundingClientRect();
  pRaw = clamp(-r.top / (r.height - innerHeight));
  return r;
}

function setCaps(v) {
  for (const c of caps) {
    const a = parseFloat(c.dataset.in), b = parseFloat(c.dataset.out);
    const fi = a <= 0 ? 1 : clamp((v - a) / 0.03);
    const fo = b >= 1 ? 1 : clamp((b - v) / 0.03);
    const o = Math.min(fi, fo);
    c.style.opacity = o.toFixed(3);
    c.style.transform = `translate3d(0, ${((1 - o) * 18).toFixed(1)}px, 0)`;
    c.classList.toggle('is-on', o > 0.5);
  }
  // 今の場面＝data-p が今の位置より手前にある最後の点（TOPと試作で点の数が違っても動く）
  let stage = 0;
  dots.forEach((d, i) => { if (i && v >= (parseFloat(dots[i - 1].dataset.p) + parseFloat(d.dataset.p)) / 2) stage = i; });
  dots.forEach((d, i) => d.classList.toggle('is-on', i === stage));
  hint?.classList.toggle('is-hidden', v > 0.02);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const r = readProgress();
  p += (pRaw - p) * (1 - Math.exp(-dt * (reduce ? 30 : 7)));
  if (debugP !== null) p = parseFloat(debugP);
  const inView = r.bottom > 0 || debugP !== null;
  header.classList.toggle('is-solid', !inView || r.bottom < innerHeight * 0.6);
  glCanvas.style.visibility = inView ? 'visible' : 'hidden'; // 物語を抜けたら3Dを隠す（下のセクションは背景が透けるため）
  if (chLayer) {
    // 01＝写真 → 02〜06＝写真級の動画をスクロールでコマ送り（章の間は前の章の最後の絵で止めて注釈）→ FINISHは回せる写真
    let ci = 0;
    CH.forEach((c, i) => { if (p >= c.t0) ci = i; });
    ensureChapter(ci); ensureChapter(ci + 1); // 今の章と次の章だけ先に読む
    // 前後1章より離れた章のコマは手放す（メモリが増え続けるとカクつく）。近づいたら読み直す
    CH.forEach((c, i) => {
      if (!c.scrub) return;
      if (i < ci - 1 || i > ci + 1) { if (!c.idle) { c.scrub.release(); c.idle = true; } }
      else if (i === ci || i === ci + 1) { c.idle = false; c.scrub.prefetch(); }
    });
    // 次の章のコマがまだ無ければ、前の章の最後の絵で待つ
    let k = ci;
    while (k > 0 && !CH[k].scrub) k--;
    const cur = CH[k];
    // FINISH：06の部屋から、回せるテーブルの写真へ溶かす（3Dには切り替えない）
    const fa = turn ? clamp((p - 0.86) / 0.03) : 0;
    if (turn && p > 0.78) turn.preload();
    if (fa < 1) {
      if (fa > 0) chCanvas.__drawn = null; // 溶かしている間は毎回下の絵から描き直す（重ね塗りで濃くならないように）
      if (cur.scrub && cur.scrub.draw(k === ci ? clamp((p - cur.t0) / (cur.t1 - cur.t0)) : 1)) showCanvas();
    }
    if (fa > 0) {
      const ok = turn.draw(fa, dt);
      if (ok) showCanvas();
      if (fa < 1) chCanvas.__drawn = null;
      // 仕上げの写真がまだ解読中なら、06の部屋の絵を出しておく（前の章の絵が残らないように）
      else if (!ok) { const last = CH[CH.length - 1]; if (last.scrub) { if (last.scrub.draw(1)) showCanvas(); } else ensureChapter(CH.length - 1); }
    }
    chLayer.style.opacity = '1';
    chLayer.style.visibility = inView ? 'visible' : 'hidden'; // 物語を抜けたら隠す（下のセクションは背景が透ける）
    glCanvas.style.visibility = 'hidden';
    heroImg.style.transform = `scale(${(1.06 - clamp(p / 0.06) * 0.06).toFixed(4)})`;
    // 注釈：絵が止まったところで、組ごとに順に出る（data-on="出始め,消える"）
    calloutGroups.forEach((g) => {
      const [a, b] = (g.__on ||= g.dataset.on.split(',').map(Number));
      (g.__co ||= $$('.co', g)).forEach((c, i) => c.classList.toggle('is-on', p > a + i * 0.008 && p < b));
    });
    if (hudFill) {
      hudFill.style.transform = `scaleX(${clamp(p).toFixed(4)})`;
      let ch = 1;
      CH.forEach((c, i) => { if (p >= c.t0 - 0.02) ch = i + 2; });
      if (p >= 0.87) ch = 7;
      hudNum.textContent = '0' + Math.min(ch, 6);
      hudTicks.forEach((li, i) => li.classList.toggle('is-on', i === ch - 1));
    }
  }
  if (inView) {
    setCaps(p);
    if (!chLayer) sceneApi?.update(p, dt, now / 1000); // 写真版では3Dは描かない（重さを減らす）
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 軸のドット → その場面へ
dots.forEach((d) => d.addEventListener('click', () => {
  const t = parseFloat(d.dataset.p);
  const top = story.offsetTop + t * (story.offsetHeight - innerHeight);
  if (window.__lenis) window.__lenis.scrollTo(top); else scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
}));

// pointer
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return; // 指でのスクロール中はカメラを動かさない（カクつき・はみ出しの原因になる）
  sceneApi?.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
}, { passive: true });

// 仕上げの切替＋ドラッグで回す
$$('.finish-btn').forEach((b) => b.addEventListener('click', () => {
  $$('.finish-btn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  b.setAttribute('aria-pressed', 'true');
  sceneApi?.setFinish(b.dataset.finish);
  turn?.setFinish(b.dataset.finish);
  $('.finish-name').textContent = b.dataset.label;
}));
const dragZone = $('.drag-zone');
let dragging = false, lastX = 0;
dragZone?.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; dragZone.setPointerCapture(e.pointerId); });
dragZone?.addEventListener('pointermove', (e) => { if (!dragging) return; sceneApi?.addDrag((e.clientX - lastX) * 0.01); turn?.addDrag(e.clientX - lastX); lastX = e.clientX; });
dragZone?.addEventListener('pointerup', () => (dragging = false));
dragZone?.addEventListener('pointercancel', () => (dragging = false));

// ---------- AR（model-viewer・開いた時だけ読み込む）----------
const arDialog = $('.ar-dialog');
$('.ar-open')?.addEventListener('click', async () => {
  if (!customElements.get('model-viewer')) {
    await new Promise((ok, ng) => {
      const sc = document.createElement('script');
      sc.type = 'module';
      sc.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
      sc.onload = ok; sc.onerror = ng;
      document.head.append(sc);
    });
  }
  const stage = $('.ar-stage', arDialog);
  if (!stage.firstChild) {
    stage.innerHTML = `<model-viewer src="assets/models/wheel-table-placeholder.glb" alt="ホイールテーブルの3Dモデル（試作）"
      ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" camera-controls touch-action="pan-y"
      shadow-intensity="1" exposure="1" environment-image="neutral" camera-orbit="30deg 65deg auto"></model-viewer>`;
  }
  arDialog.showModal();
});
$('.ar-close')?.addEventListener('click', () => arDialog.close());
arDialog?.addEventListener('click', (e) => { if (e.target === arDialog) arDialog.close(); });

// ---------- collection（先方の一覧画像の並び：3・5・3枚。各段は写真の縦横比で幅を分ける）----------
const grid = $('.collection-grid');
if (grid) grid.innerHTML = ITEMS.slice(0, 6).map((it) => itemCard(it)).join('');
const mosaic = $('.mosaic');
if (mosaic) {
  const byNo = Object.fromEntries(ITEMS.map((it) => [it.no, it]));
  mosaic.innerHTML = mosaic.dataset.rows.split('|').map((row) => `<div class="m-row">${row.split(',').map((no) => {
    const it = byNo[no];
    return `<a class="m-tile reveal" href="collection.html" style="--ar:${(it.w / it.h).toFixed(3)}">
      <img src="assets/products/${it.no}.webp" alt="${it.name}（${it.sub}）のデザインイメージ" loading="lazy" decoding="async" width="${it.w}" height="${it.h}">
      <span class="m-cap"><span class="m-no">${it.no}</span><span class="m-name">${it.name}</span><span class="m-sub">（${it.sub}）</span></span>
    </a>`;
  }).join('')}</div>`).join('');
}

initMotion();
