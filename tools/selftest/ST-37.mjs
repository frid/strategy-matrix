// ST-37 自測：band 系／circle 群組橫帶 hover 時動作鈕浮在橫帶上方，不改變橫帶高度與同列節點位置。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-37.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-37/）
// 測了什麼：bio-aesthetic 1400 切 band／fold／circle：「醫療服務」橫帶 hover 前後 height、同列節點 top 不變；
//   平時三顆 .vc-act 不可見、hover 後可見（opacity>0、pointer-events auto）且在橫帶上緣之上；真滑鼠點「＋子項」會新增子項；
//   fold 角標位置 hover 前後不變；porter DOM 切換前後相同。
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-37'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
const domSig = h => h.ev(`(()=>{const c=document.getElementById('valueChainEditor').cloneNode(true);c.querySelectorAll('svg').forEach(s=>s.remove());return c.innerHTML})()`);
const move = (h, x, y) => h.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const GH = `[...document.querySelectorAll('.vc-zone-primary .vc-group')].find(g=>g.querySelector(':scope > .vc-node-head textarea').value==='醫療服務')`;
const measure = `(()=>{const g=${GH};const hd=g.querySelector(':scope > .vc-node-head');const r=hd.getBoundingClientRect();
  const sib=[...document.querySelectorAll('.vc-zone-primary > .vc-zone-body > *')].map(e=>Math.round(e.getBoundingClientRect().top*10)/10);
  const inner=[...g.querySelectorAll(':scope > .vc-group-body > *')].map(e=>Math.round(e.getBoundingClientRect().top*10)/10);
  const acts=[...hd.querySelectorAll(':scope > .vc-act')].map(a=>{const q=a.getBoundingClientRect(),cs=getComputedStyle(a);return {t:a.textContent,op:+cs.opacity,pe:cs.pointerEvents,top:q.top,bottom:q.bottom,left:q.left,right:q.right,w:q.width}});
  const b=hd.querySelector('.vc-fold-badge');const bq=b&&b.getBoundingClientRect();
  return {h:r.height,top:r.top,left:r.left,right:r.right,mid:(r.left+r.right)/2,sib,inner,acts,badge:bq&&[bq.left,bq.top]}})()`;
{
  const h = await launch();
  try {
    await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
    await h.ev(`guideGoto('chain'); 0`); await sleep(700);
    await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400);
    const porter0 = await domSig(h);
    for (const lay of ['band', 'segment', 'hex', 'fold', 'circle']) {
      await setLayout(h, lay);
      if (lay === 'fold') await h.ev(`document.querySelector('.vc-fold-all[data-fold="open"]').click(); 0`).then(() => sleep(300));
      await h.ev(`${GH}.scrollIntoView({block:'center'}); 0`); await move(h, 2, 2); await sleep(300);
      const a = await h.ev(measure);
      ok(a.acts.length === 3 && a.acts.every(x => x.op === 0 && x.pe === 'none'), `[${lay}] 平時三顆動作鈕隱藏 ${JSON.stringify(a.acts.map(x => x.op))}`);
      await h.shot('#valueChainEditor .vc-zones', `${out}/${lay}-before.png`);
      // 滑到橫帶上（避開名稱 textarea 以外的地方也可；直接移到橫帶中間偏左的 padding 區）
      await move(h, a.left + 3, a.top + a.h / 2); await sleep(300);
      const b = await h.ev(measure);
      ok(b.h === a.h, `[${lay}] 橫帶 height 不變 ${a.h}→${b.h}`);
      ok(JSON.stringify(b.sib) === JSON.stringify(a.sib) && JSON.stringify(b.inner) === JSON.stringify(a.inner), `[${lay}] 同列節點 top 不變`);
      ok(b.acts.every(x => x.op > 0 && x.pe === 'auto' && x.bottom <= b.top + 1 && x.right <= b.right + 1 && x.w > 10), `[${lay}] hover 後三顆可見、在橫帶上方 ${JSON.stringify(b.acts.map(x => [x.t, Math.round(x.top), Math.round(x.left)]))}`);
      ok(a.badge == null || JSON.stringify(a.badge) === JSON.stringify(b.badge), `[${lay}] 角標位置不變 ${JSON.stringify(a.badge)}`);
      await h.shot('#valueChainEditor .vc-zones', `${lay}-hover.png`.replace(/^/, out + '/'));
      await move(h, 2, 2); await sleep(200);
    }
    await setLayout(h, 'porter');
    ok((await domSig(h)) === porter0, 'porter 切回 DOM 與切換前相同（附註：新增的子項會讓 DOM 不同時以 band 點＋子項後為準）');
    await setLayout(h, 'band'); await h.ev(`${GH}.scrollIntoView({block:'center'}); 0`);
      // 從橫帶移到動作鈕上仍可見（不會斷 hover）；點「＋子項」
    {
      const n0 = await h.ev(`${GH}.querySelectorAll(':scope > .vc-group-body > *').length`);
      await move(h, 2, 2); await sleep(200); const a0 = await h.ev(measure); await move(h, a0.left + 3, a0.top + a0.h / 2); await sleep(300); const b = await h.ev(measure); const c = b.acts.find(x => x.t === '＋子項');
      await move(h, c.left + c.w / 2, c.top + 10); await sleep(200);
      const m = await h.ev(measure);
      ok(m.acts.every(x => x.op > 0), `[band] 滑到動作鈕上仍顯示`);
      await h.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.left + c.w / 2, y: c.top + 10, button: 'left', clickCount: 1 });
      await h.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.left + c.w / 2, y: c.top + 10, button: 'left', clickCount: 1 });
      await sleep(400);
      const n1 = await h.ev(`${GH}.querySelectorAll(':scope > .vc-group-body > *').length`);
      ok(n1 === n0 + 1, `[band] 點＋子項新增子項 ${n0}→${n1}`);
      }
    ok(h.errors().length === 0, `無 console error ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}
console.log(fail ? `FAIL ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
