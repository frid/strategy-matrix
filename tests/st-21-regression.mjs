// ST-21 回歸腳本：舊存檔 fixtures、範例完成度、PPTX 與 v1.0.0 基準比對、說明卡。零 npm 依賴。
// 跑法：node tests/st-21-regression.mjs [--base <舊版 index.html>] [--out <截圖目錄>]
//   --base 預設：git show v1.0.0:index.html 到暫存檔
//   --out  預設：$CLAUDE_JOB_DIR/tmp/st21e，無則 os.tmpdir()/st21e
// 測：a 兩份 fixtures 載入無 console error、六 tab 截圖、③ lineCanvas 連線／①vcLineCanvas 連線、往返重畫；
//     b 兩範例六步 pct 與基準版相同；c 兩範例 PPTX 的 slide*.xml 與基準版逐張相同；d 六張說明卡、#step-3 直連。
// 預期：全 PASS、exit 0。FAIL 時印出差異，exit 1。
import { launch } from '../tools/cdp-harness.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const html = resolve(root, 'index.html');
const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const tmpBase = process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir();
const out = arg('--out') || tmpBase + '/st21e'; mkdirSync(out, { recursive: true });
let base = arg('--base');
if (!base) {
  base = out + '/v100-index.html';
  writeFileSync(base, execFileSync('git', ['show', 'v1.0.0:index.html'], { cwd: root, maxBuffer: 1 << 28 }));
}
const KEYS = ['chain', 'cells', 'ideas', 'premise', 'action', 'control'];
const EXAMPLES = ['bookstore-a', 'foundry-t'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

async function fresh(h, file) { await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file); }

async function exampleInfo(file, id) {
  const h = await launch();
  try {
    await fresh(h, file); await h.loadExample(id);
    const pct = await h.ev(`(()=>{const g=guideProgress();return Object.fromEntries(${JSON.stringify(KEYS)}.map(k=>[k,g[k]&&g[k].pct]))})()`);
    await h.captureDownloads();
    await h.ev('exportPptx(); 0');
    for (let i = 0; i < 40 && !(await h.downloads()).some(d => d.name && /pptx$/.test(d.name)); i++) await sleep(250);
    const idx = (await h.downloads()).findIndex(d => d.name && /pptx$/.test(d.name));
    const slides = {};
    if (idx >= 0) {
      const z = await h.zipEntries(idx);
      for (const n of z.names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort()) slides[n] = await z.read(n);
    }
    return { pct, slides };
  } finally { await h.close(); }
}

// a 舊存檔 fixtures
for (const id of EXAMPLES) {
  const raw = JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')));
  const saved = JSON.parse(raw);
  const h = await launch();
  try {
    await h.open(html);
    await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
    await h.open(html); await sleep(800);
    ok(h.errors().length === 0, `[a ${id}] 載入無 console error ${JSON.stringify(h.errors())}`);
    for (let n = 0; n < 6; n++) {
      await h.ev(`guideGoto('${KEYS[n]}'); 0`); await sleep(500);
      const vis = await h.ev(`guideStep`);
      ok(vis === KEYS[n], `[a ${id}] tab ${n + 1} ${KEYS[n]} 可切換`);
      await h.shot(null, `${out}/${id}-fixture-${n + 1}-${KEYS[n]}.png`);
    }
    const lineInfo = () => h.ev(`(()=>{const s=document.getElementById('lineCanvas');const els=[...s.querySelectorAll('path,line')].filter(e=>!e.closest('defs'));
      const bad=els.filter(e=>{const t=e.tagName==='path'?e.getAttribute('d')||'':['x1','y1','x2','y2'].map(a=>e.getAttribute(a)).join(' ');
        return /NaN/.test(t)||/^\\s*(M\\s*)?0[ ,]+0\\b/.test(t)||(e.tagName==='line'&&['x1','y1','x2','y2'].some(a=>+e.getAttribute(a)===0))}).length;
      return {n:els.length,bad}})()`);
    const vcN = () => h.ev(`[...document.getElementById('vcLineCanvas').querySelectorAll('path,line')].filter(e=>!e.closest('defs')).length`);
    await h.ev(`guideGoto('ideas'); 0`); await sleep(600);
    const li = await lineInfo();
    ok(li.n > 0 && li.bad === 0, `[a ${id}] ③ lineCanvas 連線 ${li.n} 條、座標異常 ${li.bad}`);
    await h.ev(`guideGoto('chain'); 0`); await sleep(600);
    const nLinks = (saved.valueChain.links || []).length;
    const v1 = await vcN();
    ok(nLinks > 0 ? v1 >= nLinks : v1 === 0, `[a ${id}] ① vcLineCanvas 連線 ${v1}（存檔 vcLinks ${nLinks}）`);
    await h.ev(`guideGoto('ideas'); 0`); await sleep(600);
    const li2 = await lineInfo();
    await h.ev(`guideGoto('chain'); 0`); await sleep(600);
    const v2 = await vcN();
    ok(li2.n === li.n && v2 === v1, `[a ${id}] 往返 ①→③→① 連線仍在（③ ${li2.n}/${li.n}、① ${v2}/${v1}）`);
    ok(h.errors().length === 0, `[a ${id}] 全程無 console error ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// b、c 範例 vs 基準版
const rows = [];
for (const id of EXAMPLES) {
  const [nw, old] = [await exampleInfo(html, id), await exampleInfo(base, id)];
  for (const k of KEYS) { rows.push(`${id.padEnd(12)} ${k.padEnd(8)} 新 ${String(nw.pct[k]).padStart(3)}%  舊 ${String(old.pct[k]).padStart(3)}%`);
    ok(nw.pct[k] === old.pct[k] && typeof nw.pct[k] === 'number', `[b ${id}] ${k} pct 新=${nw.pct[k]} 舊=${old.pct[k]}`); }
  const nn = Object.keys(nw.slides), on = Object.keys(old.slides);
  ok(nn.length > 0 && nn.length === on.length, `[c ${id}] PPTX 張數 新 ${nn.length} 舊 ${on.length}`);
  const diff = on.filter(n => nw.slides[n] !== old.slides[n]);
  ok(diff.length === 0, `[c ${id}] slide*.xml 逐張相同${diff.length ? '；不同：' + diff.join(',') : ''}`);
}
console.log('\n完成度表\n' + rows.join('\n') + '\n');

// d 說明卡與直連
{
  const h = await launch();
  try {
    await fresh(h, html); await h.loadExample('bookstore-a');
    const r = await h.ev(`${JSON.stringify(KEYS)}.map(k=>{const c=document.getElementById('guideCard-'+k);return !!c && !!GUIDE_CONTENT[k] && (GUIDE_CONTENT[k].purpose||'').length>0 && c.textContent.includes(GUIDE_CONTENT[k].purpose)})`);
    ok(r.every(Boolean), `[d] 六張說明卡存在且 purpose 非空 ${JSON.stringify(r)}`);
    await h.open(html + '#step-3'); await h.ev('location.reload(); 0'); await sleep(1200);
    await h.stubDialogs();
    ok(await h.ev('guideStep') === 'ideas', `[d] #step-3 直連開在 ideas（實際 ${await h.ev('guideStep')}）`);
    ok(h.errors().length === 0, `[d] 無 console error ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}
console.log(`截圖：${out}`);
console.log(fail ? `FAIL ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
