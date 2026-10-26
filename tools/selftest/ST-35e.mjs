// ST-35e 自測：價值鏈六角鏈式（hex）。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35e.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35e/）
// 測了什麼：
//   [a] bookstore-a、bio-aesthetic 範例切 hex：無 console error、zones 同時有 vc-layout-band／vc-layout-hex、
//       .vc-link-main 數＝有效 links 數、端點在方塊外框邊（容差 3px）
//   [g] 測試價值鏈（巢狀群組＋空群組＋6 條連線）切 hex：同 [a][b][c] 檢查＋800 寬直排＋截圖
//   [b] 相鄰頂層顆（葉節點或群組）背景不同；同群組內葉節點同色相（--vc-hex 相同）；葉節點 clip-path 是六角 polygon
//   [c] 每顆非資產葉節點白字對 computed background 的 WCAG 對比 ≥ 4.5；群組橫帶亦同
//   [d] 六套配色（COLOR_PALETTES）各截圖一張 1400（bio-aesthetic）
//   [e] 切回 porter：DOM 與切換前相同；reload 後 hex 保留
//   [f] 800 寬：葉節點不是六角、group-body 直排
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35e'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h) { await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html); }
const goChain = async h => { await h.ev(`guideGoto('chain'); 0`); await sleep(700); };
const domSig = h => h.ev(`(()=>{const c=document.getElementById('valueChainEditor').cloneNode(true);c.querySelectorAll('svg').forEach(s=>s.remove());return c.innerHTML})()`);
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
const linkCheck = `(()=>{
  const ps=[...document.querySelectorAll('#vcLineCanvas .vc-link-main')];
  const valid=valueChain.links.filter(l=>getVcNodeRect(l.from)&&getVcNodeRect(l.to));
  const onEdge=(p,r,t=3)=>p.x>=r.x-t&&p.x<=r.x+r.w+t&&p.y>=r.y-t&&p.y<=r.y+r.h+t&&
    (Math.abs(p.x-r.x)<=t||Math.abs(p.x-r.x-r.w)<=t||Math.abs(p.y-r.y)<=t||Math.abs(p.y-r.y-r.h)<=t);
  const bad=[];
  ps.forEach((p,i)=>{const d=p.getAttribute('d')||'';const nums=(d.match(/-?\\d+(\\.\\d+)?/g)||[]).map(Number);
    const s={x:nums[0],y:nums[1]}, e={x:nums[nums.length-2],y:nums[nums.length-1]};const l=valid[i];
    if(/NaN/.test(d)||!l||!onEdge(s,getVcNodeRect(l.from))||!onEdge(e,getVcNodeRect(l.to))) bad.push({i,link:l&&l.id,s,e});});
  return {n:ps.length, links:valid.length, bad};
})()`;
// 顏色解析（rgb()／color(srgb r g b)）＋ WCAG 對比，在頁面內算
const colorFn = `
  const parse=c=>{let m=c.match(/rgba?\\(([^)]+)\\)/); if(m){const a=m[1].split(/[ ,\\/]+/).map(Number);return a.slice(0,3);}
    m=c.match(/color\\(srgb ([^)]+)\\)/); if(m){return m[1].split(/[ \\/]+/).slice(0,3).map(x=>Math.round(Number(x)*255));} return null;};
  const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
  const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};`;
const hexInfo = `(()=>{${colorFn}
  const P=document.querySelector('.vc-zone-primary');
  const leaves=[...P.querySelectorAll('.vc-unit')].map(u=>{const bg=getComputedStyle(u).backgroundColor;const rgb=parse(bg);
    return {id:u.dataset.vcId,asset:u.classList.contains('vc-asset'),bg,hue:u.style.getPropertyValue('--vc-hex'),idx:u.style.getPropertyValue('--vc-hex-idx'),
      clip:getComputedStyle(u).clipPath,cr:rgb?cr(rgb,[255,255,255]):0,parent:u.parentElement.parentElement.dataset.vcId||'',
      color:getComputedStyle(u.querySelector('textarea,input')).color}});
  const heads=[...P.querySelectorAll('.vc-group > .vc-node-head')].map(h=>{const rgb=parse(getComputedStyle(h).backgroundColor);const el=h.querySelector('input,textarea');const fg=el?parse(getComputedStyle(el).color):[255,255,255];return {cr:rgb&&fg?cr(rgb,fg):0,bg:getComputedStyle(h).backgroundColor}});
  const top=[...P.querySelector('.vc-zone-body').children].filter(e=>e.matches('.vc-unit,.vc-group')).map(e=>({id:e.dataset.vcId,idx:e.style.getPropertyValue('--vc-hex-idx'),
    bg:getComputedStyle(e.matches('.vc-group')?e.querySelector(':scope>.vc-node-head'):e).backgroundColor}));
  return {zones:document.querySelector('.vc-zones').className,leaves,heads,top};
})()`;

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
async function checkHex(h, tag) {
  const g = await h.ev(hexInfo);
  ok(/vc-layout-band/.test(g.zones) && /vc-layout-hex/.test(g.zones), `[${tag}] zones class「${g.zones}」`);
  const lc = await h.ev(linkCheck);
  ok(lc.n === lc.links && !lc.bad.length, `[${tag}] path ${lc.n}＝有效 links ${lc.links}、端點在外框邊 ${JSON.stringify(lc.bad)}`);
  ok(g.leaves.every(l => /polygon/.test(l.clip) && /18px/.test(l.clip)), `[${tag}] 葉節點 clip-path 為六角 polygon`);
  let adjOk = true; const adjBad = [];
  for (let i = 1; i < g.top.length; i++) if (g.top[i].bg === g.top[i - 1].bg) { adjOk = false; adjBad.push(g.top[i].id); }
  ok(adjOk, `[${tag}] 相鄰頂層顆背景不同 ${adjBad}`);
  const byGroup = {};
  g.leaves.forEach(l => { if (l.parent) (byGroup[l.parent] ||= []).push(l); });
  const sameHue = Object.values(byGroup).every(a => new Set(a.map(l => l.hue)).size === 1);
  ok(sameHue, `[${tag}] 同群組葉節點同色相`);
  const low = g.leaves.filter(l => !l.asset && l.cr < 4.5);
  ok(!low.length, `[${tag}] 非資產葉節點白字對比 ≥ 4.5（最低 ${Math.min(...g.leaves.filter(l => !l.asset).map(l => l.cr)).toFixed(2)}）${JSON.stringify(low.map(l => [l.id, l.bg]))}`);
  ok(g.heads.every(x => x.cr >= 4.5), `[${tag}] 群組橫帶字色對比（分色配色下為淡底深字） ≥ 4.5（最低 ${Math.min(...g.heads.map(x => x.cr)).toFixed(2)}）`);
  ok(g.leaves.filter(l => !l.asset).every(l => /255, 255, 255/.test(l.color)), `[${tag}] 葉節點文字色為白`);
}

for (const id of ['bookstore-a', 'bio-aesthetic']) {
  const h = await launch();
  try {
    await fresh(h); await h.loadExample(id); await goChain(h);
    const before = await domSig(h);
    await setLayout(h, 'hex');
    ok(h.errors().length === 0, `[a ${id}] 切 hex 無 error ${JSON.stringify(h.errors())}`);
    await checkHex(h, 'a ' + id);
    await h.shot('#valueChainEditor .vc-zones', `${out}/a-${id}-hex.png`);
    await setLayout(h, 'porter');
    ok((await domSig(h)) === before, `[e ${id}] 切回 porter DOM 與切換前相同`);
    await setLayout(h, 'hex'); await h.open(html); await goChain(h);
    ok((await h.ev('valueChain.layout')) === 'hex' && h.errors().length === 0, `[e ${id}] reload 後仍為 hex、無 error`);
  } finally { await h.close(); }
}

// [g] 測試價值鏈（含群組、連線）
{
  const h = await launch();
  try {
    await fresh(h); await goChain(h); await setVc(h, TEST_VC); await setLayout(h, 'hex');
    ok(h.errors().length === 0, `[g] 無 error ${JSON.stringify(h.errors())}`);
    await checkHex(h, 'g test');
    const g = await h.ev(hexInfo);
    ok(g.heads.length >= 3 && g.heads.every(x => x.cr >= 4.5 && isFinite(x.cr)), `[g] 有 ${g.heads.length} 條群組橫帶且對比 OK`);
    await h.shot('#valueChainEditor', `${out}/g-test-hex.png`);
  } finally { await h.close(); }
}

// [d] 六套配色截圖
{
  const h = await launch();
  try {
    await fresh(h); await goChain(h); await setVc(h, TEST_VC); await setLayout(h, 'hex');
    const n = await h.ev('COLOR_PALETTES.length');
    for (let i = 0; i < n; i++) {
      await h.ev(`applyPalette(${i}); 0`); await sleep(400);
      await h.shot('#valueChainEditor', `${out}/d-palette-${i}.png`);
    }
    ok(n >= 6 && h.errors().length === 0, `[d] ${n} 套配色截圖完成、無 error`);
    await checkHex(h, 'd 配色末套');
  } finally { await h.close(); }
}

// [f] 800 寬
{
  const h = await launch({ width: 800, height: 900 });
  try {
    await fresh(h); await goChain(h); await setVc(h, TEST_VC); await setLayout(h, 'hex');
    const g = await h.ev(`({clips:[...new Set([...document.querySelectorAll('.vc-zone-primary .vc-unit')].map(u=>getComputedStyle(u).clipPath))],
      dirs:[...new Set([...document.querySelectorAll('.vc-zone-primary .vc-group-body')].map(b=>getComputedStyle(b).flexDirection))]})`);
    ok(g.clips.every(c => !/18px/.test(c)) && g.dirs.length > 0 && g.dirs.every(d => d === 'column') && h.errors().length === 0, `[f 800] 非六角、直排（clip ${g.clips}、dir ${g.dirs}）`);
    await h.shot('#valueChainEditor', `${out}/f-hex-800.png`);
  } finally { await h.close(); }
}
console.log(fail ? `FAIL ×${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
