// ST-42 自測：經典 Porter＋分色藍綠紫下，群組內單元名稱橫排（不再一字一行）；其他版型版面不變。
// 跑法：node tools/selftest/ST-42.mjs [--sig]   （需 Chrome；截圖寫 tools/selftest/out/ST-42-*.png）
//   --sig：只輸出各版型群組內 textarea 的 rect 簽章 JSON（用 ST42_HTML=<改前 index.html 路徑> 跑基準，再跑現版 diff）
// 測了什麼：bio-aesthetic 展開，Porter＋分色藍綠紫，群組內每個 textarea.vc-name-wrap clientWidth ≥ 3em 且高度 ≤ 2 行；
//   band／segment／hex／fold／circle 群組內 textarea rect 與改前一致（比對 ST42_HTML 基準；未提供基準則只印簽章）。
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = process.env.ST42_HTML || root + '/index.html';
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), 'out'); mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
const setPalette = async (h, label) => { await h.ev(`(()=>{const s=document.getElementById('paletteSelect');const o=[...s.options].find(o=>o.textContent.includes(${JSON.stringify(label)}));s.value=o.value;s.dispatchEvent(new Event('change'));})(); 0`); await sleep(400); };
const sigJs = `JSON.stringify([...document.querySelectorAll('.vc-zone-primary .vc-group-body > .vc-unit > .vc-node-head > textarea.vc-name-wrap')].map(t=>{const r=t.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]}))`;
const h = await launch({ width: 1400, height: 1000 });
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.ev(`guideGoto('chain'); loadValueChainTemplate('bio-aesthetic'); expandValueChainToMatrix(true); 0`); await sleep(700);
  await setPalette(h, '分色');
  const sigs = {};
  for (const lay of ['porter', 'band', 'segment', 'hex', 'fold', 'circle']) {
    await setLayout(h, lay);
    if (lay === 'fold') await h.ev(`document.querySelector('.vc-fold-all[data-fold="open"]').click(); 0`).then(() => sleep(300));
    sigs[lay] = await h.ev(sigJs);
    if (lay === 'porter' && !process.argv.includes('--sig')) {
      const m = await h.ev(`(()=>{const f=parseFloat(getComputedStyle(document.body).fontSize);return [...document.querySelectorAll('.vc-zone-primary .vc-group-body > .vc-unit > .vc-node-head > textarea.vc-name-wrap')].map(t=>{const cs=getComputedStyle(t);const fs=parseFloat(cs.fontSize);return {v:t.value,w:t.clientWidth,fs,h:t.scrollHeight,lh:parseFloat(cs.lineHeight)||fs*1.35}})})()`);
      ok(m.length >= 10, `Porter 群組內單元 ${m.length} 個`);
      const bad = m.filter(x => x.w < 3 * x.fs);
      ok(!bad.length, `名稱 clientWidth ≥ 3 字寬 ${JSON.stringify(bad)}`);
      const tall = m.filter(x => x.h > 2.2 * x.lh);
      ok(!tall.length, `名稱高度 ≤ 2 行 ${JSON.stringify(tall)}`);
      await h.shot('#valueChainEditor .vc-zones', outDir + '/ST-42-porter.png');
    }
  }
  if (process.argv.includes('--sig')) { console.log(JSON.stringify(sigs)); }
  else {
    const f = outDir + '/ST-42-sig.json';
    if (process.env.ST42_HTML) { writeFileSync(f, JSON.stringify(sigs)); console.log('基準簽章已寫入 ' + f); }
    else {
      try { const base = JSON.parse(readFileSync(f, 'utf8'));
        for (const lay of ['band', 'segment', 'hex', 'fold', 'circle']) ok(base[lay] === sigs[lay], `[${lay}] 群組內 textarea rect 與改前一致`);
      } catch { console.log('（無基準簽章，略過非 Porter 比對；先用 ST42_HTML=改前檔 跑一次）'); }
    }
  }
  const e = h.errors(); ok(!e.length, 'console 無錯誤 ' + e);
} finally { await h.close(); }
process.exit(fail ? 1 : 0);
