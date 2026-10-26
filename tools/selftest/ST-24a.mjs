// ST-24a 自測：#cellPanel 為矩陣右側 sticky 側欄（②／④），窄螢幕上下排，③ 時矩陣滿寬並仍畫箭頭。
// 跑法：node tools/selftest/ST-24a.mjs （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/st24/）
// 預期：全 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st24'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const rect = sel => `(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}})()`;
const h = await launch();
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.loadExample('bookstore-a');
  await h.ev(`guideGoto('cells'); 0`); await sleep(600);
  await h.ev(`selectCell('A', 0, true); 0`); await sleep(500);
  let p = await h.ev(rect('#cellPanel')), w = await h.ev(rect('.matrix-wrapper'));
  ok(p.h > 0 && p.l >= w.r - 1, `② 面板在矩陣右側 panel.l=${p.l|0} wrapper.r=${w.r|0}`);
  ok(p.t >= 0 && p.t < 900 && Math.abs(p.t - w.t) < 120, `② 面板與矩陣同列 panel.t=${p.t|0} wrapper.t=${w.t|0}`);
  ok(await h.ev(`(()=>{const e=document.querySelector('.matrix-wrapper');return getComputedStyle(e).overflowX==='auto'&&e.scrollWidth>=e.clientWidth})()`), '② wrapper 仍 overflow-x:auto');
  await h.shot(null, `${out}/step2-wide.png`);
  await h.ev(`window.scrollTo(0, document.documentElement.scrollHeight); 0`); await sleep(400);
  p = await h.ev(rect('#cellPanel'));
  ok(p.h > 0 && p.t >= 0 && p.t < 900, `捲到底後 sticky 面板仍在視窗內 top=${p.t|0}`);
  await h.ev(`window.scrollTo(0,0); 0`);
  await h.ev(`guideGoto('premise'); 0`); await sleep(600);
  p = await h.ev(rect('#cellPanel')); w = await h.ev(rect('.matrix-wrapper'));
  ok(p.h > 0 && p.l >= w.r - 1, `④ 面板在右側 panel.l=${p.l|0}`);
  await h.shot(null, `${out}/step4-wide.png`);
  await h.ev(`guideGoto('ideas'); 0`); await sleep(700);
  const row = await h.ev(rect('#matrixRow')); w = await h.ev(rect('.matrix-wrapper'));
  p = await h.ev(rect('#cellPanel'));
  ok(p.h === 0 && Math.abs(w.w - row.w) < 2, `③ 面板隱藏、矩陣滿寬 wrapper=${w.w|0} row=${row.w|0}`);
  const paths = await h.ev(`document.querySelectorAll('#lineCanvas path').length`);
  ok(paths > 0, `③ lineCanvas path ${paths}`);
  await h.ev(`guideGoto('cells'); 0`); await sleep(700);
  await h.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(500);
  await h.ev(`selectCell('A', 0, true); 0`); await sleep(800);
  p = await h.ev(rect('#cellPanel')); w = await h.ev(rect('.matrix-wrapper'));
  ok(await h.ev(`getComputedStyle(document.getElementById('cellPanel')).position`) === 'static', '窄螢幕 position static');
  ok(p.t >= w.b - 1, `窄螢幕上下排 panel.t=${p.t|0} wrapper.b=${w.b|0}`);
  await h.shot(null, `${out}/step2-narrow.png`);
  ok(h.errors().length === 0, `無 console error ${JSON.stringify(h.errors())}`);
} finally { await h.close(); }
process.exit(fail ? 1 : 0);
