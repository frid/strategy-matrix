// ST-35eh 自測：分色配色（perUnit）優先於 hex／segment 版型。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35eh.mjs （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35eh/）
// 測了什麼：測試價值鏈（含巢狀群組），hex／segment × 三套 perUnit 配色：葉節點白字對比 ≥ 4.5、群組名對其背景對比 ≥ 4.5（hex 為淡底深字；segment 群組名字色為該色深版）；各截圖。
// 預期：全部 PASS。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35eh'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
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
const info = `(()=>{
  const parse=c=>{const q=c.match(/color\\(srgb ([^)]+)\\)/);if(q)return q[1].split(/[ \\/]+/).slice(0,3).map(v=>+v*255);const m=c.match(/rgba?\\(([^)]+)\\)/);return m?m[1].split(/[ ,\\/]+/).map(Number).slice(0,3):null};
  const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
  const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const P=document.querySelector('.vc-zone-primary');
  const leaves=[...P.querySelectorAll('.vc-unit:not(.vc-asset)')].map(u=>{const bg=parse(getComputedStyle(u).backgroundColor);const el=u.querySelector('.vc-node-head input,.vc-node-head textarea');const fg=el&&parse(getComputedStyle(el).color);return bg&&fg?cr(bg,fg):0});
  const heads=[...P.querySelectorAll('.vc-group > .vc-node-head')].map(h=>{
    let n=h,bg=null;while(n&&n!==document.body){bg=parse(getComputedStyle(n).backgroundColor);if(bg&&!/rgba\\(0, 0, 0, 0\\)/.test(getComputedStyle(n).backgroundColor))break;n=n.parentElement}
    const el=h.querySelector('input,textarea');const fg=parse(getComputedStyle(el).color);return bg&&fg?cr(bg,fg):0});
  return {leaves,heads,cls:document.querySelector('.vc-zones').className};
})()`;
const h = await launch();
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.ev(`guideGoto('chain'); 0`); await sleep(700);
  await h.ev(`valueChain = normaliseValueChain(${JSON.stringify(TEST_VC)}); resetValueChainIds(valueChain); commitValueChain(); 0`); await sleep(400);
  const pu = JSON.parse(await h.ev(`JSON.stringify(COLOR_PALETTES.map((p,i)=>p.perUnit?i:-1).filter(i=>i>=0))`));
  ok(pu.length >= 3, `perUnit 配色 ${pu}`);
  for (const lay of ['hex', 'segment']) {
    await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(lay)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500);
    for (const i of pu.slice(0, 3)) {
      await h.ev(`applyPalette(${i}); 0`); await sleep(500);
      const g = await h.ev(info);
      ok(/vc-per-unit/.test(g.cls), `[${lay} p${i}] zones「${g.cls}」`);
      ok(g.leaves.length > 0 && g.leaves.every(x => x >= 4.5), `[${lay} p${i}] 葉節點對比最低 ${Math.min(...g.leaves).toFixed(2)}`);
      ok(g.heads.length > 0 && g.heads.every(x => x >= 4.5), `[${lay} p${i}] 群組名對比最低 ${Math.min(...g.heads).toFixed(2)}`);
      await h.shot('#valueChainEditor', `${out}/${lay}-p${i}.png`);
    }
  }
  ok(h.errors().length === 0, 'console error 0');
} finally { await h.close(); }
console.log(fail ? `FAIL ×${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
