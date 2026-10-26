// ST-23a 自測：價值鏈編輯器的產品改放 .vc-zones 最右邊（Margin 箭頭右側）的直欄，產品方塊直排、上下排序；≤800px 回到橫列。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-23a.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/st23a/）
// 測了什麼：
//   [a] bookstore-a：產品欄在 Margin 箭頭右側、三列全高（top/bottom 對齊 .vc-zones）；3 個產品同一直欄 top 遞增；
//       產品方塊 writing-mode=vertical-rl、名稱 input 是直的（高 > 寬）且未裁字；isVcHorizontal(產品 body)=false；
//       連線 SVG 圖形數 ≥ 連線數、座標無 NaN；上下排序（moveVcNode，與 drop handler 同一路徑）資料與 DOM 一致；「＋ 產品」在欄底
//       3 個產品撐高 Porter 圖 ≤20px（直排時「＋同層」「✕」「＋角色」平時隱藏、hover 才出現）；加到 8 個產品時多出的高度只給主要活動列（下方括號高度不變）
//   [b] 關掉大箭頭（showArrowBg=false，走 checkbox change）：沒有 Margin 箭頭，產品欄仍貼齊 .vc-zones 右緣
//   [c] bio-pharma-tw 範本（長名稱）：名稱未裁字；產品欄不把 Porter 圖撐高超過 40px（對照把產品欄 display:none 時的 zones 高）
//   [d] 700px 寬：產品欄在 zones 最下方、isVcHorizontal=true、方塊 horizontal-tb
//   [e] console error 0
// 預期：全部 PASS、exit 0。量到的幾何（產品欄／Margin rect、方塊 w×h）印在 INFO 行，供 ST-23b 連線規則參考。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st23a'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h, file) { await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file); }
const geo = `(()=>{
  const R=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)}};
  const z=document.querySelector('#valueChainEditor .vc-zones'), p=document.querySelector('.vc-zone-products'), body=document.querySelector('.vc-products-body');
  const units=[...document.querySelectorAll('.vc-products-body > .vc-unit')];
  const svg=document.getElementById('vcLineCanvas');
  const paths=[...svg.querySelectorAll('path,line,polyline')];
  const nan=paths.some(e=>/NaN/.test(e.getAttribute('d')||'')||/NaN/.test(e.getAttribute('points')||'')||['x1','y1','x2','y2'].some(a=>/NaN/.test(e.getAttribute(a)||'')));
  return { zones:R(z), prod:R(p), margin:R(document.querySelector('.vc-margin-arrow')), support:R(document.querySelector('.vc-zone-support')), act:R(document.querySelector('.vc-activities-row')),
    units:units.map(u=>{const i=u.querySelector('input');return {...R(u), wm:getComputedStyle(u).writingMode, inp:R(i), sw:i.scrollWidth, cw:i.clientWidth, sh:i.scrollHeight, ch:i.clientHeight}}),
    horiz:isVcHorizontal(body), links:valueChain.links.length, paths:paths.length, nan, inZones:!!z.querySelector('.vc-zone-products') };
})()`;
// 產品欄高度貢獻歸零（height:0＋overflow:hidden，欄寬不變），量 Porter 圖本身的自然高
const zNoProd = `(()=>{const p=document.querySelector('.vc-zone-products');p.style.height='0';p.style.overflow='hidden';const z=document.querySelector('#valueChainEditor .vc-zones').getBoundingClientRect().height;p.style.height='';p.style.overflow='';return Math.round(z)})()`;
const bracketH = `Math.round(document.querySelector('.vc-primary-label').getBoundingClientRect().height)`;
const notClipped = u => u.sh <= u.ch + 1 && u.sw <= u.cw + 1;
const h = await launch();
try {
  // [a] bookstore-a
  await fresh(h, html); await h.loadExample('bookstore-a');
  await h.ev(`guideGoto('chain'); 0`); await sleep(700);
  let g = await h.ev(geo);
  console.log('INFO wide', JSON.stringify({ zones: g.zones, prod: g.prod, margin: g.margin, units: g.units.map(u => ({ l: u.l, t: u.t, w: u.w, h: u.h })) }));
  ok(g.inZones && g.prod && g.margin && g.prod.l >= g.margin.r, `[a] 產品欄在 .vc-zones 內、Margin 右側（prod.l ${g.prod?.l} ≥ margin.r ${g.margin?.r}）`);
  ok(Math.abs(g.prod.t - g.zones.t) <= 1 && Math.abs(g.prod.b - g.zones.b) <= 1 && Math.abs(g.prod.r - g.zones.r) <= 1, `[a] 產品欄三列全高且貼右緣 prod ${JSON.stringify(g.prod)} zones ${JSON.stringify(g.zones)}`);
  const cx = g.units.map(u => u.l + u.w / 2);
  ok(g.units.length === 3 && g.units.every((u, i) => i === 0 || u.t > g.units[i - 1].t) && Math.max(...cx) - Math.min(...cx) <= 2, `[a] 3 個產品同一直欄、top 遞增 ${g.units.map(u => u.t).join(',')}`);
  ok(g.units.every(u => u.wm === 'vertical-rl' && u.inp.h > u.inp.w && u.h > u.w), `[a] 產品方塊直排、名稱 input 直的 ${g.units.map(u => u.inp.w + 'x' + u.inp.h).join(' ')}`);
  ok(g.units.every(notClipped), `[a] 名稱 input 沒有內容溢出（未被裁字）`);
  ok(g.horiz === false, `[a] isVcHorizontal(產品 body) = false（拖曳改看 clientY、placeholder 用 vc-drop-v）`);
  ok(g.paths >= g.links && g.links >= 1 && !g.nan, `[a] 連線 ${g.links} 條、SVG 圖形 ${g.paths} 個、無 NaN`);
  const zA = await h.ev(zNoProd);
  ok(g.zones.h <= zA + 20, `[a] 3 個產品幾乎不撐高 Porter 圖 ≤20px（含產品 ${g.zones.h} vs 不含 ${zA}）`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/a-wide.png`);
  // 產品很多（共 8 項）時：多出的高度只給主要活動列，下方「主要活動」括號高度不變
  const br0 = await h.ev(bracketH);
  await h.ev(`(()=>{for(let i=0;i<5;i++)valueChain.products.push(makeUnit('測試產品'+i));commitValueChain();})(); 0`); await sleep(500);
  const g8 = await h.ev(geo), br8 = await h.ev(bracketH);
  ok(g8.units.length === 8 && Math.abs(br8 - br0) <= 1 && Math.abs(g8.prod.b - g8.zones.b) <= 1, `[a] 8 個產品：括號高 ${br0}→${br8} 不變、產品欄仍三列全高（zones 高 ${g8.zones.h}）`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/a-wide-8products.png`);
  await h.ev(`valueChain.products.splice(3);commitValueChain(); 0`); await sleep(400);
  const ord = await h.ev(`(()=>{const ids=valueChain.products.map(n=>n.id);vcDragSrc={id:ids[2],zone:'products'};moveVcNode(valueChain.products,ids[0]);vcDragSrc=null;
    return {before:ids, after:valueChain.products.map(n=>n.id), dom:[...document.querySelectorAll('.vc-products-body > .vc-unit')].map(e=>e.dataset.vcId)}})()`);
  ok(ord.after[0] === ord.before[2] && JSON.stringify(ord.dom) === JSON.stringify(ord.after), `[a] 上下排序後資料與 DOM 順序一致`);
  const btn = await h.ev(`(()=>{const f=document.querySelector('.vc-zone-products .vc-products-footer');const b=document.querySelector('.vc-products-body');return !!f && f.getBoundingClientRect().top>=b.getBoundingClientRect().bottom-1 && /產品/.test(f.textContent)})()`);
  ok(btn, `[a] 「＋ 產品」在產品欄底部`);

  // [b] 關掉大箭頭
  await h.ev(`(()=>{const c=[...document.querySelectorAll('#valueChainEditor input[type=checkbox]')].find(e=>e.closest('label')&&/箭頭/.test(e.closest('label').textContent));c.checked=false;c.dispatchEvent(new Event('change'));})(); 0`); await sleep(500);
  g = await h.ev(geo);
  ok(!g.margin && Math.abs(g.prod.r - g.zones.r) <= 1 && g.prod.l >= g.support.r, `[b] 關大箭頭：無 Margin、產品欄貼右緣 prod ${JSON.stringify(g.prod)} support.r ${g.support.r}`);
  ok(!g.nan && g.paths >= g.links, `[b] 連線仍正常（${g.paths}）`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/b-no-arrow.png`);
  await h.ev(`valueChain.showArrowBg=true; commitValueChain(); 0`); await sleep(300);

  // [c] bio-pharma-tw 範本（長名稱）
  await h.ev(`(()=>{valueChain=normaliseValueChain(JSON.parse(JSON.stringify(VC_TEMPLATES.find(x=>x.id==='bio-pharma-tw').valueChain)));resetValueChainIds(valueChain);commitValueChain();})(); 0`); await sleep(600);
  g = await h.ev(geo);
  const zNo = await h.ev(zNoProd);
  console.log('INFO bio', JSON.stringify({ zonesH: g.zones.h, zonesHNoProducts: zNo, prod: g.prod, units: g.units.map(u => ({ w: u.w, h: u.h, inpH: u.inp.h })) }));
  ok(g.units.length > 0 && g.units.every(notClipped), `[c] bio-pharma-tw 產品名稱未裁字（${g.units.length} 項）`);
  ok(g.zones.h <= zNo + 40, `[c] 產品欄沒有把 Porter 圖撐高超過 40px（含產品 ${g.zones.h} vs 不含 ${zNo}）`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/c-bio-pharma.png`);
  ok(h.errors().length === 0, `[e] 寬版無 console error ${JSON.stringify(h.errors())}`);
} finally { await h.close(); }

// [d] 700px 窄螢幕
{
  const h2 = await launch({ width: 700, height: 900 });
  try {
    await fresh(h2, html); await h2.loadExample('bookstore-a');
    await h2.ev(`guideGoto('chain'); 0`); await sleep(700);
    const g = await h2.ev(geo);
    console.log('INFO narrow', JSON.stringify({ zones: g.zones, prod: g.prod, act: g.act, units: g.units.map(u => ({ l: u.l, t: u.t, w: u.w, h: u.h })) }));
    ok(g.prod.t >= g.act.b && Math.abs(g.prod.b - g.zones.b) <= 1, `[d] 700px：產品欄在 zones 最下方（prod.t ${g.prod.t} ≥ 主要活動 b ${g.act.b}）`);
    ok(g.horiz === true && g.units.every(u => u.wm === 'horizontal-tb' && u.w > u.h), `[d] 700px：isVcHorizontal=true、方塊橫排`);
    ok(!g.nan, `[d] 700px：連線無 NaN`);
    await h2.shot('#valueChainEditor .vc-zones', `${out}/d-narrow-700.png`);
    ok(h2.errors().length === 0, `[e] 窄版無 console error ${JSON.stringify(h2.errors())}`);
  } finally { await h2.close(); }
}
process.exit(fail ? 1 : 0);
