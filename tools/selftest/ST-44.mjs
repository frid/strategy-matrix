// ST-44 自測：PPTX 價值鏈頁 Margin／利潤＝直長、尖朝右的 rightArrow（同畫面 CSS），六種版型都一樣。
// 跑法：node tools/selftest/ST-44.mjs   （需 Chrome；svg 寫 tools/selftest/out/ST-44-<版型>.svg 供目視）
// 做法：醫美範本 × porter／band／segment／hex／circle／fold，各匯出一次（攔 JSZip.prototype.generateAsync 取 slide1.xml，同 ST-35g）。
// 斷言：Margin shape prst=rightArrow、adj1=80000／adj2=28000、無 rot、cx=0.34"、cy≥單元高、在產品欄左側、vert=eaVert、文字含 Margin。
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = root + '/tools/selftest/out'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const E = 96 / 914400;
const parse = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
  const s = m[0], o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/) || [];
  const g = n => +((s.match(new RegExp(`name="${n}" fmla="val (\\d+)"`)) || [])[1] || NaN);
  return { raw: s, kind: m[1], name: (s.match(/name="([^"]*)"/) || [])[1], x: +o[1], y: +o[2], w: +o[3], h: +o[4],
    prst: (s.match(/prst="(\w+)"/) || [])[1], adj: g('adj'), adj1: g('adj1'), adj2: g('adj2'),
    fill: (s.match(/<\/a:prstGeom>\s*<a:solidFill><a:srgbClr val="(\w+)"/) || [])[1],
    text: (s.match(/<a:t>([^<]*)<\/a:t>/) || [])[1] || '', flipH: /flipH/.test(s), flipV: /flipV/.test(s) };
});
function svgOf(sh) {
  const P = a => a.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  const body = sh.map(s => {
    const x = s.x * E, y = s.y * E, w = s.w * E, h = s.h * E, ss = Math.min(w, h), f = s.fill ? '#' + s.fill : 'none';
    if (s.kind === 'cxnSp') { const [x1, x2] = s.flipH ? [x + w, x] : [x, x + w], [y1, y2] = s.flipV ? [y + h, y] : [y, y + h]; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5A4FCF"/>`; }
    if (s.prst === 'rightArrow') { const hl = ss * s.adj2 / 1e5, t = h * (1 - s.adj1 / 1e5) / 2; return `<polygon points="${P([[x, y + t], [x + w - hl, y + t], [x + w - hl, y], [x + w, y + h / 2], [x + w - hl, y + h], [x + w - hl, y + h - t], [x, y + h - t]])}" fill="${f}"/><text x="${x + w / 2}" y="${y + h / 2}" font-size="12" fill="#fff" text-anchor="middle" style="writing-mode:vertical-rl">${s.text}</text>`; }
    if (s.prst === 'ellipse') return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${f}"/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" fill-opacity=".6" stroke="#999" stroke-width=".5"/>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${9144000 * E}" height="${5143500 * E}" style="background:#fff;border:1px solid #ccc">${body}</svg>`;
}
const h = await launch({ width: 1400, height: 900 });
await h.open(root + '/index.html'); await h.ev('localStorage.clear(); 0'); await h.open(root + '/index.html');
await h.ev(`HTMLAnchorElement.prototype.click=function(){}; const g=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g.apply(this,a);}; 0`);
for (const lk of ['porter', 'band', 'segment', 'hex', 'circle', 'fold']) {
  await h.ev(`loadValueChainTemplate('bio-aesthetic'); valueChain.showArrowBg=true; valueChain.layout=${JSON.stringify(lk)}; 0`); await sleep(300);
  await h.ev(`window.__zip=null; window.__err=null; try{exportPptx()}catch(e){window.__err=String(e)} 0`);
  for (let i = 0; i < 40 && !(await h.ev('!!window.__zip')); i++) await sleep(150);
  await sleep(300);
  const r = await h.ev(`(async()=>({err:window.__err, xml: window.__zip ? await window.__zip.file('ppt/slides/slide1.xml').async('string') : '', unitH: buildValueChainShapesXml.lastInfo && buildValueChainShapesXml.lastInfo.unitH}))()`);
  const sh = parse(r.xml), m = sh.find(s => /^Margin/.test(s.name || ''));
  const prod = sh.filter(s => s.kind === 'sp' && s !== m && s.x > (m ? m.x + m.w : 1e12));
  ok(!r.err && r.xml && !!m, `[${lk}] 匯出不拋例外且有 Margin shape${r.err ? '：' + r.err : ''}`);
  if (!m) continue;
  ok(m.prst === 'rightArrow' && m.adj1 === 80000 && m.adj2 === 28000, `[${lk}] rightArrow adj1=${m.adj1} adj2=${m.adj2}`);
  ok(!/<a:xfrm[^>]*rot=/.test(m.raw), `[${lk}] 無 rot`);
  ok(m.w === Math.round(0.34 * 914400), `[${lk}] cx=${m.w}（0.34"）`);
  ok(m.h > m.w * 3 && (r.unitH == null || m.h >= r.unitH), `[${lk}] 直長 cy=${m.h}（unitH ${r.unitH}）`);
  ok(prod.length > 0 && prod.every(p => p.x >= m.x + m.w), `[${lk}] 產品欄在 Margin 右側（${prod.length} 塊）`);
  ok(/vert="eaVert"/.test(m.raw) && /Margin/.test(m.text), `[${lk}] eaVert 且文字含 Margin`);
  writeFileSync(`${out}/ST-44-${lk}.svg`, svgOf(sh));
}
await h.close?.();
console.log(fail ? `FAIL ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
