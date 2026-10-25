// ST-19 自測：harness 載入 tests/fixtures 舊存檔 → reload → 無錯誤 → 矩陣容器存在 → 截圖。
// 跑法：node tools/selftest/ST-19.mjs [index.html 路徑，預設 repo 根的 index.html]
// 預期：每份 fixture 輸出 PASS（errors() 為空、矩陣容器存在），截圖在 $CLAUDE_JOB_DIR/tmp/ST-19/<fixture>.png。
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launch } from '../cdp-harness.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const html = resolve(process.argv[2] || resolve(here, '../../index.html'));
const fxDir = resolve(here, '../../tests/fixtures');
const out = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/ST-19'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const chk = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++; };
const h = await launch();
for (const f of readdirSync(fxDir).filter(x => x.endsWith('.json'))) {
  await h.open(html);
  const raw = JSON.stringify(JSON.parse(readFileSync(fxDir + '/' + f, 'utf8')));
  await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
  await h.send('Page.reload'); await sleep(1500); await h.stubDialogs();
  const err = h.errors();
  chk(err.length === 0, `${f} 無 console/例外錯誤 ${err.join(' | ')}`);
  const sel = await h.ev(`['#matrix','#matrixContainer','.matrix-wrap','table.matrix','main'].find(s=>document.querySelector(s))||null`);
  chk(!!sel, `${f} 矩陣容器存在（${sel}）`);
  chk(await h.ev(`document.querySelectorAll('td,.cell').length > 0`), `${f} 有格子`);
  await h.shot(null, `${out}/${f.replace('.json', '')}.png`);
}
// 大檔下載：bookstore-a 的 PPTX（>3MB）要能在 10 秒內經 blobBytes 分塊取回
{
  await h.open(html); await h.captureDownloads(); await h.loadExample('bookstore-a');
  const t0 = Date.now();
  await h.ev('exportPptx()'); await sleep(1500);
  const ds = await h.downloads();
  chk(ds.length === 1 && /pptx/i.test(ds[0].name + ds[0].type), `downloads() 1 筆 pptx（${JSON.stringify(ds)}）`);
  const buf = await h.blobBytes(0);
  chk(buf.length === ds[0].size, `blobBytes 長度 ${buf.length} == size ${ds[0].size}`);
  chk(Date.now() - t0 <= 10000, `耗時 ${Date.now() - t0}ms ≤ 10000`);
  const z = await h.zipEntries(0);
  chk(z.names.includes('ppt/slides/slide1.xml') && (await z.read('ppt/slides/slide1.xml')).length > 0, 'zip 內有 ppt/slides/slide1.xml');
}
await h.close();
process.exit(fail ? 1 : 0);
