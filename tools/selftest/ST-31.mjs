// ST-31 自測：價值鏈產品方塊文字改橫排（編輯器 ① 產品欄＋PPTX slide1 產品欄）。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-31.mjs   （需 Chrome；截圖與 slide1.xml 寫 $CLAUDE_JOB_DIR/tmp/st31/）
// 測了什麼：
//   [a] 編輯器 1400 寬（bookstore-a）：產品名稱 textarea 與方塊 computed writing-mode=horizontal-tb；.vc-zone-products 寬 200±2；
//       3 個產品 top 遞增、left 相同；產品名稱用 textarea.vc-name-wrap
//   [b] 把第一個產品改成 13 字長名稱：方塊高度增加（換行）、scrollHeight ≤ clientHeight+1（未裁字）、方塊不超出產品欄寬
//   [c] 連線仍正交：客服→中文書籍 vcLinkRoute kind=product、相鄰點 x 或 y 相等、SVG main path 無 NaN
//   [d] 700px 寬：產品在最下方橫列、方塊 horizontal-tb、名稱未裁字
//   [e] PPTX slide1（bookstore-a）：產品 shape 寬 1.0"（長名稱情境 1.2"）、x 在 Margin 右側、右緣 ≤ slide 寬、無 vert="eaVert"、
//       高 ≤ 0.6"；所有 connector 正交（cx 或 cy 為 0）
//   [f] console error 0
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st31'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h, file) { await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file); }
const EMU = 914400, SLIDE_W = 9144000;
const geo = `(()=>{
  const R=e=>{const r=e.getBoundingClientRect();return {l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)}};
  const p=document.querySelector('.vc-zone-products');
  return { prod:R(p), units:[...document.querySelectorAll('.vc-products-body > .vc-unit')].map(u=>{const i=u.querySelector('.vc-node-head > :is(input,textarea)');
    return {...R(u), tag:i.tagName, cls:i.className, wm:getComputedStyle(u).writingMode, iwm:getComputedStyle(i).writingMode, sh:i.scrollHeight, ch:i.clientHeight, sw:i.scrollWidth, cw:i.clientWidth}}) };
})()`;
const notClipped = u => u.sh <= u.ch + 1 && u.sw <= u.cw + 1;
// 只量一條連線：spy vcLinkRoute 收 route，回傳 客服→中文書籍 那條
const linkCheck = `(()=>{
  const find = name => { let hit=null; const w=a=>(a||[]).forEach(n=>{ if(hit) return; if(n.name===name) hit=n.id; if(n.children) w(n.children); }); w(valueChain.support); w(valueChain.primary); w(valueChain.products); return hit; };
  const from=find('客服'), to=valueChain.products[0].id;
  if (!valueChain.links.some(l=>l.from===from&&l.to===to)) { valueChain.links.push({id:genNodeId(vcUsedIds),from,to}); commitValueChain(); }
  const orig=vcLinkRoute; const routes=[]; vcLinkRoute=function(...a){const r=orig(...a);routes.push(r);return r;};
  try { drawVcLinks(); } finally { vcLinkRoute=orig; }
  const valid=valueChain.links.filter(l=>getVcNodeRect(l.from)&&getVcNodeRect(l.to));
  const i=valid.findIndex(l=>l.from===from&&l.to===to), rt=routes[i];
  const ds=[...document.querySelectorAll('#vcLineCanvas .vc-link-main')].map(p=>p.getAttribute('d'));
  return { kind:rt&&rt.kind, ortho: !!rt && rt.pts.every((p,j)=>!j||Math.abs(p.x-rt.pts[j-1].x)<0.01||Math.abs(p.y-rt.pts[j-1].y)<0.01), nan: ds.some(d=>/NaN/.test(d||'')) };
})()`;
const parse = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
  const s = m[0], o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/) || [];
  return { kind: m[1], name: (s.match(/name="([^"]*)"/) || [])[1], x: +o[1], y: +o[2], w: +o[3], h: +o[4], raw: s };
});
async function slide1(h) {
  await h.ev(`window.__zip=null; exportPptx(); 0`);
  for (let i = 0; i < 40 && !(await h.ev('!!window.__zip')); i++) await sleep(200);
  return h.ev(`window.__zip.file('ppt/slides/slide1.xml').async('string')`);
}
function checkPptx(tag, xml, names, wantW) {
  const sh = parse(xml), sp = sh.filter(s => s.kind === 'sp'), cx = sh.filter(s => s.kind === 'cxnSp');
  const margin = sp.find(s => s.name === 'Margin／利潤');
  const prods = names.map(n => sp.filter(s => s.name === n && /prst="roundRect"/.test(s.raw)).sort((a, b) => b.x - a.x)[0]);
  const lane = Math.round(0.06 * EMU);
  console.log(`INFO [${tag}] 產品 ${prods.map(p => p ? `${p.name} x=${(p.x / EMU).toFixed(3)} w=${(p.w / EMU).toFixed(3)} h=${(p.h / EMU).toFixed(3)}` : '缺').join(' / ')}；Margin x=${margin && (margin.x / EMU).toFixed(3)}`);
  ok(prods.every(Boolean) && prods.every(p => Math.abs(p.w - Math.round(wantW * EMU)) <= 2 || Math.abs(p.w - (Math.round(wantW * EMU) - lane)) <= 2),
    `[${tag}] 產品 shape 寬 ${wantW}"（有產品→產品線時扣 0.06" 通道）`);
  ok(prods.every(p => p && !/vert="eaVert"/.test(p.raw) && p.h <= Math.round(0.6 * EMU) + 2), `[${tag}] 產品 shape 無 vert="eaVert"、高 ≤ 0.6"`);
  ok(!!margin && prods.every(p => p && p.x >= margin.x + margin.w && p.x + p.w <= SLIDE_W), `[${tag}] 產品在 Margin 右側、右緣 ≤ slide 寬`);
  ok(cx.every(c => c.w === 0 || c.h === 0), `[${tag}] ${cx.length} 段 connector 全部正交`);
}

const h = await launch();
try {
  await fresh(h, html); await h.loadExample('bookstore-a');
  await h.ev(`guideGoto('chain'); 0`); await sleep(700);
  // [a]
  let g = await h.ev(geo);
  ok(g.units.length === 3 && g.units.every(u => u.wm === 'horizontal-tb' && u.iwm === 'horizontal-tb'), `[a] 產品方塊與名稱 writing-mode=horizontal-tb`);
  ok(g.units.every(u => u.tag === 'TEXTAREA' && /vc-name-wrap/.test(u.cls)), `[a] 產品名稱是 textarea.vc-name-wrap`);
  ok(Math.abs(g.prod.w - 200) <= 2, `[a] .vc-zone-products 寬 ${g.prod.w}（200±2）`);
  ok(g.units.every((u, i) => !i || (u.t > g.units[i - 1].t && u.l === g.units[0].l)), `[a] 3 個產品 top 遞增 ${g.units.map(u => u.t)}、left 相同 ${g.units.map(u => u.l)}`);
  ok(g.units.every(notClipped), `[a] 名稱未裁字`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/a-wide.png`);
  // [b] 13 字長名稱
  const h0 = g.units[0].h;
  await h.ev(`(()=>{const i=document.querySelector('.vc-products-body > .vc-unit textarea');i.value='生物相似藥委託開發製造服務';i.dispatchEvent(new Event('input'));i.dispatchEvent(new Event('change'));})(); 0`);
  await sleep(400);
  g = await h.ev(geo);
  const u0 = g.units[0];
  ok(u0.h > h0 && notClipped(u0), `[b] 13 字長名稱換行：高 ${h0}→${u0.h}、scrollHeight ${u0.sh} ≤ clientHeight ${u0.ch}+1`);
  ok(u0.r <= g.prod.r && u0.l >= g.prod.l, `[b] 長名稱方塊不超出產品欄`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/b-long-name.png`);
  // [c]
  const L = await h.ev(linkCheck);
  ok(L.kind === 'product' && L.ortho && !L.nan, `[c] 客服→產品 kind=${L.kind} 正交=${L.ortho} NaN=${L.nan}`);
  // [e] PPTX：長名稱 13 字 → 1.2"；改回短名稱 → 1.0"
  await h.ev(`const g0=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g0.apply(this,a);};
    HTMLAnchorElement.prototype.click=function(){}; 0`);
  await h.stubDialogs();
  let names = await h.ev(`valueChain.products.map(n=>n.name)`);
  let xml = await slide1(h); writeFileSync(`${out}/slide1-long.xml`, xml);
  checkPptx('pptx 長名稱', xml, names, 1.2);
  await h.ev(`valueChain.products[0].name='中文書籍'; commitValueChain(); 0`); await sleep(300);
  names = await h.ev(`valueChain.products.map(n=>n.name)`);
  xml = await slide1(h); writeFileSync(`${out}/slide1.xml`, xml);
  checkPptx('pptx', xml, names, 1.0);
  ok(h.errors().length === 0, `[f] 寬版無 console error ${JSON.stringify(h.errors())}`);
} finally { await h.close(); }

// [d] 700px
{
  const h2 = await launch({ width: 700, height: 900 });
  try {
    await fresh(h2, html); await h2.loadExample('bookstore-a');
    await h2.ev(`guideGoto('chain'); 0`); await sleep(700);
    const g = await h2.ev(geo);
    const actB = await h2.ev(`Math.round(document.querySelector('.vc-activities-row').getBoundingClientRect().bottom)`);
    ok(g.prod.t >= actB && g.units.every(u => u.wm === 'horizontal-tb') && g.units.every(notClipped), `[d] 700px：產品欄在主要活動下方、方塊橫排、名稱未裁字（${g.units.map(u => u.w + 'x' + u.h).join(' ')}）`);
    await h2.shot('#valueChainEditor .vc-zones', `${out}/d-narrow-700.png`);
    ok(h2.errors().length === 0, `[f] 窄版無 console error ${JSON.stringify(h2.errors())}`);
  } finally { await h2.close(); }
}
process.exit(fail ? 1 : 0);
