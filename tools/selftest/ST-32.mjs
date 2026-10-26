// ST-32 自測：隱藏欄回復列移到矩陣上方；全部顯示回完整矩陣；無箭頭時自動隱藏不動作。
// 跑法：node tools/selftest/ST-32.mjs （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/st32/）。預期全 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st32'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const top = sel => `document.querySelector('${sel}').getBoundingClientRect().top`;
const h = await launch();
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.loadExample('bookstore-a');
  await h.ev(`guideGoto('ideas'); 0`); await sleep(600);
  await h.ev(`autoHideUnusedCols(); 0`); await sleep(400);
  ok(await h.ev(`document.getElementById('hiddenColsBar').classList.contains('show')`), '#hiddenColsBar.show');
  ok(await h.ev(`${top('#hiddenColsBar')} < ${top('#matrixRow')}`), '回復列在矩陣上方');
  const n = await h.ev(`Object.keys(hiddenCols).length`);
  ok(n > 0, '隱藏欄數 ' + n);
  await h.shot(null, `${out}/bar-above.png`);
  await h.ev(`guideGoto('cells'); 0`); await sleep(500);
  ok(await h.ev(`${top('#hiddenColsBar')} < ${top('#matrixRow')}`), '② 回復列也在矩陣上方');
  await h.ev(`guideGoto('ideas'); 0`); await sleep(400);
  await h.ev(`showAllColumns(); 0`); await sleep(400);
  ok(await h.ev(`Object.keys(hiddenCols).length === 0 && shortView === false`), '全部顯示：hiddenCols 空、shortView false');
  ok(await h.ev(`COLUMNS.every((_, ci) => !isColHidden(ci))`), '所有欄可見');
  ok(!(await h.ev(`document.getElementById('hiddenColsBar').classList.contains('show')`)), 'bar 隱藏');
  // 無箭頭 → 不動作
  await h.ev(`arrows.forEach((l, i) => arrows[i] = []); rebuildTable(); drawLines(); 0`);
  await h.ev(`autoHideUnusedCols(); 0`); await sleep(300);
  ok(await h.ev(`Object.keys(hiddenCols).length === 0 && shortView === false`), '無箭頭：自動隱藏不改狀態');
  ok((await h.ev(`document.getElementById('statusText').textContent`)).includes('尚無箭頭'), '狀態列提示');
  const errs = h.errors ? h.errors() : [];
  ok(errs.length === 0, 'console error 0 ' + JSON.stringify(errs));
} finally { await h.close(); }
process.exit(fail ? 1 : 0);
