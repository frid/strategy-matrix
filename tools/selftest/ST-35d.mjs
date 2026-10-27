// ST-35d 自測：圓形 icon 式（F）。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35d.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35d/）
// 測了什麼：bookstore-a（動態給前 5 個主要活動葉節點 icon）、bio-aesthetic 切 circle 無 console error；
//   每個主要活動葉 unit 有 48px 圓、圓內有 icon 或首字（data-initial ::before）；連線 path 數＝links 數，
//   主要活動葉端點到圓心距離＝半徑（容差 3px），其他端點在 vcNodeRectForLayout 矩形邊上（3px）；
//   群組底板矩形包住其子項；Margin 背景 #2b2d31；支援活動白底膠囊；CDP 點圓開 icon 選單並套用；
//   六套配色截圖（1400）；切回 porter DOM 與切換前相同；800 寬直排（主要活動 column、圓與名稱同列）。
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35d'; mkdirSync(out, { recursive: true });
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
  const isLeaf=id=>!!document.querySelector('.vc-zone-primary .vc-unit[data-vc-id="'+id+'"]');
  const onEdge=(p,r,t=3)=>p.x>=r.x-t&&p.x<=r.x+r.w+t&&p.y>=r.y-t&&p.y<=r.y+r.h+t&&
    (Math.abs(p.x-r.x)<=t||Math.abs(p.x-r.x-r.w)<=t||Math.abs(p.y-r.y)<=t||Math.abs(p.y-r.y-r.h)<=t);
  const onCircle=(p,r,t=3)=>Math.abs(Math.hypot(p.x-(r.x+r.w/2),p.y-(r.y+r.h/2))-r.w/2)<=t;
  const good=(p,id)=>{const r=vcNodeRectForLayout(id);return isLeaf(id)?(r.w===48&&onCircle(p,r)):onEdge(p,r)};
  const bad=[];let leafEnds=0;
  ps.forEach((p,i)=>{const d=p.getAttribute('d')||'';const nums=(d.match(/-?\\d+(\\.\\d+)?/g)||[]).map(Number);
    const s={x:nums[0],y:nums[1]}, e={x:nums[nums.length-2],y:nums[nums.length-1]};const l=valid[i];
    if(l){leafEnds+=isLeaf(l.from)+isLeaf(l.to);}
    if(/NaN/.test(d)||!l||!good(s,l.from)||!good(e,l.to)) bad.push({i,link:l&&l.id,d:d.slice(0,90)});});
  return {n:ps.length, links:valueChain.links.length, leafEnds, bad};
})()`;
const circleGeo = `(()=>{
  const leaves=[...document.querySelectorAll('.vc-zone-primary .vc-unit')];
  const bad=[];
  leaves.forEach(u=>{const b=u.querySelector(':scope > .vc-node-head > .vc-icon-btn');
    if(!b){bad.push({id:u.dataset.vcId,why:'no btn'});return;}
    const r=b.getBoundingClientRect(), cs=getComputedStyle(b);
    const txt=b.classList.contains('vc-icon-empty')?getComputedStyle(b,'::before').content.replace(/"/g,''):b.textContent;
    if(Math.round(r.width)!==48||Math.round(r.height)!==48||cs.borderRadius!=='50%'||!txt||txt==='none') bad.push({id:u.dataset.vcId,w:r.width,h:r.height,br:cs.borderRadius,txt});
    const ta=u.querySelector('textarea').getBoundingClientRect();
    if(innerWidth>800&&ta.top<r.bottom-1) bad.push({id:u.dataset.vcId,why:'name not below circle'});});
  const groups=[...document.querySelectorAll('.vc-zone-primary .vc-group')].map(g=>{const gr=g.getBoundingClientRect();
    const out=[...g.querySelectorAll(':scope > .vc-group-body > *')].filter(c=>{const r=c.getBoundingClientRect();
      return r.left<gr.left-0.5||r.top<gr.top-0.5||r.right>gr.right+0.5||r.bottom>gr.bottom+0.5}).map(c=>c.dataset.vcId);
    return {id:g.dataset.vcId,bg:getComputedStyle(g).backgroundColor,border:getComputedStyle(g).borderTopStyle,out}});
  const m=document.querySelector('.vc-margin-arrow');
  const sup=[...document.querySelectorAll('.vc-zone-support .vc-unit:not(.vc-asset)')].map(u=>getComputedStyle(u).backgroundColor+'|'+getComputedStyle(u).borderTopLeftRadius);
  const colors=[...new Set(leaves.filter(u=>!u.classList.contains('vc-asset')).map(u=>getComputedStyle(u.querySelector('.vc-icon-btn')).backgroundColor))];
  return {n:leaves.length,bad,groups,margin:m&&getComputedStyle(m).backgroundColor,sup,colors,zones:document.querySelector('.vc-zones').className};
})()`;
const palettes = 6;

for (const id of ['bookstore-a', 'bio-aesthetic']) {
  const h = await launch();
  try {
    await fresh(h);
    if (id === 'bio-aesthetic') { await goChain(h); await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400); }
    else {
      await h.loadExample(id); await goChain(h);
      // 動態給前 5 個主要活動葉節點 icon
      await h.ev(`(()=>{const ic=['🔬','📦','⚙️','📣','🚚'];let k=0;const w=n=>{if(n.type==='group')n.children.forEach(w);else if(k<5)n.icon=ic[k++];};valueChain.primary.forEach(w);commitValueChain();})(); 0`); await sleep(300);
    }
    await h.ev(`valueChain.showArrowBg=true; commitValueChain(); 0`); await sleep(300);
    const sig0 = await domSig(h);
    await setLayout(h, 'circle');
    ok(h.errors().length === 0, `[${id}] circle 無 console error ${JSON.stringify(h.errors())}`);
    const g = await h.ev(circleGeo);
    ok(g.zones.includes('vc-layout-circle') && !g.zones.includes('vc-layout-band'), `[${id}] 掛 vc-layout-circle、不掛 band`);
    ok(g.n > 0 && !g.bad.length, `[${id}] ${g.n} 個葉 unit 皆有 48px 圓＋icon／首字、名稱在圓下 ${JSON.stringify(g.bad)}`);
    ok(g.colors.length >= Math.min(3, g.n), `[${id}] 圓有多色相 ${JSON.stringify(g.colors)}`);
    ok(g.groups.every(x => !x.out.length && x.border === 'dashed'), `[${id}] 群組虛線底板包住子項 ${JSON.stringify(g.groups)}`);
    ok(g.margin === 'rgb(43, 45, 49)', `[${id}] Margin 背景 #2b2d31（${g.margin}）`);
    ok((id === 'bookstore-a' || g.sup.length > 0) && g.sup.every(s => s.startsWith('rgb(255, 255, 255)|') && parseFloat(s.split('|')[1]) >= 100), `[${id}] 支援活動白底膠囊（${g.sup.length} 項）${JSON.stringify(g.sup)}`);
    const lc = await h.ev(linkCheck);
    ok(lc.n === lc.links && !lc.bad.length, `[${id}] 連線 ${lc.n}＝${lc.links}、葉端點 ${lc.leafEnds} 個落在圓外框 ${JSON.stringify(lc.bad)}`);
    for (let i = 0; i < palettes; i++) {
      await h.ev(`applyPalette(${i}); 0`); await sleep(300);
      await h.shot('#valueChainEditor .vc-zones', `${out}/${id}-palette${i}.png`);
    }
    await h.ev(`applyPalette(0); 0`);
    await setLayout(h, 'porter');
    ok((await domSig(h)) === sig0, `[${id}] 切回 porter DOM 不變`);
    ok(h.errors().length === 0, `[${id}] 全程 console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}
// CDP 點圓開 icon 選單並套用（沒 icon → 首字；套用後顯示 icon）
{
  const h = await launch();
  try {
    await fresh(h); await h.loadExample('bookstore-a'); await goChain(h); await setLayout(h, 'circle');
    const uid = await h.ev(`[...document.querySelectorAll('.vc-zone-primary .vc-unit')].find(u=>u.querySelector('.vc-icon-btn.vc-icon-empty')).dataset.vcId`);
    const btnSel = `[data-vc-id="${uid}"] > .vc-node-head > .vc-icon-btn`;
    const init = await h.ev(`(()=>{const b=document.querySelector(${JSON.stringify(btnSel)});return {ini:b.dataset.initial,name:locateVcNode(${JSON.stringify(uid)}).node.name}})()`);
    ok(init.ini && init.name.startsWith(init.ini), `[click] 無 icon 顯示首字 ${JSON.stringify(init)}`);
    const click = async sel => {
      const p = await h.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      for (const type of ['mousePressed', 'mouseReleased']) await h.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(300);
    };
    await click(btnSel);
    const n = await h.ev(`document.querySelectorAll('#vcIconPicker .vc-icon-grid button').length`);
    ok(n > 0, `[click] 點圓開 icon 選單（${n} 個）`);
    const want = await h.ev(`document.querySelectorAll('#vcIconPicker .vc-icon-grid button')[4].textContent`);
    await click('#vcIconPicker .vc-icon-grid button:nth-child(5)');
    const got = await h.ev(`(()=>{const b=document.querySelector(${JSON.stringify(btnSel)});return {icon:locateVcNode(${JSON.stringify(uid)}).node.icon,txt:b.textContent,empty:b.classList.contains('vc-icon-empty'),w:b.offsetWidth,open:!!document.getElementById('vcIconPicker')}})()`);
    ok(got.icon === want && got.txt === want && !got.empty && got.w === 48 && !got.open, `[click] 套用 icon ${JSON.stringify(got)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/click-applied.png`);
    ok(h.errors().length === 0, `[click] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}
// 800 寬
{
  const h = await launch({ width: 800, height: 900 });
  try {
    await fresh(h); await goChain(h); await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400); await setLayout(h, 'circle');
    const r = await h.ev(`(()=>{const u=document.querySelector('.vc-zone-primary .vc-group .vc-unit');const b=u.querySelector('.vc-icon-btn').getBoundingClientRect(),t=u.querySelector('textarea').getBoundingClientRect();
      return {dir:getComputedStyle(u.parentElement).flexDirection,w:b.width,side:t.left>=b.right-1&&t.top<b.bottom}})()`);
    ok(r.dir === 'column' && r.w === 48 && r.side, `[800] 直排、圓與名稱左右並排 ${JSON.stringify(r)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/800.png`);
    ok(h.errors().length === 0, `[800] console error 0`);
  } finally { await h.close(); }
}
console.log(fail ? `\n${fail} 項 FAIL` : '\n全部 PASS');
process.exit(fail ? 1 : 0);
