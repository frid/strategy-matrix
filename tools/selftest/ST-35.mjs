// ST-35j 總自測：價值鏈六版型（porter／band／fold／segment／circle／hex）＋三套分色配色＋icon 的整合檢查。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35/）
// 測了什麼（bio-aesthetic 範本，給 3 個主要活動葉節點 icon）：
//   [a] 六版型各切一次：無 console error；#vcLineCanvas .vc-link-main 條數＝可見連線數（fold 用收合群組端點、同矩形者不畫），
//       每條 path 起訖點落在對應端點矩形邊上（circle 的葉節點用圓）；各截圖一張 <layout>.png
//   [b] 三套分色配色（COLOR_PALETTES 中有 perUnit 者，索引 6–8）× band／segment／hex：主要活動葉節點白字對 inline 底色 WCAG 對比 ≥ 4.5
//   [c] exportPptx 六版型都不拋例外
//   [d] 切回 porter 與配色 0 後，價值鏈 DOM（去 svg）與初始相同
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const LAYOUTS = ['porter', 'band', 'fold', 'segment', 'circle', 'hex'];
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.getElementById('vcLayoutSelect');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(600); };
const setPalette = async (h, i) => { await h.ev(`(()=>{const s=document.getElementById('paletteSelect');s.value=String(${i});s.dispatchEvent(new Event('change'));})(); 0`); await sleep(400); };
const domSig = h => h.ev(`(()=>{const c=document.getElementById('valueChainEditor').cloneNode(true);c.querySelectorAll('svg').forEach(s=>s.remove());return c.innerHTML})()`);
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// computed 色可能是 rgb(…) 或 color(srgb 0~1 …)（color-mix 結果）
const rgb = s => { const v = (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /^color\(srgb/.test(s) ? v.map(x => x * 255) : v; };

const linkCheck = `(()=>{
  const lay=vcLayoutKey(valueChain.layout);
  const rectOf=id=>lay==='fold'?vcFoldEndRect(id):lay==='circle'?vcNodeRectForLayout(id):getVcNodeRect(id);
  const isLeaf=id=>!!document.querySelector('.vc-zone-primary .vc-unit[data-vc-id="'+id+'"]');
  const same=(a,b)=>a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
  const exp=valueChain.links.map(l=>({l,a:rectOf(l.from),b:rectOf(l.to)})).filter(o=>o.a&&o.b&&!same(o.a,o.b));
  const onEdge=(p,r,t=3)=>p.x>=r.x-t&&p.x<=r.x+r.w+t&&p.y>=r.y-t&&p.y<=r.y+r.h+t&&(Math.abs(p.x-r.x)<=t||Math.abs(p.x-r.x-r.w)<=t||Math.abs(p.y-r.y)<=t||Math.abs(p.y-r.y-r.h)<=t);
  const onCircle=(p,r,t=3)=>Math.abs(Math.hypot(p.x-(r.x+r.w/2),p.y-(r.y+r.h/2))-r.w/2)<=t;
  const good=(p,id,r)=>(lay==='circle'&&isLeaf(id))?onCircle(p,r):onEdge(p,r);
  const ps=[...document.querySelectorAll('#vcLineCanvas .vc-link-main')];
  const bad=[];
  ps.forEach((p,i)=>{const d=p.getAttribute('d')||'';const n=(d.match(/-?\\d+(\\.\\d+)?/g)||[]).map(Number);
    const s={x:n[0],y:n[1]},e={x:n[n.length-2],y:n[n.length-1]},o=exp[i];
    if(/NaN/.test(d)||!o||!good(s,o.l.from,o.a)||!good(e,o.l.to,o.b)) bad.push({i,d:d.slice(0,80)});});
  return {n:ps.length,exp:exp.length,links:valueChain.links.length,bad};
})()`;
const leafProbe = `[...document.querySelectorAll('#valueChainEditor .vc-zone-primary .vc-unit:not(.vc-asset)')].filter(u=>u.offsetWidth).map(u=>{
  const cs=getComputedStyle(u);return {bg:cs.backgroundColor,fg:getComputedStyle(u.querySelector('textarea')).color,name:u.querySelector('textarea').value}})`;

const h = await launch({ width: 1400, height: 900 });
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.ev(`guideGoto('chain'); 0`); await sleep(600);
  await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(500);
  // 給 3 個主要活動葉節點 icon
  const icons = ['🩺', '💉', '✨'];
  const n = await h.ev(`(()=>{const L=[];const w=l=>l.forEach(x=>{if(x.type==='group')w(x.children);else if(x.type!=='asset'&&x.kind!=='asset')L.push(x)});w(valueChain.primary);
    ${JSON.stringify(icons)}.forEach((ic,i)=>{if(L[i*2])L[i*2].icon=ic});commitValueChain();return L.filter(x=>x.icon).length})()`);
  await sleep(500);
  ok(n === 3, `[0] 給了 3 個 icon（${n}）`);
  const initSig = await domSig(h);

  // [a]
  for (const L of LAYOUTS) {
    await setLayout(h, L);
    const lc = await h.ev(linkCheck);
    ok(h.errors().length === 0 && (await h.ev('valueChain.layout')) === L, `[a] ${L} 無 error、layout 正確 ${JSON.stringify(h.errors())}`);
    ok(lc.links > 0 && lc.n === lc.exp && !lc.bad.length, `[a] ${L} 連線 path ${lc.n}＝可見 ${lc.exp}（總 ${lc.links}）、端點在邊上 ${JSON.stringify(lc.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/${L}.png`);
  }

  // [b]
  const perIdx = await h.ev(`COLOR_PALETTES.map((p,i)=>p.perUnit?i:-1).filter(i=>i>=0)`);
  ok(JSON.stringify(perIdx) === '[6,7,8]', `[b] 分色配色索引 ${perIdx}`);
  for (const L of ['band', 'segment', 'hex']) {
    await setLayout(h, L);
    for (const pi of perIdx) {
      await setPalette(h, pi);
      const leaves = await h.ev(leafProbe);
      const rows = leaves.map(l => ({ name: l.name, c: cr(rgb(l.bg), rgb(l.fg)), bg: l.bg, fg: l.fg }));
      const bad = rows.filter(r => !(r.c >= 4.5) || /\b0\)$/.test(r.bg));
      const min = Math.min(...rows.map(r => r.c));
      ok(rows.length >= 10 && !bad.length, `[b] ${L} × 配色${pi} 葉節點 ${rows.length} 個白字對比最低 ${min.toFixed(2)} ${JSON.stringify(bad.slice(0, 3))}`);
      if (pi === perIdx[0]) await h.shot('#valueChainEditor .vc-zones', `${out}/${L}-perunit${pi}.png`);
    }
  }
  await setPalette(h, 0);

  // [c]
  await h.captureDownloads();
  for (const L of LAYOUTS) {
    await setLayout(h, L);
    const err = await h.ev(`(async()=>{try{await exportPptx();return ''}catch(e){return String(e&&e.stack||e)}})()`);
    ok(!err, `[c] exportPptx ${L} 不拋例外 ${err.slice(0, 120)}`);
  }

  // [d]
  await setLayout(h, 'porter'); await setPalette(h, 0);
  const back = await domSig(h);
  ok(back === initSig, `[d] 切回 porter＋配色0 DOM 與初始相同（${initSig.length}/${back.length}）`);
  ok(h.errors().length === 0, `[all] console error 0 ${JSON.stringify(h.errors())}`);
} finally { await h.close(); }
console.log(fail ? `FAIL ×${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
