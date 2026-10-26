// ST-27c 自測：要素說明卡（ⓘ 入口＋迷你矩陣 SVG＋簡易說明／書上範例／頁碼）
// 跑法（Node 24+、google-chrome，CHROME_BIN 可覆寫）：node tools/selftest/ST-27c.mjs
// 測：載入「網路書店 A 公司」→ 切到 ③，替第 1 支箭頭標 1-1、2-7 →
//   1) chip 內有 button.elem-info，原生 title 為短版「id name（點 ⓘ 看說明）」；
//   2) 點第一個 chip 的 ⓘ → #elemCardModal.open、卡片有 svg、explain／caseExample 文字、［S 2xx］；Esc 關閉；遮罩點擊關閉；
//   3) 打開「＋要素」面板：每個 label.elem-opt 的下一個兄弟是 .elem-info；點 ⓘ 不改 checkbox 狀態、卡片開啟；
//   4) 51 項全部 openElementCard 不拋例外；svg 內 .es-arrow 數＝依 shape 算的預期段數；cells 類型反灰 rect 數＝cells 數；
//      inferred 項卡片有「※」、非 inferred 沒有；fullName 項有「簡稱：」；
//   5) 五種 shape（1-3 cells、6-2 col、1-6 row、1-2 inout、2-7 path）各截 #elemCardBox；另截 1-9／4-? 等多箭頭例；
//   6) 視窗 700px 寬開卡：document scrollWidth ≤ 700、卡片寬 ≤ 700；
//   7) console error 0。
// 截圖：$CLAUDE_JOB_DIR/tmp/st27c/ST-27c-<id>.png、ST-27c-700.png、ST-27c-panel.png、ST-27c-chips.png。預期全部 PASS、exit 0。
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launch } from '../cdp-harness.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const html = resolve(here, '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR || tmpdir()) + '/tmp/st27c'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const chk = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };
const isOpen = "document.getElementById('elemCardModal').classList.contains('open')";

const h = await launch();
try {
  await h.open(html);
  await h.loadExample('bookstore-a');
  await h.ev("guideGoto('ideas'); 0");
  await sleep(400);
  await h.ev("arrows[0][0].elements = ['1-1', '2-7']; arrows[0][1].elements = []; renderArrowList(); 0");
  await sleep(200);

  // 1) chip
  const chip = JSON.parse(await h.ev(`JSON.stringify((() => { const c = document.querySelector('.elem-chip');
    return { n: document.querySelectorAll('.elem-chip .elem-info').length, title: c && c.title }; })())`));
  chk(chip.n >= 2, 'chip 內 ⓘ 數 ' + chip.n);
  chk(chip.title === '1-1 產品與市場之配合（點 ⓘ 看說明）', 'chip title 短版：' + JSON.stringify(chip.title));
  const hintInfo = await h.ev("document.querySelectorAll('.elem-hint .elem-info').length");
  console.log('INFO 建議提示的 ⓘ 數：' + hintInfo);
  await h.shot('.arrow-elems', out + '/ST-27c-chips.png');

  // 2) 點 chip ⓘ
  await h.ev("document.querySelector('.elem-chip .elem-info').click(); 0");
  await sleep(150);
  const card = JSON.parse(await h.ev(`JSON.stringify((() => { const b = document.getElementById('elemCardBox'); const e = STRATEGY_ELEMENT_MAP['1-1'];
    return { open: ${isOpen}, svg: !!b.querySelector('svg.elem-svg'), ex: b.textContent.includes(e.explain), cs: b.textContent.includes(e.caseExample),
      page: b.textContent.includes('［S 287–288］'), t: b.querySelector('h3').textContent }; })())`));
  chk(card.open && card.svg, '點 chip ⓘ 開卡且有 svg');
  chk(card.ex && card.cs && card.page, '卡片含 explain／caseExample／［S 287–288］');
  chk(card.t === '1-1 產品與市場之配合', '標題 ' + card.t);
  await h.ev("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 0");
  chk(!(await h.ev(isOpen)), 'Esc 關閉');
  await h.ev("openElementCard('1-2'); document.getElementById('elemCardModal').dispatchEvent(new MouseEvent('click', { bubbles: true })); 0");
  chk(!(await h.ev(isOpen)), '遮罩點擊關閉');

  // 3) 面板
  await h.ev("document.querySelector('.elem-add-btn').click(); 0");
  await sleep(200);
  const pan = JSON.parse(await h.ev(`JSON.stringify((() => { const labs = [...document.querySelectorAll('.elem-panel label.elem-opt')];
    return { n: labs.length, ok: labs.every(l => l.nextElementSibling && l.nextElementSibling.classList.contains('elem-info')), title: labs[0] && labs[0].title }; })())`));
  chk(pan.n >= 51 && pan.ok, '面板 ' + pan.n + ' 個 elem-opt 旁都有 ⓘ');
  chk(!/\n/.test(pan.title || '') && /點 ⓘ 看說明/.test(pan.title || ''), '面板 title 短版：' + JSON.stringify(pan.title));
  await h.shot('.elem-panel', out + '/ST-27c-panel.png');
  const before = await h.ev("JSON.stringify([...document.querySelectorAll('.elem-panel input[data-elem-id]')].map(c => c.checked))");
  const elemsBefore = await h.ev("JSON.stringify(arrows[0][0].elements)");
  await h.ev("(() => { const l = [...document.querySelectorAll('.elem-panel label.elem-opt')].find(l => l.querySelector('input').dataset.elemId === '1-3'); l.nextElementSibling.click(); })(); 0");
  await sleep(150);
  const after = await h.ev("JSON.stringify([...document.querySelectorAll('.elem-panel input[data-elem-id]')].map(c => c.checked))");
  chk(before === after && elemsBefore === await h.ev("JSON.stringify(arrows[0][0].elements)"), '點面板 ⓘ 不改勾選與 arrow.elements');
  chk(await h.ev(isOpen) && (await h.ev("document.querySelector('#elemCardBox h3').textContent")).startsWith('1-3 '), '面板 ⓘ 開 1-3 卡片');
  await h.ev('closeElementCard(); 0');

  // 4) 51 項全跑
  const all = JSON.parse(await h.ev(`JSON.stringify((() => {
    const res = [];
    const expArrows = s => s.type === 'col' ? (Array.isArray(s.arrows) ? s.arrows.length : 1)
      : s.type === 'row' ? s.arrows.length : s.type === 'inout' ? s.from.length
      : s.type === 'path' ? (s.path.length - 1) + (s.extra || []).reduce((n, p) => n + p.length - 1, 0) : 0;
    STRATEGY_ELEMENTS.forEach(e => {
      let err = '';
      try { openElementCard(e.id); } catch (x) { err = String(x); }
      const b = document.getElementById('elemCardBox');
      const arrowsN = b.querySelectorAll('svg .es-arrow').length, grayN = b.querySelectorAll('svg rect.es-cell.gray').length;
      const grayExp = new Set((e.shape.cells || []).map(c => c.join('|'))).size;
      const txt = b.textContent;
      res.push({ id: e.id, err, ok: arrowsN === expArrows(e.shape) && grayN === grayExp
        && txt.includes('※') === !!e.shape.inferred && txt.includes('簡稱：') === !!e.fullName && txt.includes('［' + e.page + '］'),
        arrowsN, exp: expArrows(e.shape), grayN, grayExp });
      closeElementCard();
    });
    return res; })())`));
  const bad = all.filter(r => r.err || !r.ok);
  chk(all.length === 51 && bad.length === 0, '51 項 openElementCard 無例外、箭頭／反灰／※／簡稱／頁碼正確' + (bad.length ? '；錯：' + JSON.stringify(bad) : ''));
  chk(await h.ev("(() => { const s = renderElementShapeSvg(null) + renderElementShapeSvg({ type: 'zzz' }) + renderElementShapeSvg({ type: 'path', path: 3 }); return s.includes('<svg') && !s.includes('es-arrow'); })()"), '缺／不合法 shape 畫空矩陣');

  // 5) 截圖
  for (const id of ['1-3', '6-2', '1-6', '1-2', '2-7', '1-9', '5-9', '6-8']) {
    await h.ev(`openElementCard('${id}'); 0`);
    await sleep(120);
    await h.shot('#elemCardBox', out + '/ST-27c-' + id + '.png');
    await h.ev('closeElementCard(); 0');
  }
} finally {
  const errs = h.errors();
  chk(errs.length === 0, 'console error 0' + (errs.length ? '：' + errs.join(' | ') : ''));
  await h.close();
}

// 6) 700px 寬
const h2 = await launch({ width: 700, height: 900 });
try {
  await h2.open(html);
  await h2.loadExample('bookstore-a');
  await h2.ev("openElementCard('2-7'); 0");
  await sleep(200);
  const w = JSON.parse(await h2.ev("JSON.stringify({ doc: document.documentElement.scrollWidth, box: document.getElementById('elemCardBox').getBoundingClientRect().width, inner: document.getElementById('elemCardBox').scrollWidth <= document.getElementById('elemCardBox').clientWidth })"));
  chk(w.doc <= 700 && w.box <= 700 && w.inner, '700px：doc scrollWidth ' + w.doc + '、卡寬 ' + Math.round(w.box) + '、卡內不橫捲 ' + w.inner);
  await h2.shot('#elemCardBox', out + '/ST-27c-700.png');
  const errs = h2.errors();
  chk(errs.length === 0, '700px console error 0' + (errs.length ? '：' + errs.join(' | ') : ''));
} finally { await h2.close(); }

console.log('截圖：' + out);
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
