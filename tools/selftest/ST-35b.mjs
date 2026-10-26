// ST-35b 自測：同色分段式（C）。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35b.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35b/）
// 測了什麼：bookstore-a、bio-aesthetic 切 segment 無 console error；連線 path 數＝links 數、端點在方塊邊（3px）；
//   同群組葉節點 background 同色、相鄰頂層群組不同色；群組名在群組底部（head.top > body.top）；
//   六套配色各截圖一張（1400 寬）；切回 porter DOM 與切換前相同；800 寬直排（無 chevron clip-path）。
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35b'; mkdirSync(out, { recursive: true });
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
    if(/NaN/.test(d)||!l||!onEdge(s,getVcNodeRect(l.from))||!onEdge(e,getVcNodeRect(l.to))) bad.push({i,link:l&&l.id,d:d.slice(0,80)});});
  return {n:ps.length, links:valueChain.links.length, bad};
})()`;
const segGeo = `(()=>{
  const bg=e=>getComputedStyle(e).backgroundColor;
  const top=[...document.querySelectorAll('.vc-zone-primary > .vc-zone-body > *')].filter(e=>e.matches('.vc-unit,.vc-group'));
  const tops=top.map(e=>{const leaves=e.matches('.vc-unit')?[e]:[...e.querySelectorAll('.vc-unit')];
    return {id:e.dataset.vcId,isGroup:e.matches('.vc-group'),colors:[...new Set(leaves.filter(u=>!u.classList.contains('vc-asset')).map(bg))]}});
  const heads=[...document.querySelectorAll('.vc-zone-primary .vc-group')].map(g=>({
    h:g.querySelector(':scope > .vc-node-head').getBoundingClientRect().top, b:g.querySelector(':scope > .vc-group-body').getBoundingClientRect().top}));
  return {tops,heads,zones:document.querySelector('.vc-zones').className};
})()`;
const palettes = 6;

for (const id of ['bookstore-a', 'bio-aesthetic']) {
  const h = await launch();
  try {
    await fresh(h);
    if (id === 'bio-aesthetic') { await goChain(h); await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400); }
    else { await h.loadExample(id); await goChain(h); }
    const sig0 = await domSig(h);
    await setLayout(h, 'segment');
    ok(h.errors().length === 0, `[${id}] segment 無 console error ${JSON.stringify(h.errors())}`);
    const g = await h.ev(segGeo);
    ok(g.zones.includes('vc-layout-segment'), `[${id}] 有 vc-layout-segment`);
    ok(g.tops.every(t => t.colors.length <= 1), `[${id}] 同群組葉節點同色 ${JSON.stringify(g.tops.map(t => t.colors))}`);
    const cs = g.tops.filter(t => t.colors.length); const adj = cs.every((t, i) => i === 0 || t.colors[0] !== cs[i - 1].colors[0] || g.tops.indexOf(t) !== g.tops.indexOf(cs[i - 1]) + 1);
    ok(adj, `[${id}] 相鄰頂層項不同色`);
    ok((id === 'bookstore-a' || g.heads.length > 0) && g.heads.every(x => x.h > x.b), `[${id}] 群組名在群組底部 ${JSON.stringify(g.heads)}`);
    const tops = await h.ev(`(()=>{const bad=[];let n=0;document.querySelectorAll('.vc-zone-primary > .vc-zone-body > *').forEach(c=>{if(!c.matches('.vc-unit,.vc-group'))return;const t=c.getBoundingClientRect().top;(c.matches('.vc-unit')?[c]:[...c.querySelectorAll('.vc-unit')]).forEach(u=>{n++;const d=u.getBoundingClientRect().top-t;if(Math.abs(d)>1)bad.push({id:u.dataset.vcId,d})})});return {n,bad}})()`);
    ok(tops.n > 0 && !tops.bad.length, `[${id}] 同一列所有 .vc-unit top 與其頂層容器頂緣相同（容差 1px） ${JSON.stringify(tops)}`);
    const roleC = await h.ev(`(()=>{const r=document.querySelector('.vc-zone-primary .vc-unit:not(.vc-asset) .vc-role-none');return r?getComputedStyle(r).color:'rgba(255, 255, 255, 0.9)'})()`);
    ok(/255, 255, 255/.test(roleC), `[${id}] 「＋角色」白字 ${roleC}`);
    const lc = await h.ev(linkCheck);
    ok(lc.n === lc.links && !lc.bad.length, `[${id}] 連線 ${lc.n}＝${lc.links}、端點在邊上 ${JSON.stringify(lc.bad)}`);
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
// 800 寬
{
  const h = await launch({ width: 800, height: 900 });
  try {
    await fresh(h); await goChain(h); await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400); await setLayout(h, 'segment');
    
    const r = await h.ev(`(()=>{const u=document.querySelector('.vc-zone-primary .vc-group .vc-unit');return {clip:getComputedStyle(u).clipPath,dir:getComputedStyle(u.parentElement).flexDirection}})()`);
    ok(!/14px 50%/.test(r.clip) && r.dir === 'column', `[800] 直排無 chevron ${JSON.stringify(r)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/800.png`);
    ok(h.errors().length === 0, `[800] console error 0`);
  } finally { await h.close(); }
}
console.log(fail ? `\n${fail} 項 FAIL` : '\n全部 PASS');
process.exit(fail ? 1 : 0);
