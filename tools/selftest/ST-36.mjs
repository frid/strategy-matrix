// ST-36 自測：橫帶系版型（band／segment／hex／fold）跨群組連線的繞行不壓到群組橫帶（vcLinkRoute 的 opts.bandAnc）
// 跑法（Node 24+、Chrome）：CLAUDE_JOB_DIR=... node tools/selftest/ST-36.mjs [基準 ref，預設 git merge-base HEAD dev]   截圖寫 $CLAUDE_JOB_DIR/tmp/ST-36/（每次覆寫，只來自本版 index.html）
// 規則：包住端點的祖先群組也算進列範圍 → 繞行的水平段走在祖先橫帶之外；只有進出端點的「第一段／最後一段」可穿過該端點的祖先橫帶。
// 測了什麼：
//   [A] bio-aesthetic 1400 × band／segment／hex／fold（預設收合）／fold 全展開：連線數＝links；每條 path 正交；起訖點在端點方塊邊上（容差 1px）；
//       每段都不與任何 `.vc-group > .vc-node-head` 矩形相交（容差 1px），例外：端點自身的 head（任何段）、
//       端點祖先群組的 head（只限貼著該端點的第一段／最後一段）；中間的水平段與所有 x 重疊的 head 上下至少相距 4px；另印出每條 path 供目視
//   [B] porter 不變：1400 與 800 寬、bio-aesthetic／兩範例／兩 fixtures 的 path d 與基準版逐字相同；800 寬 band（橫帶 CSS 不生效）也與基準相同
//   [C] PPTX：bio-aesthetic band／segment／hex／fold 匯出 slide1，連接器（價值鏈連線 N-k）同 [A] 規則不穿群組名橫帶（band/hex 的 rect 橫帶、segment 的群組名文字框）、全部正交；
//       porter 下兩範例與 bio-aesthetic 的 slide1 與基準版逐 byte 相同
//   [D] 全程（含兩 fixtures 載入）無 console error
//   截圖：$CLAUDE_JOB_DIR/tmp/ST-36/{band,segment,hex,fold,fold-open}.png
// 預期：全部 PASS、exit 0（基準版在 [A] band／hex／fold-open 的 診斷→中醫醫療服務 會壓到「醫療服務」橫帶）。
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { launch } from '../cdp-harness.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const newHtml = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-36'; mkdirSync(out + '/base', { recursive: true });
// 基準預設＝本分支與 dev 的分岔點（dev 之後前進時，直接比 dev 會混入別的任務的改動）
const baseRef = process.argv[2] || execSync('git merge-base HEAD dev', { cwd: root }).toString().trim().slice(0, 7);
const baseHtml = out + '/base/index.html';
writeFileSync(baseHtml, execSync(`git show ${baseRef}:index.html`, { cwd: root, maxBuffer: 64 << 20 }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const allPts = d => [...d.matchAll(/(-?[\d.]+(?:e-?\d+)?)[ ,]+(-?[\d.]+(?:e-?\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }));
// 原始折線＝起點 M、各圓角 Q 的控制點（轉角）、終點（vcRoundedPath 把轉角換成 Q）
const pts = d => { const p = allPts(d), q = [...d.matchAll(/Q\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)].map(m => ({ x: +m[1], y: +m[2] }));
  return [p[0], ...q, p[p.length - 1]].filter((v, i, a) => !i || v.x !== a[i - 1].x || v.y !== a[i - 1].y); };
const ortho = p => p.every((q, i) => !i || Math.abs(q.x - p[i - 1].x) <= 0.5 || Math.abs(q.y - p[i - 1].y) <= 0.5);
const cross = (a, b, o, t) => Math.max(a.x, b.x) > o.x + t && Math.min(a.x, b.x) < o.x + o.w - t && Math.max(a.y, b.y) > o.y + t && Math.min(a.y, b.y) < o.y + o.h - t;
const onEdge = (p, r, t) => p.x >= r.x - t && p.x <= r.x + r.w + t && p.y >= r.y - t && p.y <= r.y + r.h + t &&
  (Math.abs(p.x - r.x) <= t || Math.abs(p.x - r.x - r.w) <= t || Math.abs(p.y - r.y) <= t || Math.abs(p.y - r.y - r.h) <= t);
// 一條折線 vs 群組名橫帶：heads＝[{ id, r }]；anc：id → 祖先群組 id 陣列
function headHits(p, link, heads, anc, t) {
  const bad = [];
  for (let k = 1; k < p.length; k++) {
    const allow = new Set([link.from, link.to]);
    if (k === 1) anc[link.from].forEach(g => allow.add(g));
    if (k === p.length - 1) anc[link.to].forEach(g => allow.add(g));
    heads.forEach(h => { if (!allow.has(h.id) && cross(p[k - 1], p[k], h.r, t)) bad.push(h.name + '@段' + k); });
  }
  return bad;
}
const ANC_JS = `(()=>{const a={};const w=(l,up)=>l.forEach(n=>{a[n.id]=up;if(n.type==='group')w(n.children||[],up.concat([n.id]));});
  w(valueChain.primary,[]);w(valueChain.support,[]);w(valueChain.products,[]);return a;})()`;
const setLayout = async (h, lk) => { await h.ev(`valueChain.layout=${JSON.stringify(lk === 'fold-open' ? 'fold' : lk)}; renderValueChainEditor(); ${lk === 'fold-open' ? 'vcFoldAll(true);' : ''} 0`); await sleep(400); };

// ── [A] 畫面 ──
{
  const h = await launch({ width: 1400, height: 900 });
  await h.open(newHtml); await h.ev('localStorage.clear(); 0'); await h.open(newHtml);
  await h.ev(`loadValueChainTemplate('bio-aesthetic'); guideGoto('chain'); 0`); await sleep(500);
  for (const lk of ['band', 'segment', 'hex', 'fold', 'fold-open']) {
    await setLayout(h, lk);
    const r = await h.ev(`(()=>{
      const ed=document.getElementById('valueChainEditor');
      const nm=id=>{const e=ed.querySelector('[data-vc-id="'+id+'"]');const t=e&&e.querySelector('textarea,input');return t?t.value:id;};
      const heads=[...ed.querySelectorAll('.vc-group > .vc-node-head')].filter(e=>e.offsetWidth).map(e=>({id:e.parentElement.getAttribute('data-vc-id'),name:nm(e.parentElement.getAttribute('data-vc-id')),r:vcOffsetRect(e)}));
      const end=id=>vcLayoutKey(valueChain.layout)==='fold'?vcFoldEndRect(id):vcNodeRectForLayout(id);
      return {heads, anc:${ANC_JS}, ds:[...document.querySelectorAll('#vcLineCanvas path.vc-link-main')].map(p=>p.getAttribute('d')),
        links:valueChain.links.map(l=>({from:l.from,to:l.to,f:nm(l.from),t:nm(l.to),r1:end(l.from),r2:end(l.to)}))};
    })()`);
    ok(r.ds.length === r.links.length, `[A ${lk}] 連線 ${r.ds.length}/${r.links.length} 條`);
    r.ds.forEach((d, i) => {
      const L = r.links[i], p = pts(d);
      const bad = headHits(p, L, r.heads, r.anc, 1);
      // 中間的水平段離所有 x 重疊的 head 至少 4px（在橫帶上方 y ≤ top−4 或下方 y ≥ bottom+4）
      for (let k = 2; k < p.length - 1; k++) if (p[k - 1].y === p[k].y) {
        const y = p[k].y, lo = Math.min(p[k - 1].x, p[k].x), hi = Math.max(p[k - 1].x, p[k].x);
        r.heads.forEach(hd => { if (hd.r.x < hi && hd.r.x + hd.r.w > lo && y > hd.r.y - 4 && y < hd.r.y + hd.r.h + 4) bad.push(`${hd.name}@段${k} y=${y} head ${hd.r.y}–${hd.r.y + hd.r.h}`); });
      }
      const edge = onEdge(p[0], L.r1, 1) && onEdge(p[p.length - 1], L.r2, 1);
      ok(ortho(p) && edge && !bad.length, `[A ${lk}] ${L.f}→${L.t}：正交 ${ortho(p)}、端點在方塊邊 ${edge}、壓到橫帶 ${bad.length ? bad.join(',') : '無'}`);
      console.log('     ' + d);
    });
    await h.shot('#valueChainEditor', `${out}/${lk}.png`);
  }
  ok(!h.errors().length, `[D] [A] console error 0 ${JSON.stringify(h.errors())}`);
  await h.close();
}

// ── [B] porter（與 800 寬 band）畫面路線與基準相同 ──
const fixtures = ['bookstore-a', 'foundry-t'].map(id => [id, JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')))]);
async function collect(file, width) {
  const res = {}; let errs = [];
  const h = await launch({ width, height: 900 });
  await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file);
  const paths = () => h.ev(`[...document.querySelectorAll('#vcLineCanvas path.vc-link-main')].map(p=>p.getAttribute('d'))`);
  for (const [k, js] of [['tpl:bio-aesthetic', `loadValueChainTemplate('bio-aesthetic')`], ['ex:bookstore-a', `loadExampleProject('bookstore-a')`], ['ex:foundry-t', `loadExampleProject('foundry-t')`]]) {
    await h.stubDialogs(); await h.ev(js + '; 0'); await sleep(300); await h.ev(`guideGoto('chain'); 0`); await sleep(300);
    await setLayout(h, 'porter'); res[k] = await paths();
    if (width <= 800 && k === 'tpl:bio-aesthetic') { await setLayout(h, 'band'); res[k + ':band'] = await paths(); await setLayout(h, 'porter'); }
  }
  errs = errs.concat(h.errors()); await h.close();
  for (const [id, raw] of fixtures) {
    const f = await launch({ width, height: 900 });
    await f.open(file); await f.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
    await f.open(file); await sleep(500); await f.ev(`guideGoto('chain'); 0`); await sleep(600);
    res['fx:' + id] = await f.ev(`[...document.querySelectorAll('#vcLineCanvas path.vc-link-main')].map(p=>p.getAttribute('d'))`);
    errs = errs.concat(f.errors()); await f.close();
  }
  return { res, errs };
}
for (const width of [1400, 800]) {
  const N = await collect(newHtml, width), B = await collect(baseHtml, width);
  ok(!N.errs.length, `[D] [B ${width}] 範例／fixtures 載入無 console error ${JSON.stringify(N.errs)}`);
  for (const k of Object.keys(B.res)) {
    const n = N.res[k] || [], b = B.res[k];
    const eq = n.length === b.length && n.every((d, i) => d === b[i]);
    ok(eq, `[B ${width}] ${k} path d 與 ${baseRef} 相同（${n.length}/${b.length} 條）${eq ? "" : "\n       新 " + JSON.stringify(n) + "\n       基準 " + JSON.stringify(b)}`);
  }
}

// ── [C] PPTX ──
async function bootPptx(file) {
  const h = await launch({ width: 1400, height: 900 });
  await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file);
  await h.ev(`HTMLAnchorElement.prototype.click=function(){}; const g=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g.apply(this,a);}; 0`);
  return h;
}
async function slide1(h, js, lk) {
  await h.stubDialogs(); await h.ev(js + '; 0'); await sleep(400);
  await h.ev(`valueChain.layout=${JSON.stringify(lk)}; 0`); await sleep(100);
  await h.ev(`window.__zip=null; window.__err=null; try{exportPptx()}catch(e){window.__err=String(e)} 0`);
  for (let i = 0; i < 40 && !(await h.ev('!!window.__zip||!!window.__err')); i++) await sleep(150);
  await sleep(300);
  return h.ev(`(async()=>({err:window.__err, xml: window.__zip ? await window.__zip.file('ppt/slides/slide1.xml').async('string') : '',
    anc:${ANC_JS}, groups:(()=>{const g={};const w=l=>l.forEach(n=>{if(n.type==='group'){g[n.id]=n.name||'（未命名）';w(n.children||[]);}});w(valueChain.primary);return g;})(),
    links:valueChain.links.map(l=>({from:l.from,to:l.to}))}))()`);
}
const unesc = t => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const BIO = `loadValueChainTemplate('bio-aesthetic')`;
{
  const h = await bootPptx(newHtml);
  for (const lk of ['band', 'segment', 'hex', 'fold']) {
    const r = await slide1(h, BIO, lk);
    ok(!r.err && r.xml, `[C ${lk}] exportPptx 不拋例外 ${r.err || ''}`);
    if (!r.xml) continue;
    const shapes = [...r.xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
      const s = m[0], o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/);
      return { kind: m[1], name: unesc((s.match(/name="([^"]*)"/) || [])[1] || ''), prst: (s.match(/prst="(\w+)"/) || [])[1],
        x: +o[1], y: +o[2], w: +o[3], h: +o[4], fh: /flipH="1"/.test(s), fv: /flipV="1"/.test(s) };
    });
    // 群組名橫帶：名稱＝群組名的 rect（band/hex 橫帶、segment 文字框）；同名群組全部對應
    const byName = {}; Object.entries(r.groups).forEach(([id, n]) => (byName[n] = byName[n] || []).push(id));
    const heads = shapes.filter(s => s.kind === 'sp' && s.prst === 'rect' && byName[s.name]).flatMap(s => byName[s.name].map(id => ({ id, name: s.name, r: s })));
    let nBad = 0, nDiag = 0, msgs = [];
    r.links.forEach((L, i) => {
      const segs = shapes.filter(s => s.kind === 'cxnSp' && new RegExp(`^價值鏈連線 ${i + 1}(-\\d+)?$`).test(s.name));
      const p = [];
      segs.forEach(s => { const a = { x: s.fh ? s.x + s.w : s.x, y: s.fv ? s.y + s.h : s.y }, b = { x: s.fh ? s.x : s.x + s.w, y: s.fv ? s.y : s.y + s.h };
        if (!p.length) p.push(a); p.push(b); if (s.w && s.h) nDiag++; });
      const bad = headHits(p, L, heads, r.anc, 9144);  // 容差 0.01"
      if (bad.length) { nBad++; msgs.push(`${i + 1}:${bad.join(',')}`); }
    });
    ok(heads.length > 0 && nBad === 0 && nDiag === 0, `[C ${lk}] slide1 群組橫帶 ${heads.length} 個、連接器壓到橫帶 ${nBad} 條${msgs.length ? '（' + msgs.join('；') + '）' : ''}、斜線 ${nDiag}`);
  }
  const porterNew = [];
  for (const js of [BIO, `loadExampleProject('bookstore-a')`, `loadExampleProject('foundry-t')`]) porterNew.push([js, (await slide1(h, js, 'porter')).xml]);
  ok(!h.errors().length, `[D] [C] console error 0 ${JSON.stringify(h.errors())}`);
  await h.close();
  const hb = await bootPptx(baseHtml);
  for (const [js, xml] of porterNew) {
    const b = (await slide1(hb, js, 'porter')).xml;
    ok(xml && xml === b, `[C porter] ${js} slide1 與 ${baseRef} 逐 byte 相同（${xml.length}/${b.length}）`);
  }
  await hb.close();
}
console.log('截圖：' + out);
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
