// ST-21 回歸腳本：舊存檔 fixtures、範例完成度、PPTX 與 v1.0.0 基準比對、說明卡。零 npm 依賴。
// 跑法：node tests/st-21-regression.mjs [--base <舊版 index.html>] [--out <截圖目錄>] [--strict-slide1]
//   --base 預設：git show v1.0.0:index.html 到暫存檔
//   --out  預設：$CLAUDE_JOB_DIR/tmp/st21e，無則 os.tmpdir()/st21e
// 測：a 兩份 fixtures 載入無 console error、六 tab 截圖、③ lineCanvas 連線／①vcLineCanvas 連線、往返重畫；
//     b 兩範例六步 pct 與基準版相同；c 兩範例 PPTX 的 slide*.xml 與基準版逐張相同（ST-23c 起 slide1＝價值鏈頁改產品直欄，
//     預設不比 slide1、改驗產品方塊數（ST-31 起橫排、無 eaVert）／產品在 Margin 右側／連接器正交／每條連線至少一段／skippedLinks 0；--strict-slide1 恢復逐張全比）；
//     d 六張說明卡、#step-3 直連；
//     e ST-22 重新整理／他 tab 套用價值鏈後切回 ①，主要活動名稱高度 >10；主「載入」價值鏈檔不取代專案。
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
const strictSlide1 = argv.includes('--strict-slide1');
const KEYS = ['chain', 'cells', 'ideas', 'premise', 'action', 'control'];
const EXAMPLES = ['bookstore-a', 'foundry-t'];
// ST-34b：專有名詞對齊課本後，基準版（v1.0.0）XML 的舊字改成新字再逐張比對（順序有意義：先長後短）
const KNOWN_RENAMES = [
  ["的KSF's", '的優勢'], ["的KSF&apos;s", '的優勢'], ['的關聯', '的貢獻'],
  ["KSF's", 'KSF'], ['KSF&apos;s', 'KSF'], ['〔主導〕', '〔主導權責〕'], ['須轉移', '轉移陣地'],
  ['○ 自製', '○ 自行負責'], ['策略前提控制（監測）', '策略前提控制表'], ['產品品質之確保', '產品品質之保證'],
];
const applyRenames = x => KNOWN_RENAMES.reduce((t, [a, b]) => t.split(a).join(b), x);
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
    const vc = await h.ev(`({products:valueChain.products.filter(n=>n.type==='unit').map(n=>n.name),links:valueChain.links.length,arrow:!!valueChain.showArrowBg,
      info:(typeof buildValueChainShapesXml==='function'&&buildValueChainShapesXml.lastInfo)||{}})`);
    return { pct, slides, vc };
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
  for (const k of Object.keys(old.slides)) old.slides[k] = applyRenames(old.slides[k]);
  for (const k of KEYS) { rows.push(`${id.padEnd(12)} ${k.padEnd(8)} 新 ${String(nw.pct[k]).padStart(3)}%  舊 ${String(old.pct[k]).padStart(3)}%`);
    ok(nw.pct[k] === old.pct[k] && typeof nw.pct[k] === 'number', `[b ${id}] ${k} pct 新=${nw.pct[k]} 舊=${old.pct[k]}`); }
  const nn = Object.keys(nw.slides), on = Object.keys(old.slides);
  ok(nn.length > 0 && nn.length === on.length, `[c ${id}] PPTX 張數 新 ${nn.length} 舊 ${on.length}`);
  const S1 = 'ppt/slides/slide1.xml';
  const diff = on.filter(n => (strictSlide1 || n !== S1) && nw.slides[n] !== old.slides[n]);
  ok(diff.length === 0, `[c ${id}] slide*.xml 逐張相同${strictSlide1 ? '' : '（slide1 除外）'}${diff.length ? '；不同：' + diff.join(',') : ''}`);
  if (!strictSlide1) {
    // ST-23c：slide1（價值鏈頁）產品改在 Margin 右側直欄 → 改驗版面性質
    const x1 = nw.slides[S1] || '';
    const sps = [...x1.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
      const s = m[0], o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/) || [];
      return { kind: m[1], name: (s.match(/name="([^"]*)"/) || [])[1], x: +o[1], w: +o[3], h: +o[4], vert: /<a:bodyPr vert="eaVert"/.test(s) };
    });
    // ST-31：產品方塊改橫排（無 vert）→ 同名 roundRect 中取最右邊那個
    const prods = nw.vc.products.map(n => sps.filter(s => s.kind === 'sp' && s.name === n && !s.vert).sort((a, b) => b.x - a.x)[0]);
    const margin = sps.find(s => s.name === 'Margin／利潤');
    const cx = sps.filter(s => s.kind === 'cxnSp');
    const nLinks = new Set(cx.map(c => (c.name.match(/^價值鏈連線 (\d+)/) || [])[1]).filter(Boolean)).size;
    ok(prods.length > 0 && prods.every(Boolean), `[c ${id}] slide1 產品橫排方塊 ${prods.filter(Boolean).length}/${prods.length}`);
    ok(!nw.vc.arrow || (margin && prods.every(p => p && p.x > margin.x + margin.w)), `[c ${id}] slide1 產品在 Margin 右側（Margin x ${margin && margin.x}、產品 x ${prods[0] && prods[0].x}）`);
    ok(cx.length >= nw.vc.links && nLinks === nw.vc.links, `[c ${id}] slide1 連接器 ${cx.length} 段、涵蓋 ${nLinks}/${nw.vc.links} 條連線`);
    ok(cx.every(c => c.w === 0 || c.h === 0), `[c ${id}] slide1 連接器全部正交（斜線 ${cx.filter(c => c.w && c.h).length}）`);
    ok(nw.vc.info.skippedLinks === 0, `[c ${id}] slide1 lastInfo.skippedLinks ${nw.vc.info.skippedLinks}`);
  }
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
// e ST-22 價值鏈名稱高度：隱藏的 ① 頁籤渲染後切回，textarea 不可為 0 高；主「載入」價值鏈檔不取代專案
{
  const nameH = `(()=>{const t=[...document.querySelectorAll('#valueChainEditor textarea.vc-name-wrap')];return {n:t.length,min:t.length?Math.min(...t.map(e=>e.offsetHeight)):0}})()`;
  const tpl = `JSON.parse(JSON.stringify(VC_TEMPLATES.find(x=>x.id==='bio-pharma-tw').valueChain))`;
  const h = await launch();
  try {
    await fresh(h, html);
    await h.ev(`(()=>{valueChain=normaliseValueChain(${tpl});resetValueChainIds(valueChain);commitValueChain();guideGoto('ideas');})(); 0`); await sleep(600);
    await h.open(html); await sleep(800);  // 存檔 guideStep=ideas，① 隱藏狀態下渲染
    await h.ev(`guideGoto('chain'); 0`); await sleep(600);
    let r = await h.ev(nameH);
    ok(r.n > 0 && r.min > 10, `[e] 重新整理後切回 ① 主要活動名稱 offsetHeight 最小 ${r.min}（共 ${r.n}）`);
    await h.shot(null, `${out}/e-reload-chain.png`);

    await fresh(h, html); await h.loadExample('bookstore-a');
    await h.ev(`guideGoto('ideas'); 0`); await sleep(500);
    const a0 = await h.ev('arrows.length');
    let applied = true;
    try { await h.ev(`applyImportedValueChain({kind:'strategyMatrix.valueChain',valueChain:${tpl}}); 0`); } catch (e) { applied = false; }
    await sleep(300);
    await h.ev(`guideGoto('chain'); 0`); await sleep(600);
    r = await h.ev(nameH);
    ok(applied && r.n > 0 && r.min > 10, `[e] 他 tab 套用價值鏈後切回 ① 名稱 offsetHeight 最小 ${r.min}（共 ${r.n}）`);
    ok(applied && await h.ev('arrows.length') === a0 && a0 > 0, `[e] 套用價值鏈後 arrows 數量不變（${a0}）`);

    // 主「載入」流程：模擬選檔，kind 為價值鏈 → 不 reload、不取代專案
    await h.ev(`window.__noReload=1; window.__vcFile=JSON.stringify({kind:'strategyMatrix.valueChain',v:1,title:'x',valueChain:${tpl}}); 0`);
    const title0 = await h.ev(`document.getElementById('strategyTitle').value`);
    const res = await h.ev(`(async()=>{
      const orig=document.createElement; let inp=null;
      document.createElement=function(t){const e=orig.call(document,t); if(t==='input'){inp=e; e.click=()=>{};} return e;};
      importStateJSON(); document.createElement=orig;
      Object.defineProperty(inp,'files',{value:[{text:async()=>window.__vcFile}]});
      await inp.onchange();
      const st=JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {marker:window.__noReload===1, arrows:arrows.length, title:document.getElementById('strategyTitle').value, hasVc:Array.isArray(st.arrows)&&st.arrows.length===arrows.length};
    })()`);
    ok(res.marker && res.arrows === a0 && res.title === title0 && res.hasVc, `[e] 主載入價值鏈檔：未 reload、arrows 仍 ${res.arrows}、標題不變 ${JSON.stringify(res)}`);
    ok(h.errors().length === 0, `[e] 無 console error ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}
console.log(`截圖：${out}`);
console.log(fail ? `FAIL ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
