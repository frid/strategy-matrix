// ST-47 自測：node tools/selftest/ST-47.mjs（需 playwright，已在 node_modules）
// 375／800／801 × porter／circle，印 scrollWidth 與溢出元素；截圖寫到 $CLAUDE_JOB_DIR/tmp/st47/。預期 scrollWidth <= 寬度。
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/st47'; fs.mkdirSync(out, { recursive: true });
const url = new URL('../../index.html', import.meta.url).href;
const b = await chromium.launch(); const page = await b.newPage();
page.on('dialog', d => d.accept());
for (const w of [375, 800, 801]) for (const l of ['porter', 'circle']) {
  await page.setViewportSize({ width: w, height: 800 });
  await page.goto(url); await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => loadValueChainTemplate('bio-aesthetic')); await page.evaluate(() => guideGoto('chain'));
  await page.evaluate(x => { valueChain.layout = x; commitValueChain(); }, l);
  const r = await page.evaluate(() => {
    const W = document.documentElement.clientWidth, bad = [];
    document.querySelectorAll('#valueChainEditor *').forEach(e => { const q = e.getBoundingClientRect(); if (q.right > W + 1 && q.width) bad.push(e.className + ' w=' + Math.round(q.width) + ' r=' + Math.round(q.right)); });
    return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 6) };
  });
  console.log(w, l, JSON.stringify(r));
  await page.locator('#valueChainEditor').screenshot({ path: `${out}/${w}-${l}.png` });
}
await b.close();
