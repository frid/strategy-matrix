// ST-22 自測：隱藏的 ① 頁籤渲染後切回，主要活動名稱 textarea 不得為 0 高；主「載入」價值鏈檔不取代專案。
// 跑法：node tools/selftest/ST-22.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/st22/）
// 預期：5 行 PASS、exit 0。完整回歸見 tests/st-21-regression.mjs 的 e 區段（內容相同）。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const html = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/st22'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h, file) { await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file); }
// e ST-22 價值鏈名稱高度：隱藏的 ① 頁籤渲染後切回，textarea 不可為 0 高；主「載入」價值鏈檔不取代專案
{
  const nameH = `(()=>{const t=[...document.querySelectorAll('#valueChainEditor textarea.vc-name-wrap')];return {n:t.length,min:t.length?Math.min(...t.map(e=>e.offsetHeight)):0}})()`;
  const tpl = `JSON.parse(JSON.stringify(VC_TEMPLATES.find(x=>x.id==='bio-pharma-tw').valueChain))`;
  const h = await launch();
  try {
    await fresh(h, html);
    await h.ev(`(()=>{valueChain=normaliseValueChain(${tpl});resetValueChainIds(valueChain);commitValueChain();guideGoto('ideas');})(); 0`); await sleep(600);
    await h.open(html); await sleep(800);  // 存檔 guideStep=ideas，① 隱藏狀態下渲染
    await h.ev(`guideGoto('chain'); 0`); await sleep(600);
    let r = await h.ev(nameH);
    ok(r.n > 0 && r.min > 10, `[e] 重新整理後切回 ① 主要活動名稱 offsetHeight 最小 ${r.min}（共 ${r.n}）`);
    await h.shot(null, `${out}/e-reload-chain.png`);

    await fresh(h, html); await h.loadExample('bookstore-a');
    await h.ev(`guideGoto('ideas'); 0`); await sleep(500);
    const a0 = await h.ev('arrows.length');
    let applied = true;
    try { await h.ev(`applyImportedValueChain({kind:'strategyMatrix.valueChain',valueChain:${tpl}}); 0`); } catch (e) { applied = false; }
    await sleep(300);
    await h.ev(`guideGoto('chain'); 0`); await sleep(600);
    r = await h.ev(nameH);
    ok(applied && r.n > 0 && r.min > 10, `[e] 他 tab 套用價值鏈後切回 ① 名稱 offsetHeight 最小 ${r.min}（共 ${r.n}）`);
    ok(applied && await h.ev('arrows.length') === a0 && a0 > 0, `[e] 套用價值鏈後 arrows 數量不變（${a0}）`);

    // 主「載入」流程：模擬選檔，kind 為價值鏈 → 不 reload、不取代專案
    await h.ev(`window.__noReload=1; window.__vcFile=JSON.stringify({kind:'strategyMatrix.valueChain',v:1,title:'x',valueChain:${tpl}}); 0`);
    const title0 = await h.ev(`document.getElementById('strategyTitle').value`);
    const res = await h.ev(`(async()=>{
      const orig=document.createElement; let inp=null;
      document.createElement=function(t){const e=orig.call(document,t); if(t==='input'){inp=e; e.click=()=>{};} return e;};
      importStateJSON(); document.createElement=orig;
      Object.defineProperty(inp,'files',{value:[{text:async()=>window.__vcFile}]});
      await inp.onchange();
      const st=JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {marker:window.__noReload===1, arrows:arrows.length, title:document.getElementById('strategyTitle').value, hasVc:Array.isArray(st.arrows)&&st.arrows.length===arrows.length};
    })()`);
    ok(res.marker && res.arrows === a0 && res.title === title0 && res.hasVc, `[e] 主載入價值鏈檔：未 reload、arrows 仍 ${res.arrows}、標題不變 ${JSON.stringify(res)}`);
    ok(h.errors().length === 0, `[e] 無 console error ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}
process.exit(fail ? 1 : 0);
