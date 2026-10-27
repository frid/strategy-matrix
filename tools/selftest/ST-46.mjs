// ST-46 自測：③ 策略構想不顯示「描述策略點」；④ 仍可見（② 的模式列整組隱藏屬 ST-33）。
// 跑法：node tools/selftest/ST-46.mjs （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/st46/）。預期全 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st46'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const h = await launch();
const vis = sel => h.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});return !!e && e.offsetParent !== null})()`);
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.loadExample('bookstore-a');
  await h.ev(`guideGoto('cells'); 0`); await sleep(500);
  await h.ev(`guideGoto('ideas'); 0`); await sleep(500);
  ok(!(await vis('#modeDescBtn')), '③ 描述按鈕隱藏');
  ok(await vis('.mode-toggle'), '③ 模式列仍可見');
  await h.shot(null, `${out}/step3.png`);
  await h.ev(`guideGoto('premise'); 0`); await sleep(500);
  ok(await vis('#modeDescBtn'), '④ 描述按鈕可見');
  await h.shot(null, `${out}/step4.png`);
} catch (e) { console.log('ERR', e); fail++; }
await h.close?.();
console.log(fail ? 'FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
