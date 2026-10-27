// ST-38 自測：≤800px 直排時群組內子項名稱不直書。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-38.mjs （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-38/）
// 測了什麼：800x900 載入 bio-aesthetic，六版型每個 .vc-unit 名稱 textarea scrollHeight<=clientHeight+2 且 clientWidth>=120；
//   頁面 scrollWidth==clientWidth；1400 寬 porter 的 .vc-zones outerHTML 與 dev 相同（比對 $BASE_SIG 檔，無則只印長度）。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = process.env.HTML || root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-38'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
async function load(w) {
  const h = await launch({ width: w, height: 900 });
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.loadExample('bio-aesthetic');
  await h.ev(`guideGoto('chain'); 0`); await sleep(700);
  return h;
}
{
  const h = await load(800);
  for (const l of ['porter', 'band', 'segment', 'fold', 'hex', 'circle']) {
    await setLayout(h, l);
    const r = await h.ev(`(()=>{const bad=[];let n=0;document.querySelectorAll('#valueChainEditor .vc-unit').forEach(u=>{
      const t=u.querySelector(':scope > .vc-node-head textarea'); if(!t||!t.offsetParent) return; n++;
      if(t.scrollHeight>t.clientHeight+2||t.clientWidth<120) bad.push({id:u.dataset.vcId,sh:t.scrollHeight,ch:t.clientHeight,cw:t.clientWidth});});
      return {n,bad:bad.slice(0,5),nb:bad.length,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}})()`);
    ok(r.n > 0 && r.nb === 0, `[800 ${l}] ${r.n} units 名稱橫排 ${JSON.stringify(r.bad)}`);
    ok(r.sw === r.cw, `[800 ${l}] 無橫向捲動 ${r.sw}/${r.cw}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/${l}-800.png`);
  }
  ok(h.errors().length === 0, 'console error 0'); await h.close?.();
}
{
  const h = await load(1400);
  const sig = await h.ev(`document.querySelector('.vc-zones').outerHTML`);
  const f = process.env.BASE_SIG;
  if (f && existsSync(f)) ok(readFileSync(f, 'utf8') === sig, '[1400 porter] .vc-zones 與基準相同');
  else { if (f) writeFileSync(f, sig); console.log('1400 porter sig length', sig.length); }
  await h.close?.();
}
process.exit(fail ? 1 : 0);
