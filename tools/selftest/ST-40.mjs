// ST-40 自測：fold 全收合時相鄰收合群組間的連線不再是零長度。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-40.mjs   （需 Chrome；基準版取 git show dev:index.html；截圖 $CLAUDE_JOB_DIR/tmp/ST-40/）
// 測了什麼：
//   [a] bio-aesthetic 1400 切 fold（全收合）：.vc-link-main 條數＝兩端解析後矩形不同的連線數；每條長度 ≥ 8px、正交、端點離對應矩形邊 ≤ 5px（短線以交界為中心各延伸 4px）
//   [b] 展開「醫療服務」後連線重畫：條數＝矩形不同的連線數、長度 ≥ 8、正交
//   [c] 兩端落在同一收合群組（自建 vc：g1 內 b1→b2）不畫，但 links 清單仍在
//   [d] porter／band(800 寬)／band(1400) 的 path d 與基準版逐字相同（bio-aesthetic、兩範例）
//   [e] 兩 fixtures 與兩範例載入無 console error
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const base = tmpdir() + '/st40-base.html';
writeFileSync(base, execSync('git show dev:index.html', { cwd: root, maxBuffer: 1 << 28 }));
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-40'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const goChain = async h => { await h.ev(`guideGoto('chain'); 0`); await sleep(600); };
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
const check = `(()=>{
  const ps=[...document.querySelectorAll('#vcLineCanvas .vc-link-main')];
  const same=(a,b)=>a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
  const exp=valueChain.links.map(l=>({a:vcFoldEndRect(l.from),b:vcFoldEndRect(l.to)})).filter(o=>o.a&&o.b&&!same(o.a,o.b));
  const dist=(p,r)=>{const dx=Math.max(r.x-p.x,0,p.x-r.x-r.w),dy=Math.max(r.y-p.y,0,p.y-r.y-r.h);
    if(dx||dy) return Math.hypot(dx,dy); return Math.min(p.x-r.x,r.x+r.w-p.x,p.y-r.y,r.y+r.h-p.y);};
  const bad=[]; const lens=[];
  ps.forEach((p,i)=>{const n=(p.getAttribute('d').match(/-?\\d+(\\.\\d+)?/g)||[]).map(Number);const pts=[];for(let k=0;k<n.length;k+=2)pts.push({x:n[k],y:n[k+1]});
    let len=0,ortho=true;for(let k=1;k<pts.length;k++){const dx=Math.abs(pts[k].x-pts[k-1].x),dy=Math.abs(pts[k].y-pts[k-1].y);len+=dx+dy;if(dx>0.01&&dy>0.01)ortho=false;}
    lens.push(len);const o=exp[i];
    if(len<8||!ortho||!o||dist(pts[0],o.a)>5||dist(pts[pts.length-1],o.b)>5) bad.push({i,len,ortho,d:p.getAttribute('d')});});
  return {n:ps.length,exp:exp.length,links:valueChain.links.length,bad,lens};
})()`;
async function fresh(h, f) { await h.open(f); await h.ev('localStorage.clear(); 0'); await h.open(f); }

{
  const h = await launch();
  const dbg = []; 
  try {
    await fresh(h, html); await goChain(h);
    await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400);
    await setLayout(h, 'fold');
    const c = await h.ev(check);
    ok(c.n === c.exp && c.n === 2 && !c.bad.length, `[a] fold 全收合：畫 ${c.n}＝矩形不同 ${c.exp}（links ${c.links}），長度 ${c.lens}，不良 ${JSON.stringify(c.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/a-fold-collapsed.png`);
    const gMed = await h.ev(`(()=>{const g=[...document.querySelectorAll('.vc-zone-primary .vc-group')].find(g=>g.querySelector(':scope > .vc-node-head textarea').value==='醫療服務');return g.dataset.vcId})()`);
    await h.ev(`toggleVcFold(${JSON.stringify(gMed)}); 0`); await sleep(500);
    const c2 = await h.ev(check);
    ok(c2.n === c2.exp && !c2.bad.length, `[b] 展開醫療服務：畫 ${c2.n}＝${c2.exp}，長度 ${c2.lens}，不良 ${JSON.stringify(c2.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/b-fold-med-open.png`);
    // [c] 同一收合群組內
    await h.ev(`valueChain = normaliseValueChain({layout:'fold',primary:[{type:'group',name:'G1',children:[{type:'unit',name:'B1'},{type:'unit',name:'B2'}]},{type:'unit',name:'C'}],support:[],products:[],links:[]}); resetValueChainIds(valueChain); const ids=[]; (function w(l){l.forEach(n=>{ids.push(n.id); if(n.children) w(n.children)})})(valueChain.primary); valueChain.links=[{id:'x1',from:ids[1],to:ids[2]},{id:'x2',from:ids[1],to:ids[3]}]; commitValueChain(); vcFoldAll(false); 0`); await sleep(500);
    const c3 = await h.ev(check);
    ok(c3.links === 2 && c3.n === c3.exp && c3.n === 1 && !c3.bad.length, `[c] 同群組連線不畫、links 仍 ${c3.links}、畫 ${c3.n}/${c3.exp}、不良 ${JSON.stringify(c3.bad)}`);
    ok(h.errors().length === 0, `[a-c] 無 console error ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

const fixtures = ['bookstore-a', 'foundry-t'].map(id => [id, JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')))]);
async function collect(file, width) {
  const res = {}; const errs = [];
  const h = await launch({ width, height: 900 });
  await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file);
  const paths = () => h.ev(`[...document.querySelectorAll('#vcLineCanvas path.vc-link-main')].map(p=>p.getAttribute('d'))`);
  for (const [k, js] of [['tpl', `loadValueChainTemplate('bio-aesthetic')`], ['bookstore', `loadExampleProject('bookstore-a')`], ['foundry', `loadExampleProject('foundry-t')`]]) {
    await h.stubDialogs(); await h.ev(js + '; 0'); await sleep(300); await h.ev(`guideGoto('chain'); 0`); await sleep(300);
    for (const lay of ['porter', 'band']) { await setLayout(h, lay); res[k + ':' + lay] = await paths(); }
    await setLayout(h, 'porter');
  }
  errs.push(...h.errors()); await h.close();
  for (const [id, raw] of fixtures) {
    const f = await launch({ width, height: 900 });
    await f.open(file); await f.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
    await f.open(file); await sleep(500); await f.ev(`guideGoto('chain'); 0`); await sleep(600);
    res['fx:' + id] = await f.ev(`[...document.querySelectorAll('#vcLineCanvas path.vc-link-main')].map(p=>p.getAttribute('d'))`);
    errs.push(...f.errors()); await f.close();
  }
  return { res, errs };
}
for (const width of [1400, 800]) {
  const N = await collect(html, width), B = await collect(base, width);
  ok(!N.errs.length, `[e] ${width} 範例／fixtures 無 console error ${JSON.stringify(N.errs)}`);
  for (const k of Object.keys(B.res)) {
    const n = N.res[k] || [], b = B.res[k];
    ok(n.length === b.length && n.every((d, i) => d === b[i]), `[d ${width}] ${k} path d 與基準相同（${n.length}/${b.length}）`);
  }
}
console.log(fail ? `FAIL ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
