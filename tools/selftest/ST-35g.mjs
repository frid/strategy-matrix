// ST-35g 自測：PPTX 價值鏈頁（slide1）依 valueChain.layout 畫 band／segment／hex／circle；porter 與基準版逐 byte 相同。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35g.mjs [基準 ref，預設 dev]   （需 Chrome、git；圖寫 $CLAUDE_JOB_DIR/tmp/ST-35g/）
// 做法：攔 JSZip.prototype.generateAsync 取 ppt/slides/slide1.xml（同 ST-20）；基準版用 `git show <ref>:index.html` 存到暫存目錄開。
// 測了什麼（bookstore-a、bio-aesthetic（前 3 個主要活動葉節點給 icon）× band／segment／hex／circle）：
//   [1] exportPptx 不拋例外、lastInfo.layout＝該版型、skippedLinks 0
//   [2] slide1 葉節點 prst（homePlate／chevron／hexagon／ellipse）數量＝主要活動葉節點數（band 另加支援活動的 homePlate）
//   [3] 所有 sp／cxnSp 在 slide（10"×5.625"）內；band／segment／circle 葉節點兩兩不重疊（hex 依設計咬合，只查左右順序）
//   [4] 連接器數 ≥ links 數、「價值鏈連線 N」涵蓋全部 links
//   [5] segment、hex：相鄰頂層項目代表色（第一個葉節點填色）不同
//   [6] circle：每個圓內文字＝icon 或名稱首字；有 dash 虛線群組底板（有群組時）；Margin 黑色 2B2D31
//   [7] 分色配色 COLOR_PALETTES[6]＋band：葉節點填色含 ≥ 2 種 perUnit 色；circle 下不吃分色（圓色仍是八色）
//   [8] porter（預設配色＋分色配色）下兩範例 slide1 與基準版逐 byte 相同
//   [9] console error 0；另測 layout='fold' 匯出走 band
// 另把每個情境的 slide1 以簡易 SVG 重畫（prst 幾何近似）並截圖：$CLAUDE_JOB_DIR/tmp/ST-35g/<範例>-<版型>.png（本機沒有 LibreOffice）
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35g'; mkdirSync(out + '/base', { recursive: true });
const baseRef = process.argv[2] || 'dev';
const baseHtml = out + '/base/index.html';
writeFileSync(baseHtml, execSync(`git show ${baseRef}:index.html`, { cwd: root, maxBuffer: 64 << 20 }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const W = 9144000, H = 5143500;

const parse = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
  const s = m[0];
  const o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/) || [];
  return { kind: m[1], name: (s.match(/name="([^"]*)"/) || [])[1], x: +o[1], y: +o[2], w: +o[3], h: +o[4],
    prst: (s.match(/prst="(\w+)"/) || [])[1], adj: +((s.match(/name="adj" fmla="val (\d+)"/) || [])[1] || NaN),
    fill: (s.match(/<\/a:prstGeom>\s*<a:solidFill><a:srgbClr val="(\w+)"/) || [])[1],
    ln: (s.match(/<a:ln w="\d+"><a:solidFill><a:srgbClr val="(\w+)"/) || [])[1], dash: s.includes('prstDash'),
    text: (s.match(/<a:t>([^<]*)<\/a:t>/) || [])[1] || '', color: (s.match(/<a:rPr[^>]*><a:solidFill><a:srgbClr val="(\w+)"/) || [])[1],
    sz: +((s.match(/ sz="(\d+)"/) || [])[1] || 900), anchorT: /<a:bodyPr[^>]*anchor="t"/.test(s), vert: /vert="eaVert"/.test(s), flipH: /flipH/.test(s), flipV: /flipV/.test(s),
    tail: s.includes('tailEnd') };
});
const unesc = t => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// 簡易 SVG 重畫（只為目視檢查：prst 幾何近似、文字不折行縮放）
const E = 96 / 914400;
function svgOf(shapes) {
  const pts = (a) => a.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  const body = shapes.map(s => {
    const x = s.x * E, y = s.y * E, w = s.w * E, h = s.h * E, ss = Math.min(w, h);
    if (s.kind === 'cxnSp') {
      const [x1, x2] = s.flipH ? [x + w, x] : [x, x + w], [y1, y2] = s.flipV ? [y + h, y] : [y, y + h];
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5A4FCF" stroke-width="1.5" ${s.tail ? 'marker-end="url(#ar)"' : ''}/>`;
    }
    const fill = s.fill ? '#' + s.fill : 'none', st = s.ln ? `stroke="#${s.ln}" stroke-width="1" ${s.dash ? 'stroke-dasharray="3 2"' : ''}` : '';
    let g;
    const a = isNaN(s.adj) ? null : s.adj / 100000;
    if (s.prst === 'ellipse') g = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" ${st}/>`;
    else if (s.prst === 'homePlate') { const t = ss * (a ?? 0.5); g = `<polygon points="${pts([[x, y], [x + w - t, y], [x + w, y + h / 2], [x + w - t, y + h], [x, y + h]])}" fill="${fill}" ${st}/>`; }
    else if (s.prst === 'chevron') { const t = ss * (a ?? 0.5); g = `<polygon points="${pts([[x, y], [x + w - t, y], [x + w, y + h / 2], [x + w - t, y + h], [x, y + h], [x + t, y + h / 2]])}" fill="${fill}" ${st}/>`; }
    else if (s.prst === 'hexagon') { const t = ss * 0.25; g = `<polygon points="${pts([[x + t, y], [x + w - t, y], [x + w, y + h / 2], [x + w - t, y + h], [x + t, y + h], [x, y + h / 2]])}" fill="${fill}" ${st}/>`; }
    else if (s.prst === 'downArrow') { g = `<polygon points="${pts([[x + w * .25, y], [x + w * .75, y], [x + w * .75, y + h - w / 2], [x + w, y + h - w / 2], [x + w / 2, y + h], [x, y + h - w / 2], [x + w * .25, y + h - w / 2]])}" fill="${fill}"/>`; }
    else g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s.prst === 'roundRect' ? Math.min(ss * (a ?? 0.16667), ss / 2) : 0}" fill="${s.fill && s.prst ? fill : 'none'}" ${st}/>`;
    const fs = s.sz / 100 * 96 / 72;
    const tx = s.text ? (s.vert
      ? `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${fs}" fill="#${s.color || '000'}" text-anchor="middle" style="writing-mode:vertical-rl">${s.text}</text>`
      : `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;display:flex;align-items:${s.anchorT ? 'flex-start' : 'center'};justify-content:center;text-align:center;font:${fs}px 'Microsoft JhengHei',sans-serif;line-height:1.15;color:#${s.color || '000'};overflow:hidden;word-break:break-all">${s.text}</div></foreignObject>`) : '';
    return g + tx;
  }).join('\n');
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><svg xmlns="http://www.w3.org/2000/svg" width="${W * E}" height="${H * E}" style="border:1px solid #ccc">
<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#5A4FCF"/></marker></defs>${body}</svg></body>`;
}

async function boot(file) {
  const h = await launch({ width: 1400, height: 900 });
  await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file);
  await h.ev(`HTMLAnchorElement.prototype.click=function(){}; const g=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g.apply(this,a);}; 0`);
  return h;
}
const setup = ex => ex === 'bookstore-a' ? `loadExampleProject('bookstore-a'); 0`
  : `loadValueChainTemplate('bio-aesthetic');
     (()=>{const ic=['🧪','💉','🏥'];let k=0;const w=l=>l.forEach(n=>{if(n.type==='group')w(n.children||[]);else if(k<3)n.icon=ic[k++];});w(valueChain.primary);})(); 0`;
async function exportOnce(h, ex, layout, palette) {
  await h.ev(setup(ex)); await sleep(400);
  await h.ev(`(()=>{const s=document.getElementById('paletteSelect');s.value=String(${palette});s.dispatchEvent(new Event('change'));})(); 0`);
  await h.ev(`valueChain.layout=${JSON.stringify(layout)}; 0`); await sleep(200);
  await h.ev(`window.__zip=null; window.__err=null; try{exportPptx()}catch(e){window.__err=String(e)} 0`);
  for (let i = 0; i < 40 && !(await h.ev('!!window.__zip')); i++) await sleep(150);
  await sleep(300);
  return h.ev(`(async()=>{
    const leaves=[];const w=(l,top)=>l.forEach((n,i)=>{const t=top<0?i:top;if(n.type==='group')w(n.children||[],t);else if(n.type==='unit')leaves.push({name:n.name,icon:n.icon||'',top:t,asset:n.unitKind==='asset'});});
    w(valueChain.primary,-1);
    return {err:window.__err, xml: window.__zip ? await window.__zip.file('ppt/slides/slide1.xml').async('string') : '',
      info: buildValueChainShapesXml.lastInfo, leaves, links: valueChain.links.length, support: valueChain.support.length,
      arrowBg: !!valueChain.showArrowBg, hasGroup: valueChain.primary.some(n=>n.type==='group'),
      perUnit: (typeof currentPerUnitColors==='function' && currentPerUnitColors()||[]).map(c=>c.replace('#','').toUpperCase())};
  })()`);
}

const h = await boot(html);
const PRST = { band: 'homePlate', segment: 'chevron', hex: 'hexagon', circle: 'ellipse' };
const CIRCLE8 = ['2AA7B8', '3B6FB6', '7B5CC4', 'E3832C', 'D64A4A', 'E0B531', '4A9D5C', '8A7BB5'];
for (const ex of ['bookstore-a', 'bio-aesthetic']) {
  for (const lk of ['band', 'segment', 'hex', 'circle']) {
    const tag = `[${ex} ${lk}]`;
    const r = await exportOnce(h, ex, lk, 0);
    ok(!r.err && r.xml, `${tag} [1] exportPptx 不拋例外${r.err ? '：' + r.err : ''}`);
    if (!r.xml) continue;
    ok(r.info.layout === lk && r.info.skippedLinks === 0, `${tag} [1] lastInfo.layout=${r.info.layout} skippedLinks=${r.info.skippedLinks}`);
    const shapes = parse(r.xml);
    writeFileSync(`${out}/${ex}-${lk}.html`, svgOf(shapes));
    const prst = PRST[lk];
    const nPrst = shapes.filter(s => s.prst === prst).length;
    const expect = r.leaves.length + (lk === 'band' && r.arrowBg ? r.support : 0);
    ok(nPrst === expect, `${tag} [2] ${prst} ${nPrst} 個＝葉節點 ${r.leaves.length}${lk === 'band' && r.arrowBg ? '＋支援 ' + r.support : ''}`);
    const outside = shapes.filter(s => s.x < 0 || s.y < 0 || s.x + s.w > W || s.y + s.h > H);
    ok(!outside.length, `${tag} [3] 所有形狀在 slide 內${outside.length ? '；超出：' + outside.slice(0, 3).map(s => s.name + '@' + s.y + '+' + s.h).join(',') : ''}`);
    // 葉節點形狀（band 去掉整列寬的支援活動）
    const leafSh = shapes.filter(s => s.prst === prst).filter(s => !(lk === 'band' && s.w > W / 3));
    if (lk === 'hex') {
      const sorted = [...leafSh].sort((a, b) => a.y - b.y || a.x - b.x);
      const bad = sorted.filter((s, i) => i && sorted[i - 1].y === s.y && s.x <= sorted[i - 1].x);
      ok(!bad.length, `${tag} [3] 六角同列左右順序遞增（咬合不重疊位置）`);
    } else {
      let ov = 0;
      for (let i = 0; i < leafSh.length; i++) for (let j = i + 1; j < leafSh.length; j++) {
        const a = leafSh[i], b = leafSh[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) ov++;
      }
      ok(ov === 0, `${tag} [3] 葉節點兩兩不重疊（重疊 ${ov} 對）`);
    }
    const cx = shapes.filter(s => s.kind === 'cxnSp');
    const linkIds = new Set(cx.map(s => (s.name.match(/^價值鏈連線 (\d+)/) || [])[1]).filter(Boolean));
    ok(cx.length >= r.links && linkIds.size === r.links, `${tag} [4] 連接器 ${cx.length} 段、涵蓋 ${linkIds.size}/${r.links} 條連線`);
    if (lk === 'segment' || lk === 'hex') {
      // 葉節點形狀與 r.leaves 同序（深度優先），取每個頂層項目第一顆非資產葉節點的填色
      const rep = []; r.leaves.forEach((l, i) => { if (!l.asset && !rep.some(x => x.top === l.top)) rep.push({ top: l.top, fill: leafSh[i] && leafSh[i].fill }); });
      const same = rep.filter((x, i) => i && x.fill === rep[i - 1].fill);
      ok(rep.length > 1 && !same.length, `${tag} [5] 相鄰頂層代表色不同：${rep.map(x => x.fill).join(' ')}`);
    }
    if (lk === 'circle') {
      const wrong = r.leaves.filter((l, i) => !leafSh[i] || unesc(leafSh[i].text) !== (l.icon || [...l.name][0]));
      ok(!wrong.length, `${tag} [6] 圓內文字＝icon 或首字（不符 ${wrong.length}${wrong.length ? '：' + wrong.slice(0, 3).map(l => l.name).join(',') : ''}；icon ${r.leaves.filter(l => l.icon).length} 個）`);
      ok(!r.hasGroup || shapes.some(s => s.dash && s.prst === 'roundRect'), `${tag} [6] 群組虛線 roundRect 底板`);
      ok(!r.arrowBg || shapes.some(s => s.prst === 'downArrow' && s.fill === '2B2D31'), `${tag} [6] Margin 黑色`);
    }
  }
  // [7] 分色配色
  const rb = await exportOnce(h, ex, 'band', 6);
  const fills = new Set(parse(rb.xml).filter(s => s.prst === 'homePlate').map(s => s.fill));
  const hit = rb.perUnit.filter(c => fills.has(c));
  ok(!rb.err && rb.perUnit.length && hit.length >= 2, `[${ex} band 分色] [7] 葉節點含 perUnit 色 ${hit.length} 種（${hit.join(' ')}）`);
  writeFileSync(`${out}/${ex}-band-perunit.html`, svgOf(parse(rb.xml)));
  const rc = await exportOnce(h, ex, 'circle', 6);
  const cf = parse(rc.xml).filter(s => s.prst === 'ellipse' && s.fill !== undefined).map(s => s.fill);
  ok(cf.every(f => CIRCLE8.includes(f) || !rc.perUnit.includes(f)), `[${ex} circle 分色] [7] 圓色仍是八色、不吃分色`);
}

// fold（ST-35c 尚未併入時）走 band
{ const rf = await exportOnce(h, 'bio-aesthetic', 'fold', 0);
  ok(!rf.err && rf.info.layout === 'band' && parse(rf.xml).filter(s => s.prst === 'homePlate').length === rf.leaves.length + (rf.arrowBg ? rf.support : 0), `[bio-aesthetic fold] 走 band（layout=${rf.info.layout}）`); }

// [8] porter 與基準版逐 byte 相同
const porter = [];
for (const pal of [0, 6]) for (const ex of ['bookstore-a', 'bio-aesthetic']) porter.push([ex, pal, (await exportOnce(h, ex, 'porter', pal)).xml]);
writeFileSync(`${out}/bookstore-a-porter.html`, svgOf(parse(porter[0][2])));
const errNew = h.errors();
await h.close();
const hb = await boot(baseHtml);
for (const [ex, pal, xml] of porter) {
  const b = (await exportOnce(hb, ex, 'porter', pal)).xml;
  ok(xml && xml === b, `[${ex} porter 配色${pal}] [8] slide1 與 ${baseRef} 逐 byte 相同（${xml.length}/${b.length}）`);
}
await hb.close();
ok(!errNew.length, `[9] console error 0${errNew.length ? '：' + errNew.slice(0, 3).join(' | ') : ''}`);

// 重畫圖截圖
const hs = await launch({ width: 980, height: 560 });
const { readdirSync } = await import('node:fs');
for (const f of readdirSync(out).filter(f => f.endsWith('.html'))) {
  await hs.open(out + '/' + f); await hs.shot('svg', out + '/' + f.replace(/\.html$/, '.png'));
}
await hs.close();
console.log('圖：' + out + '/*.png');
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
