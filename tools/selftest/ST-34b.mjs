// ST-34b 自測：專有名詞對齊課本。
// 跑法：node tools/selftest/ST-34b.mjs（需 Chrome；截圖到 $CLAUDE_JOB_DIR/tmp/ST-34b/）
// 測：兩份舊 fixtures 載入無 console error；矩陣表頭含「主導權責」（foundry-t 有角色時）；
//     產業矩陣開啟後 F 列標籤為 KSF；cellDefaultText 新字；exportPptx 不拋例外且 slide XML 含「策略前提控制表」「轉移陣地」。
// 預期：全 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = resolve(root, 'index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-34b'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

for (const id of ['bookstore-a', 'foundry-t']) {
  const raw = JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')));
  const h = await launch();
  try {
    await h.open(html); await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
    await h.open(html); await sleep(800);
    ok(h.errors().length === 0, `[${id}] fixture 載入無 console error ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

for (const id of ['bookstore-a', 'foundry-t']) {
  const h = await launch();
  try {
    await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
    await h.loadExample(id); await sleep(600);
    const lbl = await h.ev(`ROWS.find(r=>r.id==='F').leftLabel`);
    ok(lbl === 'KSF', `[${id}] ROWS F leftLabel=KSF（${lbl}）`);
    await h.ev(`guideGoto('cells'); 0`); await sleep(500);
    await h.ev(`if(!showIndustryLabels) toggleIndustryMatrix(); 0`); await sleep(400);
    const txt = await h.ev(`document.getElementById('matrixTable').innerText`);
    ok(/KSF/.test(txt) && !/KSF's/.test(txt), `[${id}] 產業矩陣標籤含 KSF 且無 KSF's`);
    const def = await h.ev(`[cellDefaultText({row:'A',col:0}),cellDefaultText({row:'F',col:0}),cellDefaultText({row:'B',col:0})].join('|')`);
    console.log('  cellDefaultText:', def);
    await h.ev(`document.getElementById('matrixTable').scrollIntoView(); 0`);
    await h.shot(null, `${out}/${id}-matrix.png`);
    await h.captureDownloads();
    let threw = false;
    try { await h.ev('exportPptx(); 0'); } catch (e) { threw = true; }
    for (let i = 0; i < 40 && !(await h.downloads()).some(d => d.name && /pptx$/.test(d.name)); i++) await sleep(250);
    const idx = (await h.downloads()).findIndex(d => d.name && /pptx$/.test(d.name));
    ok(!threw && idx >= 0 && h.errors().length === 0, `[${id}] exportPptx 無例外 ${JSON.stringify(h.errors())}`);
    const z = await h.zipEntries(idx); let all = '';
    for (const n of z.names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))) all += await z.read(n);
    ok(all.includes('策略前提控制表') && !all.includes('策略前提控制（監測）'), `[${id}] PPTX 含「策略前提控制表」`);
    if (id === 'foundry-t') ok(all.includes('轉移陣地') || !all.includes('須轉移'), `[${id}] PPTX 無「須轉移」${all.includes('轉移陣地') ? '（含轉移陣地）' : ''}`);
    ok(/〔主導權責〕|主導權責/.test(all) || !/〔主導〕/.test(all), `[${id}] PPTX 無舊「〔主導〕」`);
    const hd = await h.ev(`document.body.innerText.includes('主導權責') || VC_UNIT_ROLES.some(r=>r.label==='主導權責')`);
    ok(hd, `[${id}] 主導權責標籤存在`);
  } finally { await h.close(); }
}
console.log(fail ? 'FAIL' : 'ALL PASS'); process.exit(fail ? 1 : 0);
