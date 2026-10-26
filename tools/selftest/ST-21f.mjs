// ST-21f 自測：手冊 manual.html 依六步分章、截圖重拍後的一致性
// 跑法：node tools/selftest/ST-21f.mjs   （Node 24+、/usr/bin/google-chrome；不重拍截圖，重拍用 node tools/capture-manual.mjs）
// 測：a 目錄第一層 <li> 數＝<section> 數，且順序、編號（0＝教學影片，1..N 對應 h2 前綴數字）一致；
//     b 所有 <a href="#..."> 都有對應 id、沒有重複 id；舊 26 章的 id 全部仍存在；
//     c 所有 <img> 載入成功（naturalWidth>0），manual/img/ 內每個 png 都被引用；
//     d index.html 的 GUIDE_CONTENT[k].manual 六個值都在手冊有 id，且依序是 ①–⑥ 章的 section id；
//     e 說明卡「📖 手冊」連結 href 與 GUIDE_CONTENT 一致；README 有六步小節與 st-21-regression 指令；
//     f 手冊與 index.html 載入無 console error。
// 截圖：$CLAUDE_JOB_DIR/tmp/st21f/manual-full.png（手冊全頁，縮 0.3 倍）、manual-toc.png（目錄原尺寸）
// 預期：全部 PASS，exit code 0。
import { launch } from '../cdp-harness.mjs';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const out = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/st21f'; mkdirSync(out, { recursive: true });
let fail = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fail++; };

const h = await launch({ width: 1200, height: 900 });
await h.open(resolve(root, 'manual.html'));
await h.ev(`Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))`);
const info = await h.ev(`(() => {
  const toc = [...document.querySelectorAll('.toc > ol > li')].map(li => li.querySelector('a').getAttribute('href').slice(1));
  const secs = [...document.querySelectorAll('section.panel')].map(s => ({ id: s.id, h: s.querySelector('h2').textContent.trim() }));
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
  const hrefs = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1));
  const imgs = [...document.images].map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth }));
  return { toc, secs, ids, hrefs, imgs };
})()`);
// a 目錄與章節
ok(info.toc.length === info.secs.length && info.toc.every((t, i) => t === info.secs[i].id), `a 目錄 ${info.toc.length} 項與 ${info.secs.length} 章順序一致`);
ok(info.secs.every((s, i) => i === 0 ? !/^\d/.test(s.h) : s.h.startsWith(i + '. ')), 'a 章節編號 0..' + (info.secs.length - 1) + ' 連續（0＝教學影片）');
// b 錨點
const idSet = new Set(info.ids);
ok(info.hrefs.every(x => idSet.has(x)), 'b 所有 #錨點都有對應 id' + info.hrefs.filter(x => !idSet.has(x)).join(','));
ok(idSet.size === info.ids.length, 'b 沒有重複 id');
const old = 'video quick guide title project vc roles template links products expand shortview cells ideas kinds arrows modules elements sentences premises actions control examples industry pptx save faq'.split(' ');
ok(old.every(o => idSet.has(o)), 'b 舊 26 章 id 全部保留' + old.filter(o => !idSet.has(o)).join(','));
// c 圖
ok(info.imgs.length > 0 && info.imgs.every(i => i.w > 0), `c ${info.imgs.length} 張圖全部載入` + info.imgs.filter(i => !i.w).map(i => i.src).join(','));
const files = readdirSync(resolve(root, 'manual/img')).filter(f => f.endsWith('.png')).map(f => 'manual/img/' + f);
const used = new Set(info.imgs.map(i => i.src));
ok(files.every(f => used.has(f)), 'c manual/img 每張 png 都有被引用' + files.filter(f => !used.has(f)).join(','));
// 全頁太高（數萬 px），直接截會卡住：縮成 0.3 倍再截；另截一張原尺寸的目錄
const fullH = await h.ev('document.documentElement.scrollHeight');
{ const { data } = await h.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1200, height: fullH, scale: 0.3 } });
  writeFileSync(out + '/manual-full.png', Buffer.from(data, 'base64')); }
await h.shot('.toc', out + '/manual-toc.png');
const manualErr = h.errors();
ok(manualErr.length === 0, 'f manual.html 無 console error ' + manualErr.join(' | '));

// d／e index.html 的手冊錨點
await h.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
await h.open(resolve(root, 'index.html'));
const g = await h.ev(`GUIDE_STEPS.map(s => ({ k: s.k, m: GUIDE_CONTENT[s.k].manual, a: document.querySelector('#guideCard-' + s.k + ' .guide-card-foot a')?.getAttribute('href') }))`);
const stepSecs = info.secs.filter(s => /^\d+\. [①②③④⑤⑥]/.test(s.h)).map(s => s.id);
ok(g.length === 6 && g.every(x => idSet.has(x.m)), 'd 六個 GUIDE_CONTENT.manual 都在手冊有 id：' + g.map(x => x.m).join(','));
ok(JSON.stringify(stepSecs) === JSON.stringify(g.map(x => x.m)), 'd ①–⑥ 章 id 依序等於 GUIDE_CONTENT.manual：' + stepSecs.join(','));
ok(g.every(x => x.a === 'manual.html#' + x.m), 'e 說明卡「📖 手冊」href 正確');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
ok(['① 經營流程', '② 策略點描述', '③ 策略構想', '④ 前提驗證', '⑤ 行動計畫', '⑥ 策略控制'].every(t => readme.includes('### ' + t)), 'e README 六步小節齊');
ok(readme.includes('node tests/st-21-regression.mjs') && readme.includes('#step-'), 'e README 有回歸指令與 #step-N 說明');
const idxErr = h.errors().slice(manualErr.length);
ok(idxErr.length === 0, 'f index.html 無 console error ' + idxErr.join(' | '));
await h.close();
console.log(fail ? `FAIL ${fail} 項` : 'ALL PASS', '截圖：' + out + '/manual-full.png');
process.exit(fail ? 1 : 0);
