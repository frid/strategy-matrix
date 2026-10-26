// ST-29 自測：價值鏈主要活動折列時的跨列連線（vcNestedRoute：頂層方塊定義的列間通道＋群組內側通道、同列側向 Z 形）
// 跑法（Node 24+、/usr/bin/google-chrome）：node tools/selftest/ST-29.mjs [基準版 index.html，預設 git show HEAD:index.html]
// 測：
//   A 1400×900 載入範本 bio-aesthetic、切到 ①：#vcLineCanvas 每條 path 正交（依序取 M／L／Q 控制點與終點，相鄰點 x 或 y 相同）、
//     連線數 = valueChain.links 數；截圖 $CLAUDE_JOB_DIR/tmp/ST-29/editor-ae-1400.png
//   B 不退化：1400 與 800 寬下，兩範例（bookstore-a、foundry-t）、兩份 tests/fixtures 舊存檔、所有 VC_TEMPLATES
//     與基準版比：連線條數相同；基準版已正交的 path 字串完全相同；新版斜線數 ≤ 基準；全程無 console error
//   C 800 寬 bio-aesthetic 截圖（editor-ae-800.png），斜線數 ≤ 基準
//   D PPTX：bio-aesthetic、bookstore-a、foundry-t、foundry-t 專案再套醫美範本 匯出不拋例外；ae slide1 連接器全部正交；
//     四者所有 slide*.xml 與基準逐張相同（不同時把兩版 slide 存到 tmp/ST-29/<情境>-new|base-slideN.xml）
// 預期：全部 PASS、exit 0（A 在基準版會是 2 條斜線，只印參考）。
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launch } from '../cdp-harness.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const newHtml = resolve(root, 'index.html');
const tmp = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/ST-29'; mkdirSync(tmp, { recursive: true });
let baseHtml = process.argv[2] && resolve(process.argv[2]);
if (!baseHtml) { baseHtml = tmp + '/head-index.html'; writeFileSync(baseHtml, execFileSync('git', ['show', 'HEAD:index.html'], { cwd: root, maxBuffer: 1 << 28 })); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// 依序取 d 裡所有座標（M、L、Q 的控制點＝轉角、Q 的終點）；正交折線的相鄰點必定 x 或 y 相同
const isDiag = d => { const p = [...d.matchAll(/(-?[\d.]+(?:e-?\d+)?)[ ,]+(-?[\d.]+(?:e-?\d+)?)/g)].map(m => [+m[1], +m[2]]);
  return p.some((q, i) => i && Math.abs(q[0] - p[i - 1][0]) > 0.5 && Math.abs(q[1] - p[i - 1][1]) > 0.5); };
const paths = h => h.ev(`[...document.querySelectorAll('#vcLineCanvas path.vc-link-main')].map(p=>p.getAttribute('d'))`);
const fixtures = ['bookstore-a', 'foundry-t'].map(id => [id, JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')))]);

// 收集某版本在某寬度下所有情境的 path
async function collect(file, width, shotAe) {
  const h = await launch({ width, height: 900 });
  const out = {};
  try {
    await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file);
    const tpl = await h.ev('VC_TEMPLATES.map(t=>t.id)');
    const scen = [['ex:bookstore-a', `loadExampleProject('bookstore-a')`], ['ex:foundry-t', `loadExampleProject('foundry-t')`]]
      .concat(tpl.map(id => ['tpl:' + id, `loadValueChainTemplate('${id}')`]));
    for (const [k, js] of scen) {
      await h.stubDialogs(); await h.ev(js + '; 0'); await sleep(300);
      await h.ev(`guideGoto('chain'); 0`); await sleep(500);
      out[k] = { d: await paths(h), links: await h.ev('valueChain.links.length') };
      if (shotAe && k === 'tpl:bio-aesthetic') await h.shot('#valueChainEditor', `${tmp}/editor-ae-${width}.png`);
    }
    out.errors = h.errors();
  } finally { await h.close(); }
  for (const [id, raw] of fixtures) {
    const f = await launch({ width, height: 900 });
    try {
      await f.open(file); await f.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
      await f.open(file); await sleep(500); await f.ev(`guideGoto('chain'); 0`); await sleep(600);
      out['fx:' + id] = { d: await paths(f), links: await f.ev('valueChain.links.length') };
      out.errors = out.errors.concat(f.errors());
    } finally { await f.close(); }
  }
  return out;
}

for (const width of [1400, 800]) {
  const N = await collect(newHtml, width, true), B = await collect(baseHtml, width, false);
  chk(N.errors.length === 0, `[${width}] 新版無 console error ${JSON.stringify(N.errors)}`);
  if (width === 1400) {
    const ae = N['tpl:bio-aesthetic'];
    chk(ae.d.length === ae.links && ae.d.every(d => !isDiag(d)), `[A] 1400 醫美 ${ae.d.length}/${ae.links} 條全部正交（基準斜線 ${B['tpl:bio-aesthetic'].d.filter(isDiag).length}）`);
    ae.d.forEach((d, i) => console.log(`   path ${i + 1}: ${d}`));
  }
  for (const k of Object.keys(N).filter(k => k !== 'errors')) {
    const n = N[k], b = B[k];
    if (!b) { chk(false, `[B ${width}] ${k} 基準版沒有此情境`); continue; }
    const same = b.d.every((d, i) => isDiag(d) || n.d[i] === d);
    const nd = n.d.filter(isDiag).length, bd = b.d.filter(isDiag).length;
    chk(n.d.length === b.d.length && same && nd <= bd,
      `[B ${width}] ${k}：連線 ${n.d.length}/${b.d.length}、基準正交路線不變 ${same}、斜線 新 ${nd} ≤ 基準 ${bd}`);
  }
}

// D PPTX
async function pptx(file) {
  const h = await launch();
  const out = {};
  try {
    await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file);
    await h.ev(`const g=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g.apply(this,a);};
      HTMLAnchorElement.prototype.click=function(){}; 0`);
    for (const [k, js] of [['ae', `loadValueChainTemplate('bio-aesthetic')`], ['book', `loadExampleProject('bookstore-a')`], ['foundry', `loadExampleProject('foundry-t')`],
      ['foundry+ae', `loadExampleProject('foundry-t'); loadValueChainTemplate('bio-aesthetic')`]]) {
      await h.stubDialogs(); await h.ev(js + '; 0'); await sleep(500);
      await h.ev(`window.__zip=null; window.__err=null; exportPptx().catch(e=>{window.__err=String(e)}); 0`);
      for (let i = 0; i < 40 && !(await h.ev('!!window.__zip||!!window.__err')); i++) await sleep(200);
      const names = await h.ev(`window.__zip?Object.keys(window.__zip.files).filter(n=>/^ppt\\/slides\\/slide\\d+\\.xml$/.test(n)):[]`);
      const slides = {};
      for (const n of names) slides[n] = await h.ev(`window.__zip.file(${JSON.stringify(n)}).async('string')`);
      out[k] = { slides, err: await h.ev('window.__err') };
    }
    out.errors = h.errors();
  } finally { await h.close(); }
  return out;
}
const PN = await pptx(newHtml), PB = await pptx(baseHtml);
chk(PN.errors.length === 0, `[D] 匯出無 console error ${JSON.stringify(PN.errors)}`);
for (const k of ['ae', 'book', 'foundry', 'foundry+ae']) {
  const n = PN[k], b = PB[k];
  chk(!n.err && Object.keys(n.slides).length > 0, `[D ${k}] exportPptx 不拋例外（${n.err || 'ok'}），${Object.keys(n.slides).length} 張`);
  const diff = Object.keys(b.slides).filter(s => n.slides[s] !== b.slides[s]);
  diff.forEach(s => { const f = s.split('/').pop(); writeFileSync(`${tmp}/${k}-new-${f}`, n.slides[s]); writeFileSync(`${tmp}/${k}-base-${f}`, b.slides[s] || ''); });
  chk(Object.keys(n.slides).length === Object.keys(b.slides).length && !diff.length, `[D ${k}] slide*.xml 與基準逐張相同${diff.length ? '；不同：' + diff.join(',') : ''}`);
}
{
  const x = PN.ae.slides['ppt/slides/slide1.xml'] || '';
  const cx = [...x.matchAll(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g)].map(m => { const o = m[0].match(/<a:ext cx="(\d+)" cy="(\d+)"/) || []; return { w: +o[1], h: +o[2] }; });
  chk(cx.length > 0 && cx.every(c => c.w === 0 || c.h === 0), `[D ae] slide1 ${cx.length} 段連接器全部正交`);
}
console.log('\n截圖：', tmp);
process.exit(fail ? 1 : 0);
