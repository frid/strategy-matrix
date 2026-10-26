// ST-35f 自測：專案區「🧩 版型」下拉（#vcLayoutSelect）與價值鏈工具列 .vc-layout-select 雙向同步，版型進存檔。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35f.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35f/）
// 測了什麼：兩 fixtures（localStorage 注入後 reload）與兩範例載入無 console error 且專案區下拉＝porter；
//   專案區切 hex → .vc-zones 有 vc-layout-hex、工具列同步；工具列切 band → 專案區同步；
//   saveState 後 localStorage valueChain.layout==='band'；reload 後兩處皆 band；
//   exportStateJSON／exportValueChainJSON 下載內容 layout==='band'；importStateJSON（餵 layout=segment）後兩處 segment；
//   選項數＝VC_LAYOUTS 長度；800 寬 project-bar 無橫向溢位並截圖。
// 預期：ALL PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35f'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const vals = h => h.ev(`[document.getElementById('vcLayoutSelect').value, document.querySelector('.vc-layout-select').value, document.querySelector('.vc-zones').className]`);
const pick = (h, sel, v) => h.ev(`(()=>{const s=document.querySelector(${JSON.stringify(sel)});s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`);

const h = await launch({ width: 1400, height: 900 });
try {
  await h.open(html); await h.ev('localStorage.clear(); 0');
  for (const f of ['bookstore-a', 'foundry-t']) {
    const raw = readFileSync(root + `/tests/fixtures/strategyMatrix_v4-${f}.json`, 'utf8');
    await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
    await h.open(html);
    const v = await vals(h);
    ok(v[0] === 'porter' && v[1] === 'porter', `fixture ${f}：專案區下拉 porter（${v[0]}/${v[1]}）`);
  }
  for (const id of ['bookstore-a', 'foundry-t']) {
    await h.loadExample(id);
    const v = await vals(h);
    ok(v[0] === 'porter' && v[1] === 'porter', `範例 ${id}：porter`);
  }
  const n = await h.ev(`[document.getElementById('vcLayoutSelect').options.length, VC_LAYOUTS.length]`);
  ok(n[0] === n[1], `選項數 ${n[0]} = VC_LAYOUTS ${n[1]}`);
  await pick(h, '#vcLayoutSelect', 'hex'); await sleep(500);
  let v = await vals(h);
  ok(v[0] === 'hex' && v[1] === 'hex' && v[2].includes('vc-layout-hex'), `專案區切 hex → 工具列同步、zones 有 vc-layout-hex`);
  await pick(h, '.vc-layout-select', 'band'); await sleep(500);
  v = await vals(h);
  ok(v[0] === 'band' && v[1] === 'band' && v[2].includes('vc-layout-band'), '工具列切 band → 專案區同步');
  ok(await h.ev(`JSON.parse(localStorage.getItem('strategyMatrix_v4')).valueChain.layout === 'band'`), 'localStorage valueChain.layout=band');
  await h.open(html);
  v = await vals(h);
  ok(v[0] === 'band' && v[1] === 'band', 'reload 後兩處 band');
  await h.captureDownloads();
  await h.ev('exportStateJSON(); 0'); await sleep(500);
  await h.ev('exportValueChainJSON(); 0'); await sleep(500);
  const d = await h.downloads({ withData: true });
  const dec = x => Buffer.from(x.data || x.base64, 'base64').toString('utf8');
  const j0 = JSON.parse(dec(d[0])), j1 = JSON.parse(dec(d[1]));
  ok(j0.valueChain.layout === 'band', 'exportStateJSON layout=band');
  ok(j1.valueChain.layout === 'band', 'exportValueChainJSON layout=band');
  // importStateJSON：攔截 file input
  j0.valueChain.layout = 'segment';
  const txt = JSON.stringify(j0);
  await h.ev(`(()=>{const o=document.createElement.bind(document);document.createElement=function(t){const e=o(t);if(t==='input'){e.click=()=>{Object.defineProperty(e,'files',{value:[{text:async()=>${JSON.stringify(txt)}}]});e.onchange();};}return e;};window.__noReload=1;})(); 0`);
  await h.ev('importStateJSON(); 0'); await sleep(1500);
  await h.stubDialogs();
  v = await vals(h);
  ok(v[0] === 'segment' && v[1] === 'segment', `importStateJSON(segment) 後兩處 segment（${v[0]}/${v[1]}）`);
  // 800 寬
  await h.send('Emulation.setDeviceMetricsOverride', { width: 800, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  const ov = await h.ev(`(()=>{const b=document.querySelector('.project-bar');return [b.scrollWidth, b.clientWidth, document.documentElement.scrollWidth, document.documentElement.clientWidth]})()`);
  ok(ov[0] <= ov[1] && ov[2] <= ov[3], `800 寬 project-bar 不溢位 ${ov}`);
  await h.shot('.project-panel', out + '/project-bar-800.png');
  await h.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  await h.shot('.project-panel', out + '/project-bar-1400.png');
  ok(h.errors().length === 0, 'console error 0 ' + h.errors().join('|'));
} finally { await h.close(); }
console.log(fail ? `FAIL ×${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
