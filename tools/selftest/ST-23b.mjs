// ST-23b 自測：價值鏈 ① 連線接到「產品直欄」的規則（從來源右緣出、走產品欄左側直通道、進產品左緣；不斜穿 Margin 與其他方塊）。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-23b.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/st23b/）
// 作法：在頁內包一層 vcLinkRoute 收集每條線的 route（kind／pts），座標是相對 #valueChainEditor 的 offset 座標，與 getVcNodeRect 同系。
// 測了什麼：
//   [a] bookstore-a 1400 寬：客服→中文書籍 kind=product；相鄰點皆 x 或 y 相等（無斜線）；直通道 x 在 Margin 左緣以左、所有非產品方塊右緣以右；
//       線段不穿過非端點的 [data-vc-id] 方塊（穿過 Margin 箭頭允許）；SVG main path 的 d 也全是正交（含圓角控制點）
//   [b] 加 物流運輸→專業書籍（右側被同列方塊擋住）、品牌→影音商品（與產品同高→水平直線）：三條都無斜線、不穿方塊、走通道者 x 互不相同
//   [c] 關大箭頭（無 Margin）：三條仍無斜線、不穿方塊、走通道者 x 互不相同且在方塊右緣以右
//   [d] 反向（產品→活動）與產品→產品：無斜線、不穿方塊
//   [e] bio-pharma-tw：群組子項→產品 無斜線、不穿方塊
//   [f] 700px：產品在下方橫列 → 走舊路線（無 kind=product）、無 NaN
//   [g] 另加 2 條非產品連線，其 path d 與「不帶 opts.product、rects 排除產品方塊」算出的完全相同（ST-23c：非產品線不把產品直欄當障礙）；console error 0
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st23b'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h, file) { await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file); }

// 頁內工具：spy vcLinkRoute、依名稱找節點 id、分析每條連線
const setup = `(()=>{
  if (!window._st23bSpy) { const orig = vcLinkRoute; window._st23bOrig = orig; window._st23bSpy = true;
    vcLinkRoute = function (r1, r2, rects, opts, rowUse) { const r = orig(r1, r2, rects, opts, rowUse); (window._routes = window._routes || []).push(r); return r; }; }
  window._findId = name => { let hit = null; const walk = a => (a || []).forEach(n => { if (hit) return; if (n && n.name === name) hit = n.id; if (n && n.children) walk(n.children); });
    walk(valueChain.support); walk(valueChain.primary); walk(valueChain.products); return hit; };
  window._redraw = () => { window._routes = []; drawVcLinks(); return window._routes; };
  window._addLink = (a, b) => { const from = _findId(a), to = _findId(b); if (!from || !to) return false;
    if (!valueChain.links.some(l => l.from === from && l.to === to)) valueChain.links.push({ id: genNodeId(vcUsedIds), from, to }); commitValueChain(); return true; };
  return 0;
})()`;
// 分析：對每條連線回傳 { from, to, kind, pts, ortho, hits, corrX, dOrtho, nan }
const analyse = `(()=>{
  const routes = _redraw();
  const editor = document.getElementById('valueChainEditor');
  const els = [...editor.querySelectorAll('[data-vc-id]')];
  const rectOf = id => getVcNodeRect(id);
  const all = els.map(e => ({ id: e.dataset.vcId, r: vcOffsetRect(e), prod: !!e.closest('.vc-products-body') }));
  const contains = (o, r) => o.x <= r.x && o.y <= r.y && o.x + o.w >= r.x + r.w && o.y + o.h >= r.y + r.h;
  const segHit = (a, b, o) => Math.max(a.x, b.x) > o.x + 1 && Math.min(a.x, b.x) < o.x + o.w - 1 && Math.max(a.y, b.y) > o.y + 1 && Math.min(a.y, b.y) < o.y + o.h - 1;
  const ds = [...document.querySelectorAll('#vcLineCanvas .vc-link-main')].map(p => p.getAttribute('d'));
  const m = editor.querySelector('.vc-margin-arrow');
  const valid = valueChain.links.filter(l => rectOf(l.from) && rectOf(l.to));
  return { margin: m ? vcOffsetRect(m) : null, actRight: Math.max(...all.filter(a => !a.prod).map(a => a.r.x + a.r.w)),
    links: valid.map((l, i) => {
      const rt = routes[i], pts = rt.pts, r1 = rectOf(l.from), r2 = rectOf(l.to);
      const ortho = pts.every((p, j) => !j || Math.abs(p.x - pts[j-1].x) < 0.01 || Math.abs(p.y - pts[j-1].y) < 0.01);
      const hits = all.filter(a => a.id !== l.from && a.id !== l.to && !contains(a.r, r1) && !contains(a.r, r2) && !contains(r1, a.r) && !contains(r2, a.r))
        .filter(a => pts.some((p, j) => j && segHit(pts[j-1], p, a.r))).map(a => a.id);
      const nums = (ds[i] || '').match(/-?[0-9.]+(e-?[0-9]+)?/g) || []; const dp = []; for (let j = 0; j + 1 < nums.length; j += 2) dp.push({ x: +nums[j], y: +nums[j+1] });
      const dOrtho = dp.every((p, j) => !j || Math.abs(p.x - dp[j-1].x) < 0.01 || Math.abs(p.y - dp[j-1].y) < 0.01);
      return { from: l.from, to: l.to, kind: rt.kind, pts, ortho, hits, corrX: pts.length >= 4 ? pts[pts.length - 2].x : null, dOrtho, nan: /NaN/.test(ds[i] || ''), d: ds[i] };
    }) };
})()`;
const pick = (A, from, to) => h_ids[from] && A.links.find(l => l.from === h_ids[from] && l.to === h_ids[to]);
let h_ids = {};
async function ids(h, names) { for (const n of names) h_ids[n] = await h.ev(`_findId(${JSON.stringify(n)})`); }
const good = l => l && l.ortho && l.dOrtho && !l.hits.length && !l.nan;
const desc = l => l ? `kind=${l.kind} ortho=${l.ortho}/${l.dOrtho} hits=${JSON.stringify(l.hits)} pts=${l.pts.map(p => Math.round(p.x) + ',' + Math.round(p.y)).join(' ')}` : '（找不到連線）';

const h = await launch();
try {
  await fresh(h, html); await h.loadExample('bookstore-a');
  await h.ev(`guideGoto('chain'); 0`); await sleep(700);
  await h.ev(setup);
  await ids(h, ['客服', '中文書籍', '物流運輸', '專業書籍', '品牌', '影音商品', '倉儲', '採購']);
  if (!(await h.ev(`valueChain.links.some(l=>l.from===_findId('客服')&&l.to===_findId('中文書籍'))`))) await h.ev(`_addLink('客服','中文書籍')`);
  // 非產品連線兩條（跨列／同列繞行），給 [g] 比對舊路線用
  await h.ev(`_addLink('採購','倉儲'); _addLink('出版社關係','採購'); 0`);
  await sleep(300);
  // [a]
  let A = await h.ev(analyse);
  let L = pick(A, '客服', '中文書籍');
  ok(L && L.kind === 'product', `[a] 客服→中文書籍 走產品路線 ${desc(L)}`);
  ok(good(L), `[a] 客服→中文書籍 無斜線、不穿其他方塊`);
  ok(L && A.margin && L.corrX < A.margin.x && L.corrX > A.actRight, `[a] 通道 x ${L && L.corrX} 在 Margin 左緣 ${A.margin && A.margin.x} 以左、方塊右緣 ${A.actRight} 以右`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/a-wide.png`);
  // [g] 非產品連線：與不帶 opts.product 時同一份 d
  const legacy = await h.ev(`(()=>{
    const editor = document.getElementById('valueChainEditor');
    const rects = Array.from(editor.querySelectorAll('[data-vc-id]')).map(el => getVcNodeRect(el.getAttribute('data-vc-id'))).filter(Boolean);
    const same = r => rects.find(o => o.x === r.x && o.y === r.y && o.w === r.w && o.h === r.h) || r;
    const prod = new Set(valueChain.products.map(n => n.id)); const rowUse = {}; const res = [];
    const pr = new Set(Array.from(editor.querySelectorAll('.vc-products-body [data-vc-id]')).map(el => same(vcOffsetRect(el))));
    const act = rects.filter(o => !pr.has(o));
    valueChain.links.forEach(l => { const r1 = getVcNodeRect(l.from), r2 = getVcNodeRect(l.to); if (!r1 || !r2) return;
      const d = vcRoundedPath(_st23bOrig(same(r1), same(r2), act, { near: 40, lift: 18, step: 10 }, rowUse).pts, 8);
      if (!prod.has(l.from) && !prod.has(l.to)) res.push(d); });
    return res; })()`);
  const nowNonProd = A.links.filter(l => l.kind !== 'product').map(l => l.d);
  ok(legacy.length === nowNonProd.length && legacy.every((d, i) => d === nowNonProd[i]), `[g] 非產品連線 ${legacy.length} 條的 path 與「不帶 product、rects 排除產品」逐字相同`);

  // [b] 再加兩條
  await h.ev(`_addLink('物流運輸','專業書籍'); _addLink('品牌','影音商品'); 0`); await sleep(400);
  A = await h.ev(analyse);
  const three = [pick(A, '客服', '中文書籍'), pick(A, '物流運輸', '專業書籍'), pick(A, '品牌', '影音商品')];
  three.forEach((l, i) => ok(l && l.kind === 'product' && good(l), `[b] 第 ${i + 1} 條 ${desc(l)}`));
  const xs = three.map(l => l && l.corrX).filter(x => x !== null);  // 與產品同高的那條是水平直線（不走通道）
  ok(xs.length >= 2 && new Set(xs.map(x => Math.round(x))).size === xs.length, `[b] 走通道的 ${xs.length} 條通道 x 互不相同 ${xs.map(x => Math.round(x)).join(',')}`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/b-multi.png`);

  // [d] 反向與產品→產品
  await h.ev(`_addLink('專業書籍','倉儲'); _addLink('中文書籍','影音商品'); 0`); await sleep(400);
  A = await h.ev(analyse);
  const rev = pick(A, '專業書籍', '倉儲'), pp = pick(A, '中文書籍', '影音商品');
  ok(rev && rev.kind === 'product' && good(rev), `[d] 產品→活動（專業書籍→倉儲）${desc(rev)}`);
  ok(pp && pp.kind === 'product' && good(pp), `[d] 產品→產品（中文書籍→影音商品，中間隔一個）${desc(pp)}`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/d-reverse.png`);
  await h.ev(`valueChain.links = valueChain.links.filter(l => !(l.from===_findId('專業書籍')&&l.to===_findId('倉儲')) && !(l.from===_findId('中文書籍')&&l.to===_findId('影音商品'))); commitValueChain(); 0`); await sleep(300);

  // [c] 關大箭頭
  await h.ev(`(()=>{const c=[...document.querySelectorAll('#valueChainEditor input[type=checkbox]')].find(e=>e.closest('label')&&/箭頭/.test(e.closest('label').textContent));c.checked=false;c.dispatchEvent(new Event('change'));})(); 0`); await sleep(500);
  A = await h.ev(analyse);
  const three2 = [pick(A, '客服', '中文書籍'), pick(A, '物流運輸', '專業書籍'), pick(A, '品牌', '影音商品')];
  ok(!A.margin, `[c] 已無 Margin 箭頭`);
  three2.forEach((l, i) => ok(l && l.kind === 'product' && good(l), `[c] 關箭頭 第 ${i + 1} 條 ${desc(l)}`));
  const xs2 = three2.map(l => l && l.corrX).filter(x => x !== null);
  ok(xs2.length >= 2 && new Set(xs2.map(x => Math.round(x))).size === xs2.length && xs2.every(x => x > A.actRight), `[c] 三條通道 x 互不相同且在方塊右緣 ${A.actRight} 以右 ${xs2.map(x => Math.round(x)).join(',')}`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/c-no-arrow.png`);
  await h.ev(`valueChain.showArrowBg=true; commitValueChain(); 0`); await sleep(300);

  // [e] bio-pharma-tw：群組子項→產品
  await h.ev(`(()=>{valueChain=normaliseValueChain(JSON.parse(JSON.stringify(VC_TEMPLATES.find(x=>x.id==='bio-pharma-tw').valueChain)));resetValueChainIds(valueChain);commitValueChain();})(); 0`); await sleep(600);
  const bio = await h.ev(`(()=>{const g=valueChain.primary.find(n=>n.children&&n.children.length);const c=g&&g.children[g.children.length-1];const p=valueChain.products[valueChain.products.length-1];
    if(!c||!p) return null; valueChain.links.push({id:genNodeId(vcUsedIds),from:c.id,to:p.id}); commitValueChain(); return {from:c.id,to:p.id,fromName:c.name,toName:p.name};})()`);
  await sleep(500);
  A = await h.ev(analyse);
  const bl = bio && A.links.find(l => l.from === bio.from && l.to === bio.to);
  ok(bl && bl.kind === 'product' && good(bl), `[e] bio-pharma-tw 群組子項「${bio && bio.fromName}」→產品「${bio && bio.toName}」${desc(bl)}`);
  ok(A.links.every(l => !l.nan && l.ortho), `[e] bio-pharma-tw 全部 ${A.links.length} 條無 NaN、無斜線`);
  await h.shot('#valueChainEditor .vc-zones', `${out}/e-bio-pharma.png`);
  ok(h.errors().length === 0, `[g] 寬版無 console error ${JSON.stringify(h.errors())}`);
} finally { await h.close(); }

// [f] 700px 窄螢幕
{
  const h2 = await launch({ width: 700, height: 900 });
  try {
    await fresh(h2, html); await h2.loadExample('bookstore-a');
    await h2.ev(`guideGoto('chain'); 0`); await sleep(700);
    await h2.ev(setup);
    await h2.ev(`_addLink('客服','中文書籍'); _addLink('物流運輸','專業書籍'); 0`); await sleep(400);
    const A = await h2.ev(analyse);
    ok(A.links.length >= 2 && A.links.every(l => l.kind !== 'product' && !l.nan), `[f] 700px：${A.links.length} 條都走舊路線（${[...new Set(A.links.map(l => l.kind))].join('/')}）、無 NaN`);
    ok(h2.errors().length === 0, `[g] 窄版無 console error ${JSON.stringify(h2.errors())}`);
  } finally { await h2.close(); }
}
process.exit(fail ? 1 : 0);
