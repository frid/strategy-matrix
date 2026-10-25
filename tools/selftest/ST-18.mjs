// ST-18 自測：PPTX 價值鏈頁的「產品」列與「主要活動 → 產品」連線
// 跑法（Node 24+、/usr/bin/google-chrome）：  node tools/selftest/ST-18.mjs [基準版 index.html 路徑，預設 ../dev/index.html]
// 測：載入「網路書店 A 公司」範例 → 攔截 JSZip.generateAsync 取 slide1.xml →
//   1) 有「產品」標籤、3 個產品方塊；2) 「客服→中文書籍」連線存在（多段，最後一段帶 tailEnd）；
//   3) 所有 shape 的 y+h 不超出價值鏈區（取 slide 高 5143500 - 邊界，這裡用 slide 底 5143500 當上限）；
//   4) 與基準版（dev）同流程匯出的 slide1 比對主活動／支援活動 shape 座標差異（說明 unitH 縮放幅度）。
// 另截一張畫面價值鏈區到 $CLAUDE_JOB_DIR/tmp/ST-18-vc.png。預期輸出全部 PASS。
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const newHtml = resolve(here, '../../index.html');
const baseHtml = resolve(process.argv[2] || join(here, '../../../dev/index.html'));
const tmp = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp'; mkdirSync(tmp, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(file, shotPath) {
  const PORT = 9400 + Math.floor(Math.random() * 500);
  const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox', '--disable-gpu',
    `--user-data-dir=${tmp}/prof-${PORT}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  try {
    let t; for (let i = 0; i < 60; i++) { try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(x => x.type === 'page'); if (t) break; } catch {} await sleep(250); }
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
    let seq = 0; const pend = new Map();
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pend.set(id, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'file://' + file }); await sleep(1500);
    await ev(`window.confirm=()=>true; window.alert=()=>{}; window.prompt=()=>null; HTMLAnchorElement.prototype.click=function(){};
      const g=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g.apply(this,a);}; 0`);
    await ev(`loadExampleProject('bookstore-a'); 0`); await sleep(500);
    const links = await ev(`JSON.stringify(valueChain.links.map(l=>[l.from,l.to]).map(([a,b])=>{const f=id=>{let r=null;const w=(l)=>l.forEach(n=>{if(n.id===id)r=n.name;if(n.children)w(n.children)});w(valueChain.primary);w(valueChain.support);w(valueChain.products);return r};return f(a)+'→'+f(b)}))`);
    await ev(`exportPptx()`); await sleep(1500);
    const xml = await ev(`window.__zip.file('ppt/slides/slide1.xml').async('string')`);
    if (shotPath) {
      const r = await ev(`(()=>{const e=document.querySelector('.vc-products-panel');const q=document.getElementById('vcArea')||document.querySelector('.vc-wrap, #valueChainSection, .value-chain')||e.parentElement;const a=q.getBoundingClientRect();return {x:a.left,y:a.top+scrollY,w:a.width,h:a.height}})()`);
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h, scale: 1 } });
      writeFileSync(shotPath, Buffer.from(data, 'base64'));
    }
    return { xml, links };
  } finally { chrome.kill(); }
}
const parse = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
  const s = m[0]; const nm = (s.match(/name="([^"]*)"/) || [])[1];
  const o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/) || [];
  return { kind: m[1], name: nm, x: +o[1], y: +o[2], w: +o[3], h: +o[4], tail: /tailEnd/.test(s) };
});
let fail = 0; const chk = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };
const N = await run(newHtml, tmp + '/ST-18-vc.png');
const B = await run(baseHtml, null);
console.log('範例 links：', N.links);
const ns = parse(N.xml), bs = parse(B.xml);
chk(ns.some(s => s.name === '產品'), '有「產品」標籤');
for (const n of ['中文書籍', '專業書籍', '影音商品']) chk(ns.filter(s => s.kind === 'sp' && s.name === n).length === 1, `產品方塊「${n}」`);
const cx = ns.filter(s => s.kind === 'cxnSp' && /^價值鏈連線 1/.test(s.name));
chk(cx.length >= 1, `連線 1 有 ${cx.length} 段（${cx.map(c => c.name).join(',')}）`);
chk(cx.length > 0 && cx[cx.length - 1].tail && cx.slice(0, -1).every(c => !c.tail), '最後一段帶 tailEnd、前段沒有');
const pr = ns.find(x => x.name === '中文書籍'); console.log('產品列 y/h =', pr.y, pr.h, '→ 底 =', pr.y + pr.h, '；最後主活動底 =', Math.max(...ns.filter(x => /客服|品牌|倉儲/.test(x.name) && x.kind === 'sp').map(x => x.y + x.h)));
const maxBottom = Math.max(...ns.filter(s => s.kind === 'sp' && !/Margin|^價值鏈$/.test(s.name)).map(s => s.y + s.h));
console.log('新版最大 y+h =', maxBottom, '／基準版 =', Math.max(...bs.filter(s => s.kind === 'sp').map(s => s.y + s.h)), '／slide 高 5143500');
chk(maxBottom <= 5143500, 'shape 不超出 slide');
const bMargin = bs.find(s => /Margin/.test(s.name)), nMargin = ns.find(s => /Margin/.test(s.name));
if (bMargin && nMargin) chk(nMargin.x + nMargin.w <= 9144000, 'Margin 箭頭在 slide 內（區高：新 ' + nMargin.w + ' vs 舊 ' + bMargin.w + '）');
// 主／支援活動座標比對：同名 shape 逐一比 h（unitH）與 y
let diff = 0, same = 0; const hs = new Set();
for (const b of bs.filter(s => s.kind === 'sp')) { const n = ns.find(s => s.kind === 'sp' && s.name === b.name && s.x === b.x); if (!n) continue; (n.y === b.y && n.h === b.h) ? same++ : (diff++, hs.add(b.h + '→' + n.h)); }
console.log(`既有 shape：座標相同 ${same}、不同 ${diff}；h 變化：${[...hs].join(', ') || '無'}`);
process.exit(fail ? 1 : 0);
