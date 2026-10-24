// 下層ページ共通
import { initMenu, initMotion, ITEMS, CATS, itemCard } from './common.js';
import { mountHero3d } from './hero3d.js';
import { planSvg } from './plans.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

document.body.classList.add('is-ready');
initMenu();

const hero = $('.hero3d');
if (hero) {
  try { mountHero3d(hero); } catch (e) { console.error(e); hero.remove(); }
}

// COLLECTION：一覧＋絞り込み
const grid = $('.collection-grid--full');
if (grid) {
  grid.innerHTML = ITEMS.map((it) => itemCard(it, { detail: true })).join('');
  const bar = $('.filter');
  bar.innerHTML = [['all', 'すべて'], ...Object.entries(CATS)]
    .map(([k, v], i) => `<button class="filter-btn" data-cat="${k}" aria-pressed="${i === 0}">${v}<span>${k === 'all' ? ITEMS.length : ITEMS.filter((it) => it.cat === k).length}</span></button>`).join('');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.filter-btn');
    if (!b) return;
    $$('.filter-btn', bar).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $$('.item', grid).forEach((li) => (li.hidden = b.dataset.cat !== 'all' && li.dataset.cat !== b.dataset.cat));
  });
}

// SPACE：各行の絵
$$('.space-visual').forEach((el) => {
  const en = el.closest('.space-row')?.querySelector('.space-en')?.textContent || '';
  el.insertAdjacentHTML('afterbegin', planSvg(el.dataset.no, en));
});

// CONTACT：送信先が決まるまでは送らない
const form = $('.contact-form');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  $('.form-status').textContent = '送信窓口は準備中です。公開時にお問い合わせを受け付けられるようにします。';
});

initMotion();
