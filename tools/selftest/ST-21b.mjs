// ST-21b／ST-21d 自測：六步 tab 骨架＋區塊歸位
// 跑法（Node 24+、/usr/bin/google-chrome，CHROME_BIN 可覆寫）：
//   node tools/selftest/ST-21b.mjs [基準版 index.html，預設 ../dev/index.html（同層 dev worktree）]
// 測：
//   A) 載範例 bookstore-a 後依序 guideGoto 六步：只有該步 pane 顯示；矩陣區（#stepMatrix）① 隱藏、②–⑥ 顯示；
//      策略構想 panel（#competitorBar）③–⑥ 顯示；#cellPanel 只在 ②④ 顯示；模式 ②describe ③draw ④–⑥view（① 不切）；
//      location.hash＝#step-N；各區塊（#strategyTitle、#valueChainEditor、#moduleBox、#arrowList、#sentenceBox、#premiseBox、
//      #clashBox、#actionBox、#controlBox）在對的 pane；details 預設 open；p.instructions 不存在；每步有 #guideCard-<k> 空容器
//   B) ③ 下 svg#lineCanvas 有 path 且座標非 0；① 下 svg#vcLineCanvas 有連線（範例有 links 時）
//   C) ④ 呼叫 flashArrowItem → 自動切到 ③
//   D) URL 帶 #step-4 reload → 開在 ④；hashchange 到 #step-6 → 切到 ⑥
//   E) 舊存檔 tests/fixtures/strategyMatrix_v4-bookstore-a.json 塞 localStorage 後 reload：無 console error、tab 列六格、有 active pane
//   F) 寬 700px：tab 列 3 欄（3×2）
//   G) PPTX：新版與基準版匯出 bookstore-a 的 ppt/slides/*.xml 全部相同
//   全程 h.errors() 為空。截圖：$CLAUDE_JOB_DIR/tmp/st21b/step-1..6.png、narrow.png
// 預期：全部 PASS，exit code 0。
import { launch } from '../cdp-harness.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const newHtml = resolve(here, '../../index.html');
const baseHtml = resolve(process.argv[2] || join(here, '../../../dev/index.html'));
const fixture = readFileSync(resolve(here, '../../tests/fixtures/strategyMatrix_v4-bookstore-a.json'), 'utf8');
const out = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/st21b'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fail++; };

const KEYS = ['chain', 'cells', 'ideas', 'premise', 'action', 'control'];
const MODE = { cells: 'describe', ideas: 'draw', premise: 'view', action: 'view', control: 'view' };
const HOME = { strategyTitle: 'chain', valueChainEditor: 'chain', arrowListPanel: 'ideas', moduleBox: 'ideas', arrowList: 'ideas',
  sentenceBox: 'ideas', premiseBox: 'premise', clashBox: 'premise', actionBox: 'action', controlBox: 'control' };
const vis = sel => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});return !!e && e.offsetParent!==null})()`;

async function slideXml(file) {
  const h = await launch();
  try {
    await h.open(file);
    await h.ev('localStorage.clear(); 0'); await h.open(file);
    await h.loadExample('bookstore-a');
    await h.captureDownloads();
    await h.ev('exportPptx(); 0');
    for (let i = 0; i < 40 && !(await h.downloads()).some(d => d.name && /pptx$/.test(d.name)); i++) await sleep(250);
    const idx = (await h.downloads()).findIndex(d => d.name && /pptx$/.test(d.name));
    if (idx < 0) return null;
    const z = await h.zipEntries(idx);
    const names = z.names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
    const res = {};
    for (const n of names) res[n] = await z.read(n);
    return res;
  } finally { await h.close(); }
}

const h = await launch();
try {
  await h.open(newHtml);
  await h.ev('localStorage.clear(); 0');
  await h.open(newHtml);
  await h.loadExample('bookstore-a');
  ok(await h.ev(`document.querySelectorAll('p.instructions').length`) === 0, 'p.instructions 已刪除');
  ok(await h.ev(`document.querySelectorAll('#guideBar .guide-step').length`) === 6, 'tab 列六格');
  ok(await h.ev(`!!document.getElementById('guideTotal') && /整體 \\d+%/.test(guideTotal.textContent)`), 'tab 列下方有整體 %');
  ok(await h.ev(`!document.getElementById('guideDetail')`), 'tab 列不再畫 #guideDetail');
  ok(await h.ev(`${JSON.stringify(KEYS)}.every(k=>{const c=document.getElementById('guideCard-'+k);return c&&c.parentElement.id==='pane-'+k&&c.parentElement.firstElementChild===c&&c.innerHTML===''})`),
    '每個 pane 最上方有空的 #guideCard-<k>');
  ok(await h.ev(`Object.entries(${JSON.stringify(HOME)}).every(([id,k])=>document.getElementById(id).closest('section.step-pane').id==='pane-'+k)`), '各區塊在對的 pane');
  ok(await h.ev(`['premiseBox','clashBox','actionBox','controlBox','sentenceBox'].every(id=>document.getElementById(id).open)`), 'details 預設 open');
  ok(await h.ev(`document.getElementById('colEditor').closest('.step-pane')===null && document.getElementById('colEditor').offsetParent===null`), '#colEditor 維持隱藏、不歸 tab');

  for (let n = 1; n <= 6; n++) {
    const k = KEYS[n - 1];
    const modeBefore = await h.ev('currentMode');
    await h.ev(`guideGoto(${JSON.stringify(k)}); 0`); await sleep(500);
    const st = await h.ev(`({ step: guideStep, mode: currentMode, hash: location.hash,
      panes: [...document.querySelectorAll('section.step-pane')].filter(e=>e.offsetParent!==null).map(e=>e.id),
      matrix: ${vis('#matrixContainer')}, comp: ${vis('#competitorBar')}, cell: ${vis('#cellPanel')},
      cur: document.querySelector('#guideBar .guide-step.current')?.dataset.step })`);
    ok(st.step === k && st.cur === k && st.hash === `#step-${n}`, `${n} ${k}：guideStep／current tab／hash（${st.step} ${st.cur} ${st.hash}）`);
    ok(st.panes.length === 1 && st.panes[0] === 'pane-' + k, `${n} ${k}：只顯示自己的 pane（${st.panes}）`);
    ok(st.matrix === (n >= 2), `${n} ${k}：矩陣 ${n >= 2 ? '顯示' : '隱藏'}`);
    ok(st.comp === (n >= 3), `${n} ${k}：策略構想 panel ${n >= 3 ? '顯示' : '隱藏'}`);
    ok(st.cell === (k === 'cells' || k === 'premise'), `${n} ${k}：#cellPanel ${st.cell ? '顯示' : '隱藏'}`);
    ok(st.mode === (MODE[k] || modeBefore), `${n} ${k}：模式 ${st.mode}`);
    await h.shot(null, `${out}/step-${n}.png`);
    if (k === 'chain') {
      const vc = await h.ev(`({links: valueChain.links.length, n: document.querySelectorAll('#vcLineCanvas path, #vcLineCanvas line').length})`);
      ok(vc.links === 0 || vc.n > 0, `① 價值鏈連線已畫（links ${vc.links}、SVG ${vc.n}）`);
    }
    if (k === 'ideas') {
      const ln = await h.ev(`(()=>{const ps=[...document.querySelectorAll('#lineCanvas path, #lineCanvas line')].filter(p=>!p.closest('defs'));
        const nums=ps.flatMap(p=>((p.getAttribute('d')||'')+' '+['x1','y1','x2','y2'].map(a=>p.getAttribute(a)||'').join(' ')).match(/-?\\d+(\\.\\d+)?/g)||[]).map(Number);
        return {n: ps.length, arrows: arrows[activeIdx].length, nonzero: nums.filter(v=>v>1).length, all: nums.length}})()`);
      ok(ln.arrows > 0 && ln.n > 0 && ln.nonzero > ln.all / 2, `③ 矩陣連線有畫且座標非 0（箭頭 ${ln.arrows}、SVG ${ln.n}、非零 ${ln.nonzero}/${ln.all}）`);
    }
  }
  // C) flashArrowItem 從 ④ 跳 ③
  await h.ev(`guideGoto('premise'); flashArrowItem(arrows[activeIdx][0].id); 0`); await sleep(300);
  ok(await h.ev('guideStep') === 'ideas' && await h.ev(vis('#arrowList')), 'flashArrowItem 自動切到 ③');
  // D) URL hash
  await h.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
  await h.open('file://' + newHtml + '#step-4');
  ok(await h.ev('guideStep') === 'premise' && await h.ev(vis('#premiseBox')), '#step-4 直連開在 ④');
  await h.ev(`location.hash = '#step-6'; 0`); await sleep(400);
  ok(await h.ev('guideStep') === 'control' && await h.ev(vis('#controlBox')), 'hashchange #step-6 → ⑥');
  ok(h.errors().length === 0, '新版操作全程無 console error ' + JSON.stringify(h.errors()));
  // F) 窄螢幕
  await h.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);
  ok(await h.ev(`getComputedStyle(document.querySelector('.guide-steps')).gridTemplateColumns.split(' ').length`) === 3, '寬 700px：tab 列 3 欄（3×2）');
  await h.shot('#guideBar', `${out}/narrow.png`);
  await h.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  // E) 舊存檔（沒有 hash）
  await h.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
  await h.open(newHtml);
  await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(fixture)}); 0`);
  const before = h.errors().length;
  await h.open(newHtml);
  const old = await h.ev(`({ step: guideStep, tabs: document.querySelectorAll('#guideBar .guide-step').length,
    panes: [...document.querySelectorAll('section.step-pane')].filter(e=>e.offsetParent!==null).length, title: strategyTitle.value })`);
  ok(h.errors().length === before, '舊存檔載入無 console error ' + JSON.stringify(h.errors().slice(before)));
  ok(old.tabs === 6 && old.panes === 1 && !!old.step && /網路書店/.test(old.title), `舊存檔：六格 tab、一個 pane、guideStep=${old.step}`);
  await h.shot(null, `${out}/old-save.png`);
} finally { await h.close(); }

// G) PPTX 不變
const [a, b] = [await slideXml(newHtml), await slideXml(baseHtml)];
ok(a && b && Object.keys(a).length > 0 && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(n => a[n] === b[n]),
  `PPTX 投影片 XML 與基準版相同（${a ? Object.keys(a).length : 0} 張；基準 ${baseHtml}）`);

console.log(fail ? `\n${fail} 項 FAIL` : '\n全部 PASS'); console.log('截圖：' + out);
process.exit(fail ? 1 : 0);
