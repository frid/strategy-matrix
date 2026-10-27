// ST-43 自測：價值鏈產品＝每個產品一條直立長條、左右並排、名稱直書；線從長條底邊中點進出（網頁＋PPTX slide1）。
// 跑法：node tools/selftest/ST-43.mjs   （需 Chrome；截圖寫 tools/selftest/out/ST-43-{porter,band}.png，slide1 SVG 示意 ST-43-pptx-<情境>.svg）
// 測了什麼：
//   [web] 1400 寬，情境 bookstore-a fixture（3 產品、1 條到產品的線）與醫美範本＋壓力連線（活動→各產品、產品→相鄰產品、產品→不相鄰產品），
//         六版型（porter／band／segment／hex／circle／fold）各跑：產品方塊數＝產品數、由左至右 x 遞增不重疊、每條寬 ≤ 60px、
//         高 ≥ 主要活動列高、名稱 textarea 與方塊 writing-mode=vertical-rl、名稱未裁字；
//         到產品的線（spy vcLinkRoute）：活動↔產品最後一段垂直向上、終點在長條底邊中點 ±4px；相鄰產品→產品是一條水平線；
//         所有段正交、不穿過非端點的產品長條與活動方塊（不含端點祖先群組，以及與端點外框重疊的方塊——hex 蜂巢錯位，dev 同寬即如此）；console error 0
//   [700] 700 寬：產品維持橫排 200px 方塊（writing-mode horizontal-tb）
//   [pptx] 同兩情境（porter）攔 JSZip 取 slide1.xml：產品 roundRect 數＝產品數、x 遞增不重疊、y 相同、cy≈Margin cy − 0.14"、含 vert="eaVert"、
//         都在 Margin 右側、右緣 ≤ slide 寬；到產品的 connector 最後一段垂直、終點在長條底邊中點；slide2 之後的 XML 與 index.html@dev（git show）相同
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const html = root + '/index.html';
const outDir = resolve(here, 'out'); mkdirSync(outDir, { recursive: true });
const tmp = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st43'; mkdirSync(tmp, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const EMU = 914400, SLIDE_W = 9144000;
const fixture = JSON.stringify(JSON.parse(readFileSync(root + '/tests/fixtures/strategyMatrix_v4-bookstore-a.json', 'utf8')));
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };

// 醫美範本加壓力連線：活動→每個產品、產品→相鄰產品、產品→不相鄰產品
const stress = `(()=>{const nm={};const w=l=>l.forEach(n=>{nm[n.name]=nm[n.name]||n.id;if(n.children)w(n.children)});
  w(valueChain.primary);w(valueChain.support);const P=valueChain.products.filter(n=>n.type==='unit');
  const acts=['中醫門診','點滴','公關接待','資訊系統'].map(n=>nm[n]).filter(Boolean);
  P.forEach((p,i)=>{ if(acts[i%acts.length]) valueChain.links.push({id:genNodeId(vcUsedIds),from:acts[i%acts.length],to:p.id}); });
  if(P.length>1) valueChain.links.push({id:genNodeId(vcUsedIds),from:P[0].id,to:P[1].id});
  if(P.length>2) valueChain.links.push({id:genNodeId(vcUsedIds),from:P[0].id,to:P[P.length-1].id});
  commitValueChain(); return P.length;})()`;

// 網頁幾何＋路線檢查（在頁內做）
const webCheck = `(()=>{
  const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}};
  const units=[...document.querySelectorAll('.vc-products-body > .vc-unit')];
  const act=document.querySelector('.vc-activities-row');
  const g=units.map(u=>{const ta=u.querySelector('textarea.vc-name-wrap');return {...R(u),wm:getComputedStyle(u).writingMode,twm:ta&&getComputedStyle(ta).writingMode,
    clip: ta ? (ta.scrollHeight>ta.clientHeight+1||ta.scrollWidth>ta.clientWidth+1) : true}});
  const orig=vcLinkRoute; const bad=[]; let nProd=0, nAdj=0, nUp=0;
  vcLinkRoute=function(r1,r2,rects,opts,rowUse){const rt=orig(r1,r2,rects,opts,rowUse);const P=opts.product;
    if(P&&!P.horizontal&&(P.rects.has(r1)||P.rects.has(r2))){nProd++;const pts=rt.pts;
      const tag=(r1.x|0)+','+(r1.y|0)+'→'+(r2.x|0)+','+(r2.y|0);
      if(!pts.every((p,i)=>!i||Math.abs(p.x-pts[i-1].x)<0.01||Math.abs(p.y-pts[i-1].y)<0.01)) bad.push('非正交 '+tag);
      const both=P.rects.has(r1)&&P.rects.has(r2);
      if(both&&pts.length===2){nAdj++; if(Math.abs(pts[0].y-pts[1].y)>0.01) bad.push('相鄰產品非水平 '+tag);}
      else {
        // 產品端（to 產品：最後一點；from 產品：第一點）
        const ends=[]; if(P.rects.has(r2)) ends.push([r2,pts[pts.length-1],pts[pts.length-2]]); if(P.rects.has(r1)) ends.push([r1,pts[0],pts[1]]);
        ends.forEach(([r,e,pr])=>{ nUp++;
          if(Math.abs(e.x-(r.x+r.w/2))>4||Math.abs(e.y-(r.y+r.h))>4) bad.push('終點不在底邊中點 '+tag+' '+JSON.stringify(e));
          if(!(Math.abs(pr.x-e.x)<0.01&&pr.y>e.y)) bad.push('最後一段非垂直向上 '+tag); });
      }
      const contains=(o,r)=>o.x<=r.x&&o.y<=r.y&&o.x+o.w>=r.x+r.w&&o.y+o.h>=r.y+r.h;
      // 與端點本身重疊的方塊不算（六角鏈 hex 的蜂巢錯位讓相鄰群組外框蓋到端點，dev 版在同寬時就會穿過，與產品欄無關）
      const ov=(o,r)=>o.x<r.x+r.w&&o.x+o.w>r.x&&o.y<r.y+r.h&&o.y+o.h>r.y;
      const others=rects.filter(o=>o!==r1&&o!==r2&&!contains(o,r1)&&!contains(o,r2)&&!ov(o,r1)&&!ov(o,r2));
      for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];
        const o=others.find(o=>Math.max(a.x,b.x)>o.x+2&&Math.min(a.x,b.x)<o.x+o.w-2&&Math.max(a.y,b.y)>o.y+2&&Math.min(a.y,b.y)<o.y+o.h-2);
        if(o) bad.push('穿過方塊 '+tag+' 段'+i+(P.rects.has(o)?'（產品）':''));}
    }
    return rt;};
  try{drawVcLinks();}finally{vcLinkRoute=orig;}
  const ds=[...document.querySelectorAll('#vcLineCanvas path')].map(p=>p.getAttribute('d')||'');
  return {g,actH:act?act.getBoundingClientRect().height:0,n:valueChain.products.filter(n=>n.type==='unit').length,bad,nProd,nAdj,nUp,nan:ds.some(d=>/NaN/.test(d))};
})()`;

function judgeWeb(tag, r) {
  const g = r.g;
  ok(g.length === r.n && r.n > 0, `[${tag}] 產品長條 ${g.length}＝產品數 ${r.n}`);
  ok(g.every((u, i) => !i || u.l >= g[i - 1].r - 0.5), `[${tag}] 由左至右不重疊（l：${g.map(u => Math.round(u.l)).join(',')}）`);
  ok(g.every(u => u.w <= 60), `[${tag}] 每條寬 ≤ 60px（${g.map(u => Math.round(u.w)).join(',')}）`);
  ok(g.every(u => u.h >= r.actH - 1), `[${tag}] 高 ≥ 主要活動列高 ${Math.round(r.actH)}（${g.map(u => Math.round(u.h)).join(',')}）`);
  ok(g.every(u => u.wm === 'vertical-rl' && u.twm === 'vertical-rl'), `[${tag}] 方塊與名稱 writing-mode=vertical-rl`);
  ok(g.every(u => !u.clip), `[${tag}] 名稱未裁字`);
  ok(r.nProd > 0 && !r.bad.length && !r.nan, `[${tag}] 產品連線 ${r.nProd} 條（底邊進出 ${r.nUp}、相鄰水平 ${r.nAdj}）規則全符合 ${r.bad.slice(0, 6).join(' | ')}`);
}

const parse = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
  const s = m[0], o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/) || [];
  return { kind: m[1], name: (s.match(/name="([^"]*)"/) || [])[1], x: +o[1], y: +o[2], w: +o[3], h: +o[4], raw: s,
    flipH: /flipH="1"/.test(s), flipV: /flipV="1"/.test(s), arrow: /tailEnd type="triangle"|headEnd type="triangle"/.test(s), head: /headEnd type="triangle"/.test(s) };
});
function svgOf(sh) {
  const E = 800 / SLIDE_W;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.round(5143500 * E)}" style="background:#fff">` + sh.map(s => {
    const x = s.x * E, y = s.y * E, w = s.w * E, h = s.h * E;
    if (s.kind === 'cxnSp') { const [x1, x2] = s.flipH ? [x + w, x] : [x, x + w], [y1, y2] = s.flipV ? [y + h, y] : [y, y + h]; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5A4FCF"/>`; }
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ddd" fill-opacity=".5" stroke="#999" stroke-width=".5"/>`;
  }).join('\n') + '</svg>';
}
async function slides(h) {
  await h.ev(`window.__zip=null; window.__err=null; try{exportPptx()}catch(e){window.__err=String(e)} 0`);
  for (let i = 0; i < 50 && !(await h.ev('!!window.__zip')); i++) await sleep(200);
  await sleep(300);
  return h.ev(`(async()=>{const z=window.__zip;if(!z) return {err:window.__err};const o={err:window.__err};for(const n of Object.keys(z.files).filter(n=>/^ppt\\/slides\\/slide\\d+\\.xml$/.test(n))) o[n]=await z.file(n).async('string');return o;})()`);
}
function judgePptx(tag, xml, names) {
  const sh = parse(xml), sp = sh.filter(s => s.kind === 'sp'), cx = sh.filter(s => s.kind === 'cxnSp');
  const margin = sp.find(s => s.name === 'Margin／利潤');
  const prods = names.map(n => sp.filter(s => s.name === n && /prst="roundRect"/.test(s.raw)).sort((a, b) => b.x - a.x)[0]);
  console.log(`INFO [${tag}] 產品 ${prods.map(p => p ? `${p.name} x=${(p.x / EMU).toFixed(3)} w=${(p.w / EMU).toFixed(3)} h=${(p.h / EMU).toFixed(3)}` : '缺').join(' / ')}；Margin ${margin ? `x=${(margin.x / EMU).toFixed(3)} h=${(margin.h / EMU).toFixed(3)}` : '無'}`);
  ok(prods.every(Boolean) && prods.length === names.length, `[${tag}] 產品 roundRect ${prods.filter(Boolean).length}＝產品數 ${names.length}`);
  if (!prods.every(Boolean)) return;
  ok(prods.every((p, i) => !i || p.x >= prods[i - 1].x + prods[i - 1].w) && prods.every(p => p.y === prods[0].y), `[${tag}] x 遞增不重疊、y 相同`);
  ok(prods.every(p => /vert="eaVert"/.test(p.raw)), `[${tag}] 產品皆 vert="eaVert"`);
  ok(prods.every(p => p.w <= Math.round(0.42 * EMU) + 2 && p.h > p.w * 3), `[${tag}] 直立長條（寬 ≤ 0.42"、高 > 3×寬）`);
  if (margin) {
    ok(Math.abs(prods[0].h - (margin.h - Math.round(0.14 * EMU))) <= 2 && prods[0].y === margin.y, `[${tag}] 長條頂＝Margin 頂、高＝Margin 高 − 0.14"`);
    ok(prods.every(p => p.x >= margin.x + margin.w), `[${tag}] 產品都在 Margin 右側`);
  }
  ok(prods.every(p => p.x + p.w <= SLIDE_W), `[${tag}] 產品右緣 ≤ slide 寬`);
  // 到產品的 connector：帶箭頭那段（最後一段）垂直、終點在某條長條底邊中點
  const ends = cx.filter(c => c.arrow).map(c => {
    const [x1, x2] = c.flipH ? [c.x + c.w, c.x] : [c.x, c.x + c.w], [y1, y2] = c.flipV ? [c.y + c.h, c.y] : [c.y, c.y + c.h];
    return c.head ? { x: x1, y: y1, px: x2, py: y2 } : { x: x2, y: y2, px: x1, py: y1 };
  });
  const toProd = ends.filter(e => prods.some(p => e.x >= p.x - 2 && e.x <= p.x + p.w + 2 && Math.abs(e.y - (p.y + p.h)) <= Math.round(0.05 * EMU)));
  const badEnd = toProd.filter(e => { const p = prods.find(p => e.x >= p.x - 2 && e.x <= p.x + p.w + 2); return Math.abs(e.x - (p.x + p.w / 2)) > 4000 || e.px !== e.x || e.py <= e.y; });
  ok(!badEnd.length, `[${tag}] 到產品的線 ${toProd.length} 條：最後一段垂直向上、終點在長條底邊中點（不符 ${badEnd.length}）`);
  ok(cx.every(c => c.w === 0 || c.h === 0), `[${tag}] 所有 connector 正交`);
  ok(cx.every(c => !prods.some(p => { const x1 = c.x, x2 = c.x + c.w, y1 = c.y, y2 = c.y + c.h; return x2 > p.x + 2 && x1 < p.x + p.w - 2 && y2 > p.y + 2 && y1 < p.y + p.h - 2; })), `[${tag}] connector 不穿過產品長條`);
  writeFileSync(`${outDir}/ST-43-pptx-${tag}.svg`, svgOf(sh));
}

// dev 版 index.html 當 slide2+ 的基準
const devHtml = tmp + '/index-dev.html';
writeFileSync(devHtml, execSync('git show dev:index.html', { cwd: root, maxBuffer: 64 << 20 }));

const h = await launch({ width: 1400, height: 1000 });
const hook = `HTMLAnchorElement.prototype.click=function(){}; const g=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g.apply(this,a);}; 0`;
const scen = {};
try {
  for (const [key, file] of [['new', html], ['dev', devHtml]]) {
    scen[key] = {};
    // 情境 1：bookstore-a fixture
    await h.open(file); await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(fixture)}); 0`);
    await h.send('Page.reload'); await sleep(1500); await h.stubDialogs();
    await h.ev(`guideGoto('chain'); 0`); await sleep(500);
    await h.ev(hook);
    if (key === 'new') {
      ok(!h.errors().length, `[bookstore-a] 載入 fixture 無 console error ${h.errors().join(' | ')}`);
      for (const lay of ['porter', 'band', 'segment', 'hex', 'circle', 'fold']) {
        await setLayout(h, lay);
        judgeWeb('bookstore-a/' + lay, await h.ev(webCheck));
        if (lay === 'porter') await h.shot('#valueChainEditor .vc-zones', outDir + '/ST-43-porter.png');
      }
      await setLayout(h, 'porter');
    }
    scen[key].book = { s: await slides(h), names: await h.ev(`valueChain.products.filter(n=>n.type==='unit').map(n=>n.name)`) };
    // 情境 2：醫美範本＋壓力連線
    await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file);
    await h.ev(`guideGoto('chain'); loadValueChainTemplate('bio-aesthetic'); valueChain.showArrowBg=true; 0`); await sleep(500);
    await h.ev(stress); await sleep(400);
    await h.ev(hook);
    if (key === 'new') {
      for (const lay of ['porter', 'band', 'segment', 'hex', 'circle', 'fold']) {
        await setLayout(h, lay);
        judgeWeb('醫美/' + lay, await h.ev(webCheck));
        if (lay === 'band') await h.shot('#valueChainEditor .vc-zones', outDir + '/ST-43-band.png');
      }
      await setLayout(h, 'porter');
    }
    scen[key].bio = { s: await slides(h), names: await h.ev(`valueChain.products.filter(n=>n.type==='unit').map(n=>n.name)`) };
    if (key === 'new') {
      // 700 寬：維持橫排方塊
      await h.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 1000, deviceScaleFactor: 1, mobile: false }); await sleep(600);
      const n = await h.ev(`[...document.querySelectorAll('.vc-products-body > .vc-unit')].map(u=>getComputedStyle(u).writingMode)`);
      ok(n.length > 0 && n.every(w => w === 'horizontal-tb'), `[700] 產品方塊維持橫排 horizontal-tb（${n.join(',')}）`);
      await h.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false }); await sleep(400);
      ok(!h.errors().length, `[new] console error 0 ${h.errors().join(' | ')}`);
    }
  }
  for (const k of ['book', 'bio']) {
    const N = scen.new[k].s, D = scen.dev[k].s;
    ok(!N.err && !!N['ppt/slides/slide1.xml'], `[pptx ${k}] 匯出不拋例外 ${N.err || ''}`);
    judgePptx(k, N['ppt/slides/slide1.xml'] || '', scen.new[k].names);
    const others = Object.keys(D).filter(n => n !== 'err' && n !== 'ppt/slides/slide1.xml');
    const diff = others.filter(n => N[n] !== D[n]);
    ok(others.length > 0 && !diff.length, `[pptx ${k}] slide1 以外 ${others.length} 頁 XML 與 dev 相同（不同：${diff.join(',') || '無'}）`);
  }
} finally { await h.close(); }
console.log(fail ? `FAIL ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
