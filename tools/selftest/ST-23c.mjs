// ST-23c 自測：PPTX 價值鏈頁（slide1）產品改在 Margin 右側直欄，到產品的連線走 vcProductRoute（全程正交）
// ST-31 更新：產品方塊文字改橫排（不再有 vert="eaVert"）、寬 1.0～1.2"、高 ≤ 0.6"
// ST-43 更新：產品改成並排直立長條（vert="eaVert"、寬 ≤ 0.42"、高＝Margin 高 − 0.14" 通道），到產品的線從長條底邊中點垂直向上進入
// 跑法（Node 24+、/usr/bin/google-chrome）：  node tools/selftest/ST-23c.mjs [基準版 index.html，預設 git show HEAD:index.html]
//   基準版只用來比 ST-20 lastInfo（字級／壓縮）與連線條數，不比座標（產品列移位後 slide1 本來就會不同）
// 情境（新版逐一匯出、攔 JSZip.generateAsync 取 slide1.xml 與 buildValueChainShapesXml.lastInfo）：
//   book＝範例「網路書店 A 公司」、foundry＝範例「晶圓代工 T 公司」、pharma＝範本 bio-pharma-tw、
//   ae＝範本 bio-aesthetic（第三層，ST-20）、book-noarrow＝書店關掉大箭頭背景
// 每個情境測：
//   1) 產品方塊數＝valueChain.products 單元數，每塊直書（vert="eaVert"，ST-43）、寬 ≤ 0.42"、高 > 0.6"、同一 y、由左至右不重疊
//   2) 有 Margin 時：Margin 右緣 + gap ≤ 產品 x；主要／支援活動最右緣 ≤ Margin x（沒 Margin 就 ≤ 產品 x）；產品右緣 ≤ slide 寬
//   3) 每段 connector 的 cx 或 cy 為 0（正交）；每條 link 至少一段；lastInfo.skippedLinks === 0
//   4) 到產品的線（ST-43）：最後一段垂直向上、終點在目標長條底邊中點 ±4px；所有段不穿過非端點的產品長條與活動方塊
//   5) 欄頂「產品」小標存在；所有 shape 不超出 slide 高；新版無 JS 例外
//   6) Margin 箭頭：xfrm 無 rot、prst=rightArrow、ext cx＝marginW（0.34"），且整塊在 slide 內
//   ae 另比基準版：deepShrunk 仍 false、deepSz 不小於基準
// 另看編輯器（drawVcLinks）：醫美範本 ① 的 vcLineCanvas 斜線條數只印出、不判 FAIL——「中醫門診→中醫調理」是主要活動欄
//   在 1400 寬折成兩列後 vcCrossRoute 找不到通道而退回斜線，v1.0.0 就如此，與產品直欄無關（排除產品方塊後仍是斜線）
// 印出每個情境的 shape 位置表（產品／Margin／主要活動最右欄）。預期全部 PASS、exit 0。
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launch } from '../cdp-harness.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const newHtml = resolve(root, 'index.html');
const tmp = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/st23c'; mkdirSync(tmp, { recursive: true });
let baseHtml = process.argv[2] && resolve(process.argv[2]);
if (!baseHtml) { baseHtml = tmp + '/head-index.html'; writeFileSync(baseHtml, execFileSync('git', ['show', 'HEAD:index.html'], { cwd: root, maxBuffer: 1 << 28 })); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SLIDE_W = 9144000, SLIDE_H = 5143500, GAP = Math.round(0.055 * 914400);

const SCEN = [
  ['book', `loadExampleProject('bookstore-a'); 0`],
  ['foundry', `loadExampleProject('foundry-t'); 0`],
  ['pharma', `loadValueChainTemplate('bio-pharma-tw'); 0`],
  ['ae', `loadValueChainTemplate('bio-aesthetic'); 0`],
  ['book-noarrow', `loadExampleProject('bookstore-a'); valueChain.showArrowBg=false; 0`],
  // 壓力情境：醫美範本加 5 條到產品的線（含孫項、群組、支援活動、產品→產品），驗通道錯開與不穿方塊
  ['ae-prod', `loadValueChainTemplate('bio-aesthetic'); (()=>{const id={};const w=l=>l.forEach(n=>{id[n.name]=n.id;if(n.children)w(n.children)});
    w(valueChain.primary);w(valueChain.support);w(valueChain.products);
    [['中醫門診','臉部手術'],['點滴','體雕手術'],['公關接待','臉部手術'],['保養品商品販售','周邊產品'],['資訊系統','體雕手術'],['臉部手術','周邊產品']]
      .forEach(([a,b],i)=>valueChain.links.push({id:'zz_p'+i,from:id[a],to:id[b]}));})(); 0`],
];

async function run(file, scen) {
  const h = await launch();
  const out = {};
  try {
    await h.open(file);
    await h.ev(`const g=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g.apply(this,a);};
      HTMLAnchorElement.prototype.click=function(){}; 0`);
    for (const [key, setup] of scen) {
      await h.stubDialogs();
      await h.ev(setup); await sleep(500);
      await h.ev(`window.__zip=null; exportPptx(); 0`);
      for (let i = 0; i < 40 && !(await h.ev('!!window.__zip')); i++) await sleep(200);
      const xml = await h.ev(`window.__zip.file('ppt/slides/slide1.xml').async('string')`);
      const info = await h.ev(`buildValueChainShapesXml.lastInfo`);
      const vc = await h.ev(`(()=>{const nm={};const w=l=>l.forEach(n=>{nm[n.id]=n.name;if(n.children)w(n.children)});w(valueChain.primary);w(valueChain.support);w(valueChain.products);
        return {products:valueChain.products.filter(n=>n.type==='unit').map(n=>n.name),links:valueChain.links.map(l=>({from:nm[l.from],to:nm[l.to],toProd:valueChain.products.some(p=>p.id===l.to),fromProd:valueChain.products.some(p=>p.id===l.from)})),arrow:!!valueChain.showArrowBg}})()`);
      out[key] = { xml, info, vc };
    }
    out.errors = h.errors();
  } finally { await h.close(); }
  return out;
}
const parse = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
  const s = m[0]; const nm = (s.match(/name="([^"]*)"/) || [])[1];
  const o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/) || [];
  return { kind: m[1], name: nm, x: +o[1], y: +o[2], w: +o[3], h: +o[4], vert: (s.match(/<a:bodyPr[^>]* vert="(\w+)"/) || [])[1] || '',
    flipH: /flipH="1"/.test(s), flipV: /flipV="1"/.test(s), raw: s };
});
let fail = 0; const chk = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };
const inch = v => (v / 914400).toFixed(3);

const N = await run(newHtml, SCEN);
const B = await run(baseHtml, SCEN.filter(s => s[0] === 'ae' || s[0] === 'book'));
chk(N.errors.length === 0, `新版無 JS 例外 ${JSON.stringify(N.errors)}`);

for (const [key] of SCEN) {
  const { xml, info, vc } = N[key];
  writeFileSync(`${tmp}/${key}-slide1.xml`, xml);
  const sh = parse(xml);
  const sp = sh.filter(s => s.kind === 'sp'), cx = sh.filter(s => s.kind === 'cxnSp');
  // 產品方塊＝同名 shape 中最右邊那個（名稱可能與欄頂小標以外的活動同名時取最右）
  const prods = vc.products.map(n => sp.filter(s => s.name === n && /prst="roundRect"/.test(s.raw)).sort((a, b) => b.x - a.x)[0]);
  const margin = sp.find(s => s.name === 'Margin／利潤');
  const prodSet = new Set(prods.filter(Boolean));
  const labels = new Set(['支援活動', '主要活動', '產品', '價值鏈']);
  const content = sp.filter(s => !prodSet.has(s) && s !== margin && !labels.has(s.name) && s.y > 0 && s.x > 0 && s.raw.includes('prstGeom prst="homePlate"') || (!prodSet.has(s) && s !== margin && !labels.has(s.name) && /prst="roundRect"/.test(s.raw)));
  const contentR = Math.max(...content.map(s => s.x + s.w));
  const rightCol = content.filter(s => s.x + s.w === contentR);
  console.log(`\n── ${key}（產品 ${vc.products.length}、連線 ${vc.links.length}、大箭頭 ${vc.arrow}）lastInfo ${JSON.stringify(info)}`);
  console.log('  shape                      x(in)   y(in)   w(in)   h(in)');
  const row = (s, tag) => console.log(`  ${(tag + s.name).padEnd(24, '　').slice(0, 24)} ${inch(s.x).padStart(7)} ${inch(s.y).padStart(7)} ${inch(s.w).padStart(7)} ${inch(s.h).padStart(7)}`);
  rightCol.slice(0, 3).forEach(s => row(s, '[右欄] '));
  if (margin) row(margin, '[M] ');
  prods.filter(Boolean).forEach(s => row(s, '[產品] '));

  chk(prods.every(Boolean) && prods.length === vc.products.length && prods.every(p => p && /vert="eaVert"/.test(p.raw)),
    `[${key}] 產品方塊 ${prods.filter(Boolean).length}/${vc.products.length}，皆直書（eaVert，ST-43）`);
  chk(prods.every(p => p && p.w <= Math.round(0.42 * 914400) + 2 && p.h > Math.round(0.6 * 914400)),
    `[${key}] 產品長條寬 ≤ 0.42"、高 > 0.6"（${prods.filter(Boolean).map(p => inch(p.w) + '×' + inch(p.h)).join(' ')}）`);
  const px = prods[0] ? prods[0].x : NaN;
  const pLast = prods[prods.length - 1] || {};
  chk(prods.every(p => p && p.y === prods[0].y) && prods.every((p, i) => !i || p.x >= prods[i - 1].x + prods[i - 1].w), `[${key}] 產品同一 y、由左至右不重疊`);
  chk(prods.every(p => p && p.x + p.w <= SLIDE_W), `[${key}] 產品右緣 ${inch(pLast.x + pLast.w)}in ≤ slide 寬`);
  if (vc.arrow) {
    chk(!!margin && margin.x + margin.w + GAP <= px + 1, `[${key}] Margin 右緣 ${margin && inch(margin.x + margin.w)} + gap ≤ 產品 x ${inch(px)}`);
    chk(!!margin && contentR <= margin.x, `[${key}] 活動最右緣 ${inch(contentR)} ≤ Margin x ${margin && inch(margin.x)}`);
  } else {
    chk(!margin && contentR + GAP <= px + 1, `[${key}] 無 Margin；活動最右緣 ${inch(contentR)} + gap ≤ 產品 x ${inch(px)}`);
  }
  if (vc.arrow) chk(!!margin && !/<a:xfrm[^>]*rot=/.test(margin.raw) && /prst="rightArrow"/.test(margin.raw) && margin.w === Math.round(0.34 * 914400)
    && margin.x + margin.w <= SLIDE_W && margin.y + margin.h <= SLIDE_H, `[${key}] Margin 無 rot、rightArrow、cx=${margin && margin.w}（0.34"）、在 slide 內`);
  chk(sp.some(s => s.name === '產品' && !s.vert), `[${key}] 欄頂「產品」小標（橫排）`);
  chk(Math.max(...sp.filter(s => s !== margin).map(s => s.y + s.h)) <= SLIDE_H, `[${key}] shape 不超出 slide 高`);
  chk(cx.every(c => c.w === 0 || c.h === 0), `[${key}] ${cx.length} 段 connector 全部正交（斜線 ${cx.filter(c => c.w && c.h).length}）`);
  const byLink = {};
  cx.forEach(c => { const m = c.name.match(/^價值鏈連線 (\d+)/); if (m) (byLink[m[1]] = byLink[m[1]] || []).push(c); });
  chk(Object.keys(byLink).length === vc.links.length && info.skippedLinks === 0, `[${key}] 每條 link 至少一段（${Object.keys(byLink).length}/${vc.links.length}）、skippedLinks ${info.skippedLinks}`);
  // 到產品的線（ST-43）：最後一段垂直向上、終點＝目標長條底邊中點；所有段不穿過非端點的產品
  const end = c => ({ x: c.flipH ? c.x : c.x + c.w, y: c.flipV ? c.y : c.y + c.h });
  let badEnd = [], badCross = [], boxHits = [];
  const inside = (c, p) => c.x >= p.x && c.y >= p.y && c.x + c.w <= p.x + p.w && c.y + c.h <= p.y + p.h;
  const boxes = content.concat(prods.filter(Boolean));
  vc.links.forEach((l, i) => {
    const segs = byLink[i + 1] || [];
    const tgt = sp.find(s => s.name === l.to && prodSet.has(s)), src = sp.find(s => s.name === l.from && prodSet.has(s));
    if (l.toProd && !l.fromProd) {
      const last = segs[segs.length - 1], e = last && end(last);
      const up = last && last.w === 0 && last.h > 0 && last.flipV;   // 由下往上畫的垂直段：終點在上端
      if (!last || !up || !tgt || Math.abs(e.x - (tgt.x + tgt.w / 2)) > 4 * 9525 || Math.abs(e.y - (tgt.y + tgt.h)) > 4 * 9525) badEnd.push(`${l.from}→${l.to}`);
    }
    const s1 = sp.find(s => s.name === l.from && boxes.includes(s)), s2 = sp.find(s => s.name === l.to && boxes.includes(s));
    segs.forEach(c => boxes.forEach(b => {
      if (b === s1 || b === s2 || (s1 && inside(s1, b)) || (s2 && inside(s2, b))) return;
      if (c.x + c.w > b.x + 2 && c.x < b.x + b.w - 2 && c.y + c.h > b.y + 2 && c.y < b.y + b.h - 2) boxHits.push(`${c.name}×${b.name}`);
    }));
    segs.forEach(c => prods.forEach(p => {
      if (!p || p === tgt || p === src) return;
      if (c.x + c.w > p.x + 2 && c.x < p.x + p.w - 2 && c.y + c.h > p.y + 2 && c.y < p.y + p.h - 2) badCross.push(`${c.name}×${p.name}`);
    }));
  });
  chk(!badEnd.length, `[${key}] 到產品的線最後一段垂直向上、停在長條底邊中點 ±4px（不符：${badEnd.join(',') || '無'}）`);
  chk(!badCross.length, `[${key}] 連線不穿過非端點產品（${badCross.join(',') || '無'}）`);
  chk(!boxHits.length, `[${key}] 連線不穿過任何非端點（及其外框）的活動／產品方塊（${boxHits.join(',') || '無'}）`);
}
// ae：ST-20 字級／壓縮不退化；書店／醫美連線條數與基準相同
const bi = B.ae.info, ni = N.ae.info;
chk(!ni.deepShrunk && ni.deepSz >= bi.deepSz, `[ae] lastInfo 新 ${JSON.stringify(ni)}／基準 ${JSON.stringify(bi)}：未壓縮、字級不降`);
for (const k of ['ae', 'book']) {
  const cnt = x => new Set(parse(x).filter(s => s.kind === 'cxnSp').map(s => (s.name.match(/^價值鏈連線 (\d+)/) || [])[1])).size;
  chk(cnt(N[k].xml) === cnt(B[k].xml), `[${k}] 連線條數 新 ${cnt(N[k].xml)} = 基準 ${cnt(B[k].xml)}`);
}
// 編輯器：醫美範本連線全部正交
{
  const h = await launch();
  try {
    await h.open(newHtml);
    await h.ev(`loadValueChainTemplate('bio-aesthetic'); guideGoto('chain'); 0`); await sleep(900);
    const ds = await h.ev(`[...document.querySelectorAll('#vcLineCanvas path.vc-link-main')].map(p=>p.getAttribute('d'))`);
    const diag = ds.filter(d => { const p = [...d.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map(m => [+m[1], +m[2]]);
      return p.some((q, i) => i && Math.abs(q[0] - p[i - 1][0]) > 0.5 && Math.abs(q[1] - p[i - 1][1]) > 0.5); });
    console.log(`INFO [editor ae] ① 連線 ${ds.length} 條、斜線 ${diag.length}（已知問題，見檔頭）`);
    await h.shot('#valueChainEditor', tmp + '/editor-ae.png');
    chk(h.errors().length === 0, `[editor ae] 無 console error ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}
console.log('\nslide1.xml 存在', tmp);
process.exit(fail ? 1 : 0);
