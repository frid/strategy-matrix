// ST-34a 自測：專有名詞對照第一批（只改顯示文字與 tooltip，不碰 PPTX 與存檔常數）。
// 跑法：node tools/selftest/ST-34a.mjs （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/st34a/）。預期全 PASS、exit 0。
// 測：靜態 grep 舊字串消失；h2 文字；③ 說明卡／GUIDE_STEPS；列頭 title 含 [S 279；前提類型 desc 含 S 378；價值鏈區 title。
// 另需手動跑：node tests/st-21-regression.mjs（c 區段 PPTX 逐張相同）、sh tools/check-js.sh index.html。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st34a'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const src = readFileSync(html, 'utf8');
for (const t of ['策略要素之間', '新增策略名稱', '主活動後面', '策略矩陣展開', '清除目前策略'])
  ok(!src.includes(t), '靜態：不含「' + t + '」');
ok(!/個策略(?![構點動模要])/.test(src), '靜態：無「個策略」（非「個策略構想」）');
ok(!/一個策略['`]/.test(src.replace(/至少保留一個策略構想/g, '')), '靜態：無「一個策略」結尾');
const h = await launch();
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.loadExample('bookstore-a');
  const h2 = await h.ev(`[...document.querySelectorAll('h2.section-title')].map(e=>e.textContent)`);
  ok(h2.includes('策略矩陣') && !h2.includes('策略矩陣展開'), 'h2 策略矩陣：' + JSON.stringify(h2));
  ok(h2.includes('經營流程（價值鏈）'), 'h2 經營流程（價值鏈）');
  ok(await h.ev(`GUIDE_STEPS.find(g=>g.k==='ideas').points[0].includes('策略點之間的因果')`), 'GUIDE_STEPS ③ 策略點之間');
  ok(await h.ev(`document.getElementById('compNameInput').placeholder === '新增策略構想名稱'`), 'placeholder');
  ok(await h.ev(`/清除目前構想/.test(document.querySelector('.action-bar button[onclick*=clearCompetitor]').textContent)`), '按鈕 清除目前構想');
  ok(await h.ev(`PREMISE_TYPES.find(p=>p.k==='causal').desc.includes('S 378')`), '因果認知 desc 含 S 378');
  ok(await h.ev(`PREMISE_TYPES.find(p=>p.k==='causal').label === '因果認知前提'`), '因果認知 label 未動');
  ok(await h.ev(`ROWS.map(r=>r.rightLabel).join()==='產品,市場,垂直,規模,地理,競優' && ROWS[5].leftLabel==="KSF's"`), 'ROWS 簡稱未動');
  await h.ev(`guideGoto('ideas'); 0`); await sleep(700);
  ok(await h.ev(`[...document.querySelectorAll('.panel-title')].some(e=>e.textContent.includes('一個策略構想＝一套策略方案'))`), '③ 說明文字含加註');
  const t = await h.ev(`[...document.querySelectorAll('td.row-label-left, td.row-label-right')].map(e=>e.title)`);
  ok(t.length >= 12 && t.every(x => x.includes('[S 279')), '列頭 title 皆含 [S 279：' + t[0]);
  ok(await h.ev(`document.getElementById('industryToggleBtn').title.includes('司徒講義')`), '產業矩陣 title');
  ok(await h.ev(`document.querySelector('label.short-view-toggle').title.includes('P3 57')`), '短版 title');
  ok(await h.ev(`document.querySelector('.vc-support-label').title.includes('S 271') && document.querySelector('.vc-primary-label').title.includes('S 271')`), '支援／主要活動括號 title');
  ok(await h.ev(`[...document.querySelectorAll('.vc-zone-support > .vc-zone-title, .vc-zone-primary > .vc-zone-title')].every(e=>e.title.includes('S 271'))`), '區標題 title');
  ok(await h.ev(`!!document.querySelector('.vc-margin-arrow') ? document.querySelector('.vc-margin-arrow').title.includes('S 271') : true`), 'Margin title');
  ok(await h.ev(`document.querySelector('.col-item-add').title === '新增價值單元'`), '＋ 單元 title');
  await h.shot(null, `${out}/step3-card.png`);
  await h.ev(`document.getElementById('secMatrix').scrollIntoView(); 0`); await sleep(300);
  await h.shot(null, `${out}/matrix-title.png`);
  await h.ev(`selectCell('A', 0, true); 0`);
  await h.ev(`setMode('describe'); 0`); await sleep(300);
  ok(await h.ev(`/投入欄（價值單元）|產出欄（產品）/.test(document.getElementById('cellPanel').innerText)`), '策略點面板 投入欄（價值單元）');
  const errs = h.errors ? h.errors() : [];
  ok(errs.length === 0, 'console error 0 ' + JSON.stringify(errs));
} finally { await h.close(); }
process.exit(fail ? 1 : 0);
