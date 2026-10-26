// ST-21c 自測：六步說明卡（GUIDE_CONTENT 渲染、手冊連結、上一步／下一步、收合記憶）
// 跑法：node tools/selftest/ST-21c.mjs   （Node 24+、/usr/bin/google-chrome）
// 測：載 bookstore-a，六步各檢查說明卡 purpose／引文數／延伸頁碼／todo、checks 條數／手冊 href／
//   上一步（第一步無）下一步（最後一步無）按鈕；按「下一步」guideStep 前進；
//   收合一張 → guideOpen=false、其他卡同步收合、reload 後仍收合；舊存檔 fixture 載入無 error；h.errors() 空。
// 截圖：$CLAUDE_JOB_DIR/tmp/st21c/step-1..6.png
// 預期：全部 PASS，exit code 0。
import { launch } from '../cdp-harness.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const html = resolve(here, '../../index.html');
const fixture = readFileSync(resolve(here, '../../tests/fixtures/strategyMatrix_v4-bookstore-a.json'), 'utf8');
const out = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/st21c'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const KEYS = ['chain', 'cells', 'ideas', 'premise', 'action', 'control'];

const h = await launch();
try {
  await h.open(html);
  await h.ev('localStorage.clear(); 0');
  await h.open(html);
  await h.loadExample('bookstore-a');
  for (let n = 1; n <= 6; n++) {
    const k = KEYS[n - 1];
    await h.ev(`guideGoto(${JSON.stringify(k)}); 0`); await sleep(400);
    const r = await h.ev(`(()=>{const c=document.getElementById('guideCard-${k}'), C=GUIDE_CONTENT['${k}'];
      const box=c.querySelector('details.guide-card-box'); if(!box) return null;
      const a=c.querySelector('.guide-card-foot a');
      return { purpose: box.textContent.includes(C.purpose), quotes: c.querySelectorAll('blockquote').length, quoteN: C.quote.length,
        pages: box.textContent.includes('延伸閱讀：'+C.pages), li: c.querySelectorAll('li').length, liN: C.todo.length+C.checks.length,
        href: a && a.getAttribute('href'), manual: C.manual, prev: !!c.querySelector('.guide-prev'), next: !!c.querySelector('.guide-next'),
        open: box.open, vis: c.offsetParent!==null,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }})()`);
    ok(r && r.purpose, `${n} ${k}：purpose 文字`);
    ok(r && r.quotes === r.quoteN, `${n} ${k}：引文數 ${r && r.quotes}/${r && r.quoteN}`);
    ok(r && r.pages && r.li === r.liN, `${n} ${k}：延伸頁碼、todo＋checks 條數`);
    ok(r && r.href === `manual.html#${r.manual}`, `${n} ${k}：手冊連結 ${r && r.href}`);
    ok(r && r.prev === (n > 1) && r.next === (n < 6), `${n} ${k}：上一步／下一步按鈕（${r && r.prev}／${r && r.next}）`);
    ok(r && r.open && r.vis && !r.overflow, `${n} ${k}：展開、可見、頁面無橫向溢出`);
    await h.shot(null, `${out}/step-${n}.png`);
  }
  // 下一步／上一步
  await h.ev(`guideGoto('chain'); 0`); await sleep(300);
  await h.ev(`document.querySelector('#guideCard-chain .guide-next').click(); 0`); await sleep(300);
  ok(await h.ev('guideStep') === 'cells', '按下一步 chain → cells');
  await h.ev(`document.querySelector('#guideCard-cells .guide-prev').click(); 0`); await sleep(300);
  ok(await h.ev('guideStep') === 'chain', '按上一步 cells → chain');
  // 收合
  await h.ev(`document.querySelector('#guideCard-chain details').open=false; 0`); await sleep(400);
  ok(await h.ev('guideOpen') === false, '收合後 guideOpen=false');
  ok(await h.ev(`[...document.querySelectorAll('.guide-card-box')].every(d=>!d.open)`), '六張卡同步收合');
  await h.ev(`guideGoto('cells'); 0`); await sleep(300);
  ok(await h.ev(`document.querySelector('#guideCard-cells details').open`) === false, '切 tab 後仍收合');
  await h.open(html); await sleep(500);
  ok(await h.ev('guideOpen') === false && await h.ev(`[...document.querySelectorAll('.guide-card-box')].every(d=>!d.open)`), 'reload 後仍收合');
  await h.ev(`document.querySelector('#guideCard-chain details').open=true; 0`); await sleep(400);
  ok(await h.ev('guideOpen') === true && await h.ev(`[...document.querySelectorAll('.guide-card-box')].every(d=>d.open)`), '重新展開後全部展開');
  ok(h.errors().length === 0, '全程無 console error ' + JSON.stringify(h.errors()));
  // 舊存檔
  await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(fixture)}); 0`);
  const before = h.errors().length;
  await h.open(html); await sleep(600);
  ok(h.errors().length === before, '舊存檔載入無 console error ' + JSON.stringify(h.errors().slice(before)));
  ok(await h.ev(`document.querySelectorAll('.guide-card-box').length`) === 6, '舊存檔：六張說明卡');
} finally { await h.close(); }
console.log(fail ? `FAIL ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
