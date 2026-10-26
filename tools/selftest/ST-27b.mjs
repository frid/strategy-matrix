// ST-27b 自測：STRATEGY_ELEMENTS 新增 explain／caseExample／pages／fullName／shape 資料
// 跑法（Node 24+、google-chrome，CHROME_BIN 可覆寫）：node tools/selftest/ST-27b.mjs
// 測：開 index.html 在頁內讀全域常數，並與 `git show HEAD:index.html` 版（用 headless 開暫存檔）比對：
//   1) 51 項皆有非空 explain／caseExample／pages／shape；pages 符合「287–288」「296、298」格式；page === 'S ' + pages；
//   2) shape.type ∈ ELEMENT_SHAPE_TYPES；列 ∈ A–F、欄 ∈ in/in2/out/out2；col 有 col/from/to 或 arrows；row 有 arrows；
//      inout 有 row/from[]/to；path 至少 2 點、extra 每段至少 2 點；cells（若有）格式正確；
//   3) id／cat／name／def／example 與 HEAD 版逐項相同、順序相同；
//   4) fullName 只出現在 1-4、6-2～6-8；
//   5) tipOf 同格式組字（chip tooltip）不含 undefined；elementLabel 與 HEAD 版相同（PPTX 不受影響）；
//   6) 開頁、載入範例無 console error。另印五種 shape 類型分佈與 inferred 數。
// 預期輸出全部 PASS、exit 0。
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launch } from '../cdp-harness.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const html = resolve(root, 'index.html');
const out = (process.env.CLAUDE_JOB_DIR || tmpdir()) + '/tmp/st27b'; mkdirSync(out, { recursive: true });
let fail = 0; const chk = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };

const headHtml = out + '/head-index.html';
writeFileSync(headHtml, execFileSync('git', ['-C', root, 'show', 'HEAD:index.html']));

const READ = "JSON.stringify({ els: STRATEGY_ELEMENTS, types: typeof ELEMENT_SHAPE_TYPES === 'undefined' ? null : ELEMENT_SHAPE_TYPES,"
  + " labels: STRATEGY_ELEMENTS.map(e => elementLabel(e.id)) })";

const h = await launch();
let cur, head;
try {
  await h.open(headHtml);
  head = JSON.parse(await h.ev(READ));
  await h.open(html);
  cur = JSON.parse(await h.ev(READ));
  await h.loadExample('bookstore-a');
  chk(h.errors().length === 0, '開頁＋載入範例無 console error' + (h.errors().length ? '：' + h.errors().join(' | ') : ''));
} finally { await h.close(); }

const els = cur.els;
const TYPES = cur.types;
chk(Array.isArray(TYPES) && TYPES.join() === 'cells,col,row,inout,path', 'ELEMENT_SHAPE_TYPES = ' + JSON.stringify(TYPES));
chk(els.length === 51, '51 項（實際 ' + els.length + '）');

// 3) 既有欄位不變
const keys = ['id', 'cat', 'name', 'def', 'example'];
const diffs = els.filter((e, i) => !head.els[i] || keys.some(k => e[k] !== head.els[i][k])).map(e => e.id);
chk(head.els.length === 51 && diffs.length === 0, 'id／cat／name／def／example 與 HEAD 相同' + (diffs.length ? '，不同：' + diffs.join(',') : ''));
chk(JSON.stringify(cur.labels) === JSON.stringify(head.labels), 'elementLabel 輸出與 HEAD 相同');

// 1) 新欄位
const PAGES_RE = /^\d+(–\d+)?(、\d+(–\d+)?)*$/;
const nonEmpty = s => typeof s === 'string' && s.trim() !== '';
const bad1 = els.filter(e => !nonEmpty(e.explain) || !nonEmpty(e.caseExample) || !nonEmpty(e.pages) || !e.shape).map(e => e.id);
chk(bad1.length === 0, '皆有 explain／caseExample／pages／shape' + (bad1.length ? '，缺：' + bad1.join(',') : ''));
const badP = els.filter(e => !PAGES_RE.test(e.pages || '')).map(e => e.id + '=' + e.pages);
chk(badP.length === 0, 'pages 格式' + (badP.length ? '，錯：' + badP.join(',') : ''));
const badPage = els.filter(e => e.page !== 'S ' + e.pages).map(e => e.id);
chk(badPage.length === 0, "page === 'S ' + pages" + (badPage.length ? '，錯：' + badPage.join(',') : ''));
// 頁碼應落在 Ch8 範圍 285–339
const outRange = els.filter(e => (e.pages.match(/\d+/g) || []).some(n => +n < 285 || +n > 339)).map(e => e.id);
chk(outRange.length === 0, '頁碼都在 S 285–339' + (outRange.length ? '，外：' + outRange.join(',') : ''));

// 2) shape
const ROW = new Set(['A', 'B', 'C', 'D', 'E', 'F']);
const COL = new Set(['in', 'in2', 'out', 'out2']);
const pt = p => p && ROW.has(p.row) && COL.has(p.col);
const cell = c => Array.isArray(c) && c.length === 2 && ROW.has(c[0]) && COL.has(c[1]);
function shapeErr(s) {
  if (!TYPES.includes(s.type)) return 'type ' + s.type;
  if (s.cells !== undefined && !(Array.isArray(s.cells) && s.cells.length && s.cells.every(cell))) return 'cells';
  if (s.inferred !== undefined && s.inferred !== true) return 'inferred';
  if (s.note !== undefined && !nonEmpty(s.note)) return 'note';
  switch (s.type) {
    case 'cells': return s.cells ? '' : 'cells 缺';
    case 'col': {
      const arr = s.arrows || [{ col: s.col, from: s.from, to: s.to }];
      return arr.length && arr.every(a => COL.has(a.col) && ROW.has(a.from) && ROW.has(a.to) && a.from !== a.to) ? '' : 'col 箭頭';
    }
    case 'row':
      return ROW.has(s.row) && Array.isArray(s.arrows) && s.arrows.length
        && s.arrows.every(a => COL.has(a.from) && COL.has(a.to) && a.from !== a.to && (a.both === undefined || a.both === true)) ? '' : 'row 箭頭';
    case 'inout':
      return ROW.has(s.row) && Array.isArray(s.from) && s.from.length && s.from.every(c => COL.has(c)) && COL.has(s.to) ? '' : 'inout';
    case 'path':
      return Array.isArray(s.path) && s.path.length >= 2 && s.path.every(pt)
        && (s.extra === undefined || (Array.isArray(s.extra) && s.extra.every(seg => Array.isArray(seg) && seg.length >= 2 && seg.every(pt)))) ? '' : 'path';
  }
  return '?';
}
const badS = els.map(e => [e.id, shapeErr(e.shape || {})]).filter(([, m]) => m).map(([id, m]) => id + ':' + m);
chk(badS.length === 0, 'shape 規格正確' + (badS.length ? '，錯：' + badS.join(',') : ''));

// 4) fullName
const FULL = ['1-4', '6-2', '6-3', '6-4', '6-5', '6-6', '6-7', '6-8'];
const withFull = els.filter(e => 'fullName' in e).map(e => e.id);
chk(withFull.join() === FULL.join() && FULL.every(id => nonEmpty(els.find(e => e.id === id).fullName)), 'fullName 只在 ' + FULL.join(',') + '（實際 ' + withFull.join(',') + '）');

// 5) tipOf（與 buildArrowElementsRow 內 tipOf 同格式；ST-27c 起改短版，完整說明在說明卡）
const tips = els.map(e => `${e.id} ${e.name}（點 ⓘ 看說明）`);
chk(tips.every(t => !t.includes('undefined')), 'tipOf 輸出無 undefined（例：' + JSON.stringify(tips[0]) + '）');

// 分佈
const dist = Object.fromEntries(TYPES.map(t => [t, els.filter(e => e.shape.type === t).length]));
const inferred = els.filter(e => e.shape.inferred).map(e => e.id);
console.log('shape 分佈：' + JSON.stringify(dist) + '；inferred ' + inferred.length + ' 項：' + inferred.join(','));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
