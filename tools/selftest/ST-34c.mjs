// ST-34c 自測：優勢基礎改書上名稱與順序 [S 331–339]，舊名經 ADV_BASE_ALIASES 轉換。
// 跑法：node tools/selftest/ST-34c.mjs （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-34c/）。預期全 PASS、exit 0。
// 測：1) ADV_BASES 新順序；normaliseAdvBases 轉舊名、去重、照順序排。
//     2) fixtures/bookstore-a（含舊值 '資訊系統|F' bases:['能力','資訊科技']）塞 localStorage reload → 變 ['獨特能力','資訊科技之運用']，無 console error。
//     3) foundry-t fixture、兩範例載入無 console error；範例 bases 已是新值。
//     4) undo 快照含舊值時還原也會轉換（history 存 JSON 字串；改寫最後一筆塞舊值再 undo）。
//     5) exportPptx 不拋例外且某張 slide XML 含「獨特能力」。
//     6) 截圖 F 列策略點面板勾選區（七顆 chip 不溢出面板）。
// 另需手動跑：node tests/st-21-regression.mjs（c 區段 PPTX 預期因名稱變更出現差異）、sh tools/check-js.sh index.html。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-34c'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const ADV_OK = ['獨特能力', '獨佔力', '時機', '綜效', '財力', '關係', '資訊科技之運用'];
const fixture = id => JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')));

const h = await launch();
try {
  await h.open(html); await h.ev('localStorage.clear(); 0');
  // 1 常數與正規化
  ok(await h.ev(`ADV_BASES.join()`) === '獨特能力,獨佔力,時機,綜效,財力,關係,資訊科技之運用', 'ADV_BASES 新名稱與順序');
  ok(await h.ev(`normaliseAdvBases(['資訊科技','能力','獨特能力','亂寫','財力','綜效']).join()`) === '獨特能力,綜效,財力,資訊科技之運用', 'normaliseAdvBases 轉舊名、去重、照順序、濾未知');
  // 2 bookstore-a fixture（舊值）
  const raw = fixture('bookstore-a');
  ok(/"能力",\s*"資訊科技"/.test(JSON.stringify(JSON.parse(raw).cellNotes['資訊系統|F'].bases)), 'fixture 確實含舊值 能力/資訊科技');
  await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
  await h.open(html); await sleep(800);
  ok(await h.ev(`JSON.stringify(cellNotes['資訊系統|F'].bases)`) === '["獨特能力","資訊科技之運用"]', '舊存檔載入後 bases → 獨特能力、資訊科技之運用');
  ok(h.errors().length === 0, '[bookstore-a fixture] 無 console error ' + JSON.stringify(h.errors()));
  // 4 undo 快照含舊值
  await h.ev(`pushHistory(); (()=>{const s=JSON.parse(history[history.length-1]); s.cellNotes['資訊系統|F']={text:'x',vi:'',bases:['獨佔','能力']}; history[history.length-1]=JSON.stringify(s);})(); undo(); 0`);
  ok(await h.ev(`JSON.stringify(cellNotes['資訊系統|F'].bases)`) === '["獨特能力","獨佔力"]', 'undo 舊快照還原後 bases 轉新名');
  // 6 面板截圖（undo 已自動存檔，重塞舊值 fixture）
  await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
  await h.open(html); await sleep(800);
  await h.ev(`guideGoto('cells'); 0`); await sleep(500);
  await h.ev(`selectCell('F', COLUMNS.indexOf('資訊系統'), true); 0`); await sleep(500);
  const chips = await h.ev(`(()=>{const p=document.getElementById('cellPanel').getBoundingClientRect();const c=[...document.querySelectorAll('#cellPanel .cell-base-chip')];
    return {n:c.length,act:c.filter(e=>e.classList.contains('active')).map(e=>e.textContent),over:c.filter(e=>{const r=e.getBoundingClientRect();return r.right>p.right+0.5||r.left<p.left-0.5}).length}})()`);
  ok(chips.n === 7 && chips.over === 0, `面板七顆 chip 不溢出 ${JSON.stringify(chips)}`);
  ok(chips.act.join() === '獨特能力,資訊科技之運用', '面板勾選 獨特能力、資訊科技之運用');
  await h.shot('#cellPanel', `${out}/cell-panel-F.png`);
  await h.ev(`document.querySelector('#cellPanel .cell-base-chip').closest('.cell-opt-line').scrollIntoView(); 0`);
  await h.shot('#cellPanel .cell-base-chip', `${out}/chip-first.png`).catch(() => {});
  // 3 foundry-t fixture
  await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(fixture('foundry-t'))}); 0`);
  await h.open(html); await sleep(800);
  ok(h.errors().length === 0, '[foundry-t fixture] 無 console error ' + JSON.stringify(h.errors()));
} finally { await h.close(); }

for (const id of ['bookstore-a', 'foundry-t']) {
  const g = await launch();
  try {
    await g.open(html); await g.ev('localStorage.clear(); 0'); await g.open(html);
    await g.loadExample(id); await sleep(500);
    const all = await g.ev(`Object.values(cellNotes).flatMap(n=>n.bases)`);
    ok(all.length > 0 && all.every(b => ADV_OK.includes(b)), `[範例 ${id}] bases 都是新名稱 ${JSON.stringify(all)}`);
    await g.captureDownloads();
    const err = await g.ev(`(async()=>{try{await exportPptx();return ''}catch(e){return String(e&&e.stack||e)}})()`);
    ok(err === '', `[範例 ${id}] exportPptx 不拋例外 ${err}`);
    for (let i = 0; i < 40 && !(await g.downloads()).some(d => d.name && /pptx$/.test(d.name)); i++) await sleep(250);
    const idx = (await g.downloads()).findIndex(d => d.name && /pptx$/.test(d.name));
    let hit = false;
    if (idx >= 0) {
      const z = await g.zipEntries(idx);
      for (const n of z.names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))) if ((await z.read(n)).includes('獨特能力')) hit = true;
    }
    ok(idx >= 0 && hit, `[範例 ${id}] PPTX slide XML 含「獨特能力」`);
    ok(g.errors().length === 0, `[範例 ${id}] 無 console error ${JSON.stringify(g.errors())}`);
  } finally { await g.close(); }
}
process.exit(fail ? 1 : 0);
