// O&K TRADE — 全ページ共通（メニュー・リビール・コレクションのデータと絵）
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initMenu() {
  const btn = $('.menu-btn');
  btn?.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  $$('.site-nav a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('menu-open')));
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

// ① 慣性スクロール（Lenis）。読めなければ普通のスクロールのまま
export async function initLenis() {
  if (reduceMotion()) return null;
  try {
    const { default: Lenis } = await import('https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.mjs');
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, touchMultiplier: 1.4 });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const t = id.length > 1 && document.querySelector(id);
      if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -70 }); }
    }));
    if (location.hash) { const t = document.querySelector(location.hash); if (t) setTimeout(() => lenis.scrollTo(t, { offset: -70, immediate: true }), 50); }
    window.__lenis = lenis;
    return lenis;
  } catch (e) { return null; }
}

// ② 文字が1つずつ浮かぶ（見出し・本文）＋カード群は1枚ずつ（時差は最大6つまで）
const CARD = '.item, .space-card, .step, .way, .finish-card, .prov-card, .faq details, .company-table, .contact-form, .collection-grid, .hero3d-wrap, .space-visual, .cta-row, .more, .filter, .ar-row, .finish-btns';
const TEXT = 'h1, h2, h3, .eyebrow, .sec-lead, .page-lead, .concept-body p, .contact-lead, .space-lead, .space-en, .bullets li, .mini, .finish-name, .note';
export function initReveal() {
  const targets = [];
  $$(TEXT).forEach((el) => {
    if (el.closest('.story, .site-header, .site-footer, .ar-dialog')) return;
    if (el.closest(CARD)) return;
    // 外側にまとめて浮かぶ箱があれば外す（二重に動かさない）
    const wrap = el.parentElement.closest('.reveal');
    if (wrap && !wrap.matches(CARD)) wrap.classList.remove('reveal');
    el.classList.remove('reveal');
    el.classList.add('tx');
    targets.push(el);
  });
  $$('.reveal').forEach((el) => targets.push(el));
  // 同じ親の中で順番に少しずつ遅らせる
  const groups = new Map();
  targets.forEach((el) => {
    const g = el.closest('section, header, .space-row, ul, ol, .faq, .ways') || document.body;
    const n = groups.get(g) || 0;
    el.style.transitionDelay = `${Math.min(n, 6) * 0.07}s`;
    groups.set(g, n + 1);
  });
  if (reduceMotion()) { targets.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  targets.forEach((el) => io.observe(el));
}

// ③ スクロールに合わせて背景の光がゆっくり動く（全ページ共通の地）
export function initGlow() {
  const glow = document.createElement('div');
  glow.className = 'bg-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.prepend(glow);
  let last = -1;
  (function loop() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const sp = scrollY / max;
    if (Math.abs(sp - last) > 0.0005) { glow.style.setProperty('--sp', sp.toFixed(4)); last = sp; }
    requestAnimationFrame(loop);
  })();
}

// ④ マウスの位置に追従する輪（PCのみ）＋ボタンが少し吸い寄せられる
export function initCursor() {
  if (!finePointer() || reduceMotion()) return;
  const ring = document.createElement('div');
  ring.className = 'cursor';
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring);
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; ring.classList.add('is-on'); }, { passive: true });
  document.addEventListener('pointerleave', () => ring.classList.remove('is-on'));
  const HOT = 'a, button, .item, .chip, summary, canvas.hero3d';
  document.addEventListener('pointerover', (e) => ring.classList.toggle('is-hot', !!e.target.closest(HOT)));
  (function loop() {
    cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
    ring.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  })();
  $$('.btn-primary, .btn-ghost, .nav-cta').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 8}px, ${((e.clientY - r.top) / r.height - 0.5) * 6}px)`;
    });
    b.addEventListener('pointerleave', () => (b.style.transform = ''));
  });
}

// ⑤ カードが手前に傾く（PCのみ・最大6度）
export function initTilt(sel = '.item, .way, .finish-card, .space-visual') {
  if (!finePointer() || reduceMotion()) return;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateZ(0)`;
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
    el.classList.add('is-tilt');
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest(sel);
    if (el && !el.contains(e.relatedTarget)) { el.style.transform = ''; el.classList.remove('is-tilt'); }
  });
}

export function initMotion() {
  initLenis();
  initReveal();
  initGlow();
  initCursor();
  initTilt();
}

// 製品イメージ13品（先方のイメージ画像の名前と仕上げのまま）
// cat: table / storage / light / other
// 商品＝先方の一覧画像（2026-10-24）の11品。写真はコンクリートの床で撮り直した版（_ai_raw/collection/concrete）。10ペンダントライト・13プランターは作らないので外した（番号は先方の画像どおり）
export const ITEMS = [
  { no: '01', name: 'コーヒーテーブル', sub: 'ポリッシュフィニッシュ', fin: 'polish', sp: 10, tw: true, cat: 'table', w: 2400, h: 1792 },
  { no: '02', name: 'コーヒーテーブル', sub: 'ブラックフィニッシュ', fin: 'black', sp: 10, tw: true, cat: 'table', w: 2400, h: 1792 },
  { no: '03', name: 'コーヒーテーブル', sub: 'ゴールドフィニッシュ', fin: 'gold', sp: 10, tw: true, cat: 'table', w: 2400, h: 1792 },
  { no: '04', name: 'カーボンテーブル', sub: 'カーボン×ブラック', fin: 'black', sp: 5, tw: false, cat: 'table', w: 2528, h: 1696 },
  { no: '05', name: 'ストレートスポークテーブル', sub: 'メッシュデザイン', fin: 'polish', sp: 20, tw: false, cat: 'table', w: 2752, h: 1536 },
  { no: '06', name: 'サイドテーブル', sub: 'コンパクトモデル', fin: 'black', sp: 6, tw: true, cat: 'table', w: 2304, h: 1856 },
  { no: '07', name: 'バーテーブル', sub: 'ハイタイプ', fin: 'black', sp: 10, tw: true, cat: 'table', w: 2400, h: 1792 },
  { no: '08', name: 'スツール', sub: 'クッション仕様', fin: 'black', sp: 0, tw: false, cat: 'other', w: 2048, h: 2048 },
  { no: '09', name: 'ウォールクロック', sub: '壁掛け時計', fin: 'black', sp: 10, tw: true, cat: 'light', w: 2048, h: 2048 },
  { no: '11', name: 'ディスプレイシェルフ', sub: '飾り棚', fin: 'black', sp: 5, tw: false, cat: 'storage', w: 2304, h: 1856 },
  { no: '12', name: 'TVボード', sub: 'ローボード', fin: 'black', sp: 6, tw: true, cat: 'storage', w: 2752, h: 1536 },
];
export const CATS = { table: 'テーブル', storage: '収納', light: '時計', other: 'スツール' };

const FIN = { polish: ['#f2f2f2', '#9a9a9a'], black: ['#6e6e6e', '#232323'], gold: ['#f1cf93', '#9c7337'] };
export const FIN_LABEL = { polish: 'ポリッシュ', black: 'ブラック', gold: 'ゴールド' };

export function wheelSvg(fin, spokes, twin, id) {
  const [c1, c2] = FIN[fin];
  let s = '';
  const n = twin ? spokes / 2 : spokes;
  for (let i = 0; i < n; i++) {
    const base = (i / n) * 360;
    for (const o of twin ? [-5, 5] : [0]) s += `<line x1="50" y1="50" x2="50" y2="13" transform="rotate(${base + o} 50 50)"/>`;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="g${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <circle cx="50" cy="50" r="42" fill="none" stroke="url(#g${id})" stroke-width="5"/>
  <circle cx="50" cy="50" r="36" fill="none" stroke="url(#g${id})" stroke-width="1" opacity=".6"/>
  <g stroke="url(#g${id})" stroke-width="${spokes >= 20 ? 1.4 : 3}" stroke-linecap="round">${s}</g>
  <circle cx="50" cy="50" r="8" fill="url(#g${id})"/><circle cx="50" cy="50" r="3.4" fill="#d29a73"/></svg>`;
}

export function itemCard(it, { detail = false } = {}) {
  return `
  <li class="item" data-cat="${it.cat}">
    <div class="item-visual"><img src="assets/products/${it.no}.webp" alt="${it.name}（${it.sub}）のデザインイメージ" loading="lazy" decoding="async" width="${it.w}" height="${it.h}"><span class="item-tag">デザインイメージ</span></div>
    <p class="item-no">${it.no}</p>
    <h3 class="item-name">${it.name}</h3>
    <p class="item-sub">${it.sub}</p>
    ${detail ? `<dl class="item-spec"><div><dt>仕上げ</dt><dd>${FIN_LABEL[it.fin]}ほか</dd></div><div><dt>寸法・重さ</dt><dd><span class="tbd">準備中</span></dd></div><div><dt>価格</dt><dd><span class="tbd">準備中</span></dd></div></dl>` : ''}
  </li>`;
}
