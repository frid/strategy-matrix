// ST-25 自測：字級收斂到 --fs-xs/sm/base/md/lg 五階（h1 2rem 例外）。
// 跑法：node tools/selftest/ST-25.mjs            （after；需 Chrome；截圖 $CLAUDE_JOB_DIR/tmp/st25/after/）
//       HTML=/path/base.html LABEL=before node tools/selftest/ST-25.mjs   （改前基準；只跑動態量測＋截圖，跳過檢查）
//       BASE_W=<before 印出的 matrixW> 可啟用 #matrixTable 寬度差 < 5% 檢查
// 測了什麼：(a) 靜態：index.html／manual.html 內所有 font-size 無 px，值皆 var(--fs-*) / 2rem / 1.5rem(manual h1 窄螢幕) / 150% / inherit；
//   (b) 動態：bookstore-a 六 tab 各截整頁；全頁可見文字元素 computed font-size distinct ≤ 6 並列分佈；
//   ③ .sentence-list 與 .arrow-item 同字級；價值鏈 .vc-group 寬 200px；六 tab scrollWidth ≤ 1400；console error 0。
// 預期：after 全 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const label = process.env.LABEL || 'after';
const html = process.env.HTML || resolve(root, 'index.html');
const tmp = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st25';
const out = `${tmp}/${label}`; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

if (label === 'after') {
  for (const f of ['index.html', 'manual.html']) {
    const src = readFileSync(resolve(root, f), 'utf8');
    const vals = [...src.matchAll(/font-size:\s*([^;}"']+)/g)].map(m => m[1].trim());
    const bad = vals.filter(v => !/^(var\(--fs-(xs|sm|base|md|lg)\)|2rem|1\.5rem|150%|inherit)$/.test(v));
    ok(bad.length === 0, `${f} 靜態：font-size ${vals.length} 處，非變數／例外值 ${JSON.stringify(bad)}`);
    ok(!/font-size:\s*[\d.]+px/.test(src), `${f} 無 px 字級`);
  }
}

const h = await launch();
const tabs = ['chain', 'cells', 'ideas', 'premise', 'action', 'control'];
const dist = {}; const res = {};
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.loadExample('bookstore-a');
  for (const [i, k] of tabs.entries()) {
    await h.ev(`guideGoto('${k}'); 0`); await sleep(700);
    if (k === 'cells') { await h.ev(`selectCell('A', 0, true); 0`); await sleep(400); }
    const d = await h.ev(`(()=>{const m={};document.querySelectorAll('body *').forEach(e=>{
      if(e.closest('script,style,svg')||!e.getClientRects().length) return;
      const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
      const isCtl=/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.tagName);
      if(!own&&!isCtl) return;
      const fs=getComputedStyle(e).fontSize; (m[fs]=m[fs]||[]).push(e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:''));
    });return Object.fromEntries(Object.entries(m).map(([k,v])=>[k,{n:v.length,ex:[...new Set(v)].slice(0,4)}]))})()`);
    for (const [fs, v] of Object.entries(d)) { dist[fs] = dist[fs] || { n: 0, ex: new Set() }; dist[fs].n += v.n; v.ex.forEach(x => dist[fs].ex.add(x)); }
    await h.shot(null, `${out}/${i + 1}-${k}.png`);
    if (k === 'ideas') {
      res.sentence = await h.ev(`(()=>{const a=document.querySelector('.sentence-list li')||document.querySelector('.sentence-list'), b=document.querySelector('.arrow-item');return {s:a&&getComputedStyle(a).fontSize,a:b&&getComputedStyle(b).fontSize, sbox:!!document.querySelector('.sentence-box')}})()`);
      res.matrixW = await h.ev(`document.getElementById('matrixTable').getBoundingClientRect().width`);
    }
    if (k === 'chain') res.vcW = await h.ev(`[...document.querySelectorAll('.vc-group')].map(e=>Math.round(e.getBoundingClientRect().width))`);
    if (k === 'premise') res.premise = await h.ev(`['.premise-quad','.premise-swot-stats','.premise-swot-hint','.clash-item','.arrow-item'].map(s=>{const e=document.querySelector(s);return s+'='+(e&&getComputedStyle(e).fontSize)})`);
    if (k === 'action') res.action = await h.ev(`['.action-toolbar','.action-table','.action-table input','.action-table select'].map(s=>{const e=document.querySelector(s);return s+'='+(e&&getComputedStyle(e).fontSize)})`);
    res['sw_' + k] = await h.ev('document.documentElement.scrollWidth');
  }
  console.log(label, 'distinct computed font-size:\n  ' + Object.entries(dist).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([k, v]) => `${k}×${v.n}[${[...v.ex].join(',')}]`).join('\n  '));
  console.log(label, JSON.stringify(res));
  if (label === 'after') {
    ok(Object.keys(dist).length <= 6, `distinct font-size ${Object.keys(dist).length} ≤ 6`);
    ok(res.sentence.sbox && res.sentence.s === res.sentence.a, `③ sentence-list ${res.sentence.s} == arrow-item ${res.sentence.a}`);
    const bw = Number(process.env.BASE_W);
    if (bw) ok(Math.abs(res.matrixW - bw) / bw < 0.05, `#matrixTable 寬 ${res.matrixW | 0} vs 基準 ${bw | 0}`);
    ok(res.vcW.every(w => w === 200), `.vc-group 寬（範例無群組則為空，群組寬度由 ST-22/23a 驗）${res.vcW}`);
    ok(tabs.every(k => res['sw_' + k] <= 1400), '六 tab scrollWidth ≤ 1400 ' + tabs.map(k => res['sw_' + k]));
    ok(h.errors().length === 0, `無 console error ${JSON.stringify(h.errors())}`);
  }
} finally { await h.close(); }
process.exit(fail ? 1 : 0);
