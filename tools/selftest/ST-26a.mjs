// ST-26a 自測：矩陣檢視切換 matrixView（只看目前／目前＋競爭者／全部）
// 跑法（Node 24+、google-chrome，CHROME_BIN 可覆寫）：node tools/selftest/ST-26a.mjs
// 測：載入「網路書店 A 公司」（current 11、future 7、rival 6 支箭頭）→
//   1) 預設 matrixView==='current'、下拉同步；
//   2) 三種視圖 #lineCanvas 內 path/line（排除 defs）數 11／17／24；
//   3) ⚔ td.cell.clash 數：current 0、rivals/all >0；
//   4) 圖例 #legendContainer .legend-item 數 1／2／3；
//   5) 點第 2 個構想 chip（activeIdx=1）後 current 視圖連線 7、圖例 1；
//   6) setMatrixView('all') 後 reload → matrixView 仍為 'all'；存檔有 matrixView、沒有 overlayAll；
//   7) 舊存檔 fixture（含 overlayAll:true）載入 → matrixView==='current'、無 console error。
// 截圖：$CLAUDE_JOB_DIR/tmp/st26/ST-26a-{current,rivals,all}.png。預期輸出全部 PASS、exit 0。
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launch } from '../cdp-harness.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const html = resolve(here, '../../index.html');
const fixture = resolve(here, '../../tests/fixtures/strategyMatrix_v4-bookstore-a.json');
const out = (process.env.CLAUDE_JOB_DIR || tmpdir()) + '/tmp/st26'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const chk = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };
const COUNT_JS = "JSON.stringify({"
  + " lines: [...document.querySelectorAll('#lineCanvas path, #lineCanvas line')].filter(e => !e.closest('defs')).length,"
  + " clash: document.querySelectorAll('td.cell.clash').length,"
  + " legend: document.querySelectorAll('#legendContainer .legend-item').length,"
  + " view: matrixView, sel: document.getElementById('matrixViewSel').value })";

const h = await launch();
try {
  await h.open(html);
  await h.loadExample('bookstore-a');
  await h.ev("guideGoto('ideas'); 0");  // ① 會隱藏矩陣（drawLines 不畫），切到 ② 才有連線
  await sleep(500);
  const count = () => h.ev(COUNT_JS).then(JSON.parse);
  let c = await count();
  chk(c.view === 'current' && c.sel === 'current', '預設檢視 current（view=' + c.view + ' sel=' + c.sel + '）');
  const exp = { current: [11, 1], rivals: [17, 2], all: [24, 3] };
  for (const v of ['current', 'rivals', 'all']) {
    await h.ev("(() => { const s = document.getElementById('matrixViewSel'); s.value = '" + v + "'; s.dispatchEvent(new Event('change')); })()");
    await sleep(300);
    c = await count();
    chk(c.lines === exp[v][0], v + '：連線 ' + c.lines + '（預期 ' + exp[v][0] + '）');
    chk(v === 'current' ? c.clash === 0 : c.clash > 0, v + '：⚔ ' + c.clash);
    chk(c.legend === exp[v][1], v + '：圖例 ' + c.legend + '（預期 ' + exp[v][1] + '）');
    await h.shot('#matrixContainer', out + '/ST-26a-' + v + '.png');
  }
  await h.ev("setMatrixView('current')");
  await h.ev("document.querySelectorAll('#competitorBar .competitor-chip')[1].click()");
  await sleep(300);
  c = await count();
  const ai = await h.ev('activeIdx');
  chk(ai === 1 && c.lines === 7 && c.legend === 1, 'activeIdx=' + ai + ' 只看目前：連線 ' + c.lines + '（預期 7）圖例 ' + c.legend);
  await h.ev("setMatrixView('all')");
  await h.send('Page.reload'); await sleep(1500); await h.stubDialogs();
  c = await count();
  chk(c.view === 'all' && c.sel === 'all', 'reload 後保留 all（view=' + c.view + ' sel=' + c.sel + '）');
  const saved = JSON.parse(await h.ev("localStorage.getItem('strategyMatrix_v4')"));
  chk(saved.matrixView === 'all' && !('overlayAll' in saved), '存檔寫 matrixView、不再寫 overlayAll');
  // 舊存檔（含 overlayAll:true）
  const raw = JSON.parse(readFileSync(fixture, 'utf8'));
  chk(raw.overlayAll === true, 'fixture 含 overlayAll:true');
  await h.ev("localStorage.setItem('strategyMatrix_v4', " + JSON.stringify(JSON.stringify(raw)) + "); 0");
  await h.send('Page.reload'); await sleep(1500); await h.stubDialogs();
  c = await count();
  chk(c.view === 'current' && c.sel === 'current' && c.lines === 11, '舊存檔載入 → ' + c.view + '、連線 ' + c.lines + '（預期 current、11）');
  const errs = h.errors();
  chk(errs.length === 0, 'console error ' + errs.length + (errs.length ? '：' + JSON.stringify(errs) : ''));
} finally { await h.close(); }
console.log('截圖：' + out);
process.exit(fail ? 1 : 0);
