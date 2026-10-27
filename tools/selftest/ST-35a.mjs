// ST-35a 自測：價值鏈版型切換骨架＋橫帶式（B）。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35a.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35a/）
// 測了什麼：
//   [a] 兩個範例（bookstore-a、foundry-t）與兩份 fixtures 載入無 console error，valueChain.layout==='porter'；
//       舊存檔（fixture 無 layout 欄位）載入後也是 'porter'；.vc-layout-select 存在且值 porter；Porter 下 .vc-zones 沒有 vc-layout-* class
//   [b] 測試價值鏈（巢狀群組＋空群組＋6 條連線，含支援→子項、子項→產品、群組端點）1400×900：
//       porter 截圖 → 記 DOM（#valueChainEditor innerHTML 去掉 svg）→ 下拉切 band → 無 error、.vc-zones 有 vc-layout-band、
//       group-body flex-direction=row、葉節點 clip-path 是 polygon、首支 .vc-chev-first 只有一個；
//       葉節點等寬（±2px）、葉節點底緣對齊（±2px）、群組橫帶寬 ≥ 子項總寬 − 16、橫帶在子項上方；
//       .vc-link-main 數＝links 數、每條起訖點落在對應 [data-vc-id] 矩形邊上（容差 3px）、無 NaN；band 截圖
//   [c] 拖放（band）：在群組內把第 1 個子項拖到第 2 個子項右半 → 順序對調；拖到另一個群組的空白處 → 進該群組最後；
//       落點預覽方向 vc-drop-h（橫排）
//   [d] reload 後 layout 仍為 band、仍有 vc-layout-band；切回 porter 後 DOM 與切換前相同
//   [e] 800×900：band 存檔載入無 error、葉節點 clip-path 不是 chevron、group-body 直排（column）、主要活動列直排；截圖
//   [g] 範本 bio-aesthetic（連鎖醫美診所，巢狀群組＋單葉群組）1400 band：每個 .vc-group > .vc-node-head 的名稱 textarea
//       scrollHeight ≤ clientHeight 且 scrollWidth ≤ clientWidth（不裁字、一行放得下）、head 寬 ≥ group-body 寬 − 2px；
//       滑鼠移到頂層群組橫帶（出現 ＋同層／＋子項／✕）後名稱仍不裁字；截圖 g-bio-band-1400.png、g-bio-band-hover.png
//   [f] console error 0
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35a'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h) { await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html); }
const goChain = async h => { await h.ev(`guideGoto('chain'); 0`); await sleep(700); };

const TEST_VC = {
  support: [{ id: 's1', name: '人力資源', type: 'unit' }],
  primary: [
    { id: 'a', name: '研發', type: 'unit' },
    { id: 'g1', name: '製造', type: 'group', children: [
      { id: 'b1', name: '原料採購', type: 'unit' },
      { id: 'g2', name: '生產', type: 'group', children: [
        { id: 'c1', name: '前段製程', type: 'unit' }, { id: 'c2', name: '後段封裝', type: 'unit', unitKind: 'asset' } ] },
      { id: 'b2', name: '品管', type: 'unit', unitRole: 'lead' } ] },
    { id: 'd', name: '行銷', type: 'unit' },
    { id: 'g3', name: '服務', type: 'group', children: [ { id: 'e1', name: '客服', type: 'unit' }, { id: 'e2', name: '維修', type: 'unit' } ] },
    { id: 'g4', name: '空群組', type: 'group', children: [] },
  ],
  products: [{ id: 'p1', name: '產品一', type: 'unit' }, { id: 'p2', name: '產品二', type: 'unit' }],
  links: [
    { id: 'l1', from: 'a', to: 'c1' }, { id: 'l2', from: 'c2', to: 'd' }, { id: 'l3', from: 's1', to: 'b2' },
    { id: 'l4', from: 'e2', to: 'p1' }, { id: 'l5', from: 'g1', to: 'g3' }, { id: 'l6', from: 'b1', to: 'e1' },
  ],
  showArrowBg: true,
};
const setVc = async (h, vc) => { await h.ev(`valueChain = normaliseValueChain(${JSON.stringify(vc)}); resetValueChainIds(valueChain); commitValueChain(); 0`); await sleep(400); };
const domSig = h => h.ev(`(()=>{const c=document.getElementById('valueChainEditor').cloneNode(true);c.querySelectorAll('svg').forEach(s=>s.remove());return c.innerHTML})()`);
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
// 連線端點：每條 .vc-link-main 的第一點／最後一點要落在 from／to 方塊矩形邊上（容差 3px）
const linkCheck = `(()=>{
  const ps=[...document.querySelectorAll('#vcLineCanvas .vc-link-main')];
  const valid=valueChain.links.filter(l=>getVcNodeRect(l.from)&&getVcNodeRect(l.to));
  const onEdge=(p,r,t=3)=>p.x>=r.x-t&&p.x<=r.x+r.w+t&&p.y>=r.y-t&&p.y<=r.y+r.h+t&&
    (Math.abs(p.x-r.x)<=t||Math.abs(p.x-r.x-r.w)<=t||Math.abs(p.y-r.y)<=t||Math.abs(p.y-r.y-r.h)<=t);
  const bad=[];
  ps.forEach((p,i)=>{const d=p.getAttribute('d')||'';const nums=(d.match(/-?\\d+(\\.\\d+)?/g)||[]).map(Number);
    const s={x:nums[0],y:nums[1]}, e={x:nums[nums.length-2],y:nums[nums.length-1]};const l=valid[i];
    if(/NaN/.test(d)||!l||!onEdge(s,getVcNodeRect(l.from))||!onEdge(e,getVcNodeRect(l.to))) bad.push({i,link:l&&l.id,s,e,d:d.slice(0,80),rf:l&&getVcNodeRect(l.from),rt:l&&getVcNodeRect(l.to)});});
  return {n:ps.length, links:valueChain.links.length, bad};
})()`;
const bandGeo = `(()=>{
  const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}};
  const P=document.querySelector('.vc-zone-primary');
  const leaves=[...P.querySelectorAll('.vc-unit')].map(u=>({id:u.dataset.vcId,...R(u),clip:getComputedStyle(u).clipPath}));
  const groups=[...P.querySelectorAll('.vc-group')].map(g=>{const head=g.querySelector(':scope > .vc-node-head'),body=g.querySelector(':scope > .vc-group-body');
    const kids=[...body.querySelectorAll('.vc-unit')].map(R);
    return {id:g.dataset.vcId, head:R(head), body:R(body), dir:getComputedStyle(body).flexDirection, kidsL:Math.min(...kids.map(k=>k.l)), kidsR:Math.max(...kids.map(k=>k.r)), kidsT:Math.min(...kids.map(k=>k.t)), nk:kids.length}});
  return {zones:document.querySelector('.vc-zones').className, leaves, groups, first:[...P.querySelectorAll('.vc-chev-first')].map(e=>e.dataset.vcId),
    rowDir:getComputedStyle(document.querySelector('.vc-activities-row')).flexDirection};
})()`;
// 模擬 HTML5 拖放：dragstart(src) → dragover(target 在 fx 比例位置) → drop
const drag = (srcId, targetSel, fx) => `(()=>{
  const src=document.querySelector('[data-vc-id="${srcId}"]'), tgt=document.querySelector(${JSON.stringify(targetSel)});
  const dt=new DataTransfer(); const r=tgt.getBoundingClientRect(); const x=r.left+r.width*${fx}, y=r.top+r.height/2;
  src.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
  tgt.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:x,clientY:y}));
  const ph=document.querySelector('.vc-drop-placeholder'); const phCls=ph?ph.className:'';
  tgt.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:x,clientY:y}));
  return phCls;
})()`;

// [a] 範例與 fixtures
for (const id of ['bookstore-a', 'foundry-t']) {
  const h = await launch();
  try {
    await fresh(h); await h.loadExample(id); await goChain(h);
    const s = await h.ev(`({layout:valueChain.layout, sel:(document.querySelector('.vc-layout-select')||{}).value, cls:document.querySelector('.vc-zones').className})`);
    ok(h.errors().length === 0 && s.layout === 'porter' && s.sel === 'porter' && !/vc-layout-/.test(s.cls), `[a 範例 ${id}] 無 error、layout=${s.layout}、下拉=${s.sel}、zones class「${s.cls}」 ${JSON.stringify(h.errors())}`);
    const raw = JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')));
    ok(!('layout' in JSON.parse(raw).valueChain), `[a fixture ${id}] fixture 本身沒有 layout 欄位（舊存檔）`);
    await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
    await h.open(html); await goChain(h);
    const f = await h.ev(`({layout:valueChain.layout, saved:JSON.parse(localStorage.getItem('strategyMatrix_v4')).valueChain.layout})`);
    ok(h.errors().length === 0 && f.layout === 'porter', `[a fixture ${id}] 載入無 error、layout=${f.layout} ${JSON.stringify(h.errors())}`);
    // 範例本身切 band 也要能畫、連線數對
    await setLayout(h, 'band');
    const lc = await h.ev(linkCheck);
    ok(h.errors().length === 0 && lc.n === lc.links && !lc.bad.length, `[a fixture ${id}] 切 band：path ${lc.n}＝links ${lc.links}、端點在邊上 ${JSON.stringify(lc.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/a-${id}-band.png`);
  } finally { await h.close(); }
}

// [b]–[d] 1400×900 測試價值鏈
{
  const h = await launch();
  try {
    await fresh(h); await goChain(h);
    await setVc(h, TEST_VC);
    await h.shot('#valueChainEditor .vc-zones', `${out}/b-porter-1400.png`);
    const before = await domSig(h);
    await setLayout(h, 'band');
    ok(h.errors().length === 0, `[b] 切 band 無 error ${JSON.stringify(h.errors())}`);
    const g = await h.ev(bandGeo);
    ok(/vc-layout-band/.test(g.zones) && (await h.ev('valueChain.layout')) === 'band', `[b] zones class「${g.zones}」、valueChain.layout=band`);
    ok(g.groups.every(x => x.dir === 'row'), `[b] group-body flex-direction=row（${g.groups.map(x => x.dir)}）`);
    ok(g.leaves.every(l => /polygon/.test(l.clip)), `[b] 葉節點 clip-path 都是 polygon`);
    ok(g.first.length === 1 && g.first[0] === 'a', `[b] .vc-chev-first 只有第一支（${g.first}）`);
    const ws = g.leaves.map(l => l.w), bs = g.leaves.map(l => l.b);
    ok(Math.max(...ws) - Math.min(...ws) <= 2, `[b] 葉節點等寬 ${ws.map(Math.round)}`);
    ok(Math.max(...bs) - Math.min(...bs) <= 2, `[b] 葉節點底緣對齊 ${bs.map(Math.round)}`);
    const full = g.groups.filter(x => x.nk);
    ok(full.every(x => x.head.w >= (x.kidsR - x.kidsL) - 16 && x.head.b <= x.kidsT + 1), `[b] 群組橫帶跨子項且在上方 ${JSON.stringify(full.map(x => ({ id: x.id, head: Math.round(x.head.w), kids: Math.round(x.kidsR - x.kidsL) })))}`);
    const g1 = g.groups.find(x => x.id === 'g1'), g2 = g.groups.find(x => x.id === 'g2');
    ok(g2.head.t > g1.head.b - 1, `[b] 巢狀群組疊帶：g2 橫帶在 g1 橫帶下方`);
    const lc = await h.ev(linkCheck);
    ok(lc.n === lc.links && lc.n === 6 && !lc.bad.length, `[b] .vc-link-main ${lc.n}＝links ${lc.links}、端點在對應方塊邊上 ${JSON.stringify(lc.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/b-band-1400.png`);
    await h.shot('#valueChainEditor', `${out}/b-band-1400-editor.png`);

    // [c] 拖放
    const order = id => h.ev(`(()=>{const f=(ns)=>{for(const n of ns){if(n.id===${JSON.stringify(id)})return n.children.map(c=>c.id);if(n.children){const r=f(n.children);if(r)return r;}}};return f(valueChain.primary)})()`);
    const ph = await h.ev(drag('e1', '[data-vc-id="e2"]', 0.8));
    const o3 = await order('g3');
    ok(JSON.stringify(o3) === '["e2","e1"]' && /vc-drop-h/.test(ph), `[c] 群組內拖到右半＝插在後面：g3 子項 ${o3}、預覽 ${ph}`);
    await h.ev(drag('d', '[data-vc-id="g4"] > .vc-group-body', 0.5));
    const o4 = await order('g4');
    ok(JSON.stringify(o4) === '["d"]', `[c] 拖到空群組空白處＝放進群組：g4 子項 ${o4}`);
    const lc2 = await h.ev(linkCheck);
    ok(h.errors().length === 0 && lc2.n === lc2.links && !lc2.bad.length, `[c] 拖放後連線端點仍在邊上 ${JSON.stringify(lc2.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/c-band-after-drag.png`);
    await setVc(h, { ...TEST_VC, layout: 'band' });

    // [d] reload 保留 band；切回 porter DOM 相同
    await h.open(html); await goChain(h);
    const r = await h.ev(`({layout:valueChain.layout, cls:document.querySelector('.vc-zones').className, sel:document.querySelector('.vc-layout-select').value})`);
    ok(r.layout === 'band' && /vc-layout-band/.test(r.cls) && r.sel === 'band', `[d] reload 後仍是 band（${JSON.stringify(r)}）`);
    await setLayout(h, 'porter');
    const after = await domSig(h);
    ok(before === after, `[d] 切回 porter 後 DOM 與切換前相同（長度 ${before.length} / ${after.length}）`);
    if (before !== after) { let i = 0; while (before[i] === after[i]) i++; console.log('  diff @', i, before.slice(i - 60, i + 80), '\n  vs', after.slice(i - 60, i + 80)); }
    await h.shot('#valueChainEditor .vc-zones', `${out}/d-porter-back-1400.png`);
    ok(h.errors().length === 0, `[f 1400] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [e] 800×900 回直排
{
  const h = await launch({ width: 800, height: 900 });
  try {
    await fresh(h); await goChain(h);
    await setVc(h, { ...TEST_VC, layout: 'band' });
    await h.open(html); await goChain(h);
    const g = await h.ev(bandGeo);
    ok(/vc-layout-band/.test(g.zones), `[e 800] 存檔 band 載入（${g.zones}）`);
    ok(g.leaves.every(l => !/14px 50%/.test(l.clip)), `[e 800] 葉節點不是 chevron（clip ${[...new Set(g.leaves.map(l => l.clip))].join(' | ')}）`);
    ok(g.groups.every(x => x.dir === 'column') && g.rowDir === 'column', `[e 800] group-body 與主要活動列直排（${g.groups.map(x => x.dir)} / ${g.rowDir}）`);
    const lc = await h.ev(linkCheck);
    ok(lc.n === lc.links && !lc.bad.length, `[e 800] 連線 ${lc.n}＝${lc.links}、端點在邊上 ${JSON.stringify(lc.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/e-band-800.png`);
    await setLayout(h, 'porter');
    await h.shot('#valueChainEditor .vc-zones', `${out}/e-porter-800.png`);
    ok(h.errors().length === 0, `[f 800] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [g] bio-aesthetic 範本
{
  const h = await launch();
  try {
    await fresh(h); await goChain(h);
    await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400);
    await setLayout(h, 'band');
    const heads = `[...document.querySelectorAll('.vc-zone-primary .vc-group')].map(g=>{const hd=g.querySelector(':scope > .vc-node-head'),t=hd.querySelector('textarea'),b=g.querySelector(':scope > .vc-group-body');
      return {name:t.value, sh:t.scrollHeight, ch:t.clientHeight, sw:t.scrollWidth, cw:t.clientWidth, hw:hd.getBoundingClientRect().width, bw:b.getBoundingClientRect().width}})`;
    const hs = await h.ev(heads);
    const bad = hs.filter(x => x.sh > x.ch || x.sw > x.cw + 1 || x.hw < x.bw - 2);
    ok(hs.length >= 5 && !bad.length, `[g bio] ${hs.length} 個群組橫帶不裁字、一行放得下、與子項同寬 ${JSON.stringify(bad)}`);
    const lc = await h.ev(linkCheck);
    ok(lc.n === lc.links && !lc.bad.length, `[g bio] 連線 ${lc.n}＝${lc.links}、端點在邊上 ${JSON.stringify(lc.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/g-bio-band-1400.png`);
    // hover 頂層群組橫帶
    const p = await h.ev(`(()=>{const hd=document.querySelector('.vc-zone-primary > .vc-zone-body > .vc-group > .vc-node-head');hd.scrollIntoView({block:'center'});const r=hd.getBoundingClientRect();return {x:r.left+8,y:r.top+r.height/2}})()`);
    await h.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await sleep(300);
    const hv = await h.ev(`(()=>{const hd=document.querySelector('.vc-zone-primary > .vc-zone-body > .vc-group > .vc-node-head'),t=hd.querySelector('textarea');
      return {acts:[...hd.querySelectorAll('.vc-act')].filter(a=>getComputedStyle(a).display!=='none').length, sh:t.scrollHeight, ch:t.clientHeight, sw:t.scrollWidth, cw:t.clientWidth}})()`);
    ok(hv.acts === 3 && hv.sh <= hv.ch && hv.sw <= hv.cw + 1, `[g bio] hover 橫帶出現 3 個動作鈕、名稱不被擠 ${JSON.stringify(hv)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/g-bio-band-hover.png`);
    ok(h.errors().length === 0, `[f bio] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

console.log(fail ? `\n${fail} 項 FAIL` : '\n全部 PASS');
process.exit(fail ? 1 : 0);
