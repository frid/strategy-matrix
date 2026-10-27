// ST-45 自測：主要活動括號改在列左側直書，與支援活動括號同樣式。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-45.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-45/）
// 測了什麼：bookstore-a 載入後逐一切 porter/band/fold/segment/circle/hex 六版型（1440 寬），
//   檢查 .vc-primary-label 在 .vc-activities-row 左側、writing-mode=vertical-rl、與 .vc-support-label 邊框相同，
//   各截 .vc-zones 圖；console error 0。
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-45'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const h = await launch();
try {
  await h.open(root + '/index.html'); await h.ev('localStorage.clear(); 0'); await h.open(root + '/index.html');
  await h.loadExample('bookstore-a');
  await h.ev(`guideGoto('chain'); 0`); await sleep(700);
  for (const k of ['porter', 'band', 'fold', 'segment', 'circle', 'hex']) {
    await h.ev(`valueChain.layout='${k}'; commitValueChain(); 0`); await sleep(400);
    const r = await h.ev(`(()=>{const p=document.querySelector('.vc-primary-label'),s=document.querySelector('.vc-support-label'),a=document.querySelector('.vc-activities-row');
      const R=e=>e.getBoundingClientRect(),cs=e=>getComputedStyle(e);
      return {wm:cs(p).writingMode,swm:cs(s).writingMode,left:R(p).right<=R(a).left+1,bl:cs(p).borderLeftWidth,sbl:cs(s).borderLeftWidth,br:cs(p).borderRightWidth,bb:cs(p).borderBottomWidth,sbb:cs(s).borderBottomWidth,
        hmatch:Math.abs(R(p).height-R(a).height)<=1}})()`);
    ok(r.wm === 'vertical-rl' && r.wm === r.swm && r.left && r.bl === r.sbl && r.bb === r.sbb && r.br === '0px', `[${k}] ${JSON.stringify(r)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/${k}.png`);
  }
  const errs = h.errors(); ok(errs.length === 0, 'console error 0 ' + JSON.stringify(errs));
} finally { await h.close(); }
process.exit(fail ? 1 : 0);
