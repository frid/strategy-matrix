// ST-33 自測：② 描述策略點不顯示箭頭，也隱藏與箭頭有關的控制；③ 之後照舊。
// 跑法：node tools/selftest/ST-33.mjs （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/st33/）。預期全 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st33'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const h = await launch();
const lines = () => h.ev(`[...document.querySelectorAll('#lineCanvas path, #lineCanvas line')].filter(e => !e.closest('defs')).length`);
const vis = sel => h.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});return !!e && e.offsetParent !== null})()`);
const SEL_ARROW = ['.mode-toggle', '#matrixViewSel', '.action-bar button[onclick*="autoHideUnusedCols"]', '.action-bar button[onclick*="clearCompetitor"]', '.action-bar button[onclick*="clearAll"]'];
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.loadExample('bookstore-a');
  await h.ev(`guideGoto('cells'); 0`); await sleep(700);
  ok(await lines() === 0, '② 線數 0');
  ok(await h.ev(`document.querySelectorAll('td.cell.clash').length === 0`), '② 無 clash');
  for (const s of SEL_ARROW) ok(!(await vis(s)), '② 隱藏 ' + s);
  ok(await vis('#shortViewChk') && await vis('#undoBtn'), '② 短版與復原可見');
  await h.ev(`selectCell('A', 0, true); 0`); await sleep(300);
  ok((await h.ev(`document.getElementById('cellPanel').innerText.length`)) > 20, '② 點格子 cellPanel 有內容');
  await h.shot(null, `${out}/step2.png`);
  await h.ev(`guideGoto('ideas'); 0`); await sleep(700);
  ok(await lines() === 11, '③ 線數 11：' + await lines());
  for (const s of SEL_ARROW) ok(await vis(s), '③ 可見 ' + s);
  await h.shot(null, `${out}/step3.png`);
  await h.ev(`guideGoto('premise'); setMatrixView('all'); 0`); await sleep(700);
  ok(await lines() === 24, '④ all 線數 24：' + await lines());
  ok(await h.ev(`document.querySelectorAll('td.cell.clash').length > 0`), '④ all 有 ⚔');
  await h.ev(`setMatrixView('current'); guideGoto('cells'); 0`); await sleep(700);
  ok(await lines() === 0, '回 ② 線 0');
  await h.ev(`guideGoto('ideas'); 0`); await sleep(500);
  ok(await lines() === 11, '回 ③ 線 11');
  await h.ev(`setMode('describe'); 0`); await sleep(300);
  ok(await lines() === 0, '③ 手動 describe 線 0');
  await h.ev(`setMode('draw'); 0`); await sleep(300);
  ok(await lines() === 11, '③ 手動 draw 線回來');
  const errs = h.errors ? h.errors() : [];
  ok(errs.length === 0, 'console error 0 ' + JSON.stringify(errs));
} finally { await h.close(); }
process.exit(fail ? 1 : 0);
