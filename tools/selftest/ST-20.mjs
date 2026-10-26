// ST-20 自測：PPTX 價值鏈頁畫出主要活動第三層（子群組框＋孫項方塊），連到孫層的連線不再被跳過
// 跑法（Node 24+、/usr/bin/google-chrome）：  node tools/selftest/ST-20.mjs [基準版 index.html 路徑，預設 ../dev/index.html]
// 測：攔截 JSZip.generateAsync 取 ppt/slides/slide1.xml，新版與基準版各跑一次
//   A) 價值鏈範本「連鎖醫美診所」(bio-aesthetic)：有「中醫門診」「中醫調理」方塊、「中醫醫療服務」「中醫術後照顧」框；
//      連線條數（依「價值鏈連線 N」名稱）新版必須等於頁面上範本的 valueChain.links 數（ST-30：不再與基準版比「+1」，基準版條數只印出當參考、不判 FAIL）；所有 shape 不超出 slide；狀態列沒有「略過」字樣
//   B) 範例專案「網路書店 A 公司」(bookstore-a)：兩層以內不走第三層精算版面——支援／主要活動方塊的 y、h 與基準版一致、連線條數一致
//      （ST-23c 起產品改在 Margin 右側直欄，x／寬度與產品方塊必然不同，不再要求全文一致；基準版用 ST-23c 之後的版本時全文也會一致）
//   C) 醫美範本再加一個第四層節點「深層測試」(中醫門診→改成群組) 並加一條指向不存在 id 的連線：
//      「深層測試」方塊存在、狀態列含「略過 1 條連線」與「攤平」
//   D 「中醫醫療服務」多塞 3／20 個孫項：+3 字級可降但不溢字、不壓縮；+20 降到 6pt 並壓縮、狀態列「已縮小字級」
//   A2/C 所有孫項與框標題列高 ≥ 對應字級一行字高＋上下內距（不溢字）；醫美範本不應觸發「已縮小字級」
// 截圖：$CLAUDE_JOB_DIR/tmp/ST-20/ST-20-vc.png（畫面端價值鏈，僅供參考；PPTX 實際版面要 PowerPoint 開看）
// 預期輸出全部 PASS，exit code 0。
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const newHtml = resolve(here, '../../index.html');
const baseHtml = resolve(process.argv[2] || join(here, '../../../dev/index.html'));
const tmp = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/ST-20'; mkdirSync(tmp, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 對一個 index.html 依序跑多個情境；每個情境回傳 { xml, status }
async function run(file, scenarios) {
  const PORT = 9400 + Math.floor(Math.random() * 500);
  const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox', '--disable-gpu',
    `--user-data-dir=${tmp}/prof-${PORT}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  try {
    let t; for (let i = 0; i < 60; i++) { try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(x => x.type === 'page'); if (t) break; } catch {} await sleep(250); }
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
    let seq = 0; const pend = new Map(); const errors = [];
    ws.addEventListener('message', e => { const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pend.set(id, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'file://' + file }); await sleep(1500);
    await ev(`window.confirm=()=>true; window.alert=()=>{}; window.prompt=()=>null; HTMLAnchorElement.prototype.click=function(){};
      const g=JSZip.prototype.generateAsync; JSZip.prototype.generateAsync=function(...a){window.__zip=this;return g.apply(this,a);}; 0`);
    const out = {};
    for (const [key, setup, shot] of scenarios) {
      await ev(setup); await sleep(500);
      const linkTotal = await ev(`(typeof valueChain!=='undefined'&&valueChain.links)?valueChain.links.length:null`); // 頁面上範本的連線數（ST-30：取代「基準＋1」）
      await ev(`window.__zip=null; exportPptx()`); await sleep(1500);
      const xml = await ev(`window.__zip.file('ppt/slides/slide1.xml').async('string')`);
      const status = await ev(`document.getElementById('statusText')?.textContent || ''`);
      if (shot) {
        const r = await ev(`(()=>{const e=document.querySelector('.vc-products-panel');const q=document.getElementById('vcArea')||document.querySelector('.vc-wrap, #valueChainSection, .value-chain')||e.parentElement;const a=q.getBoundingClientRect();return {x:a.left,y:a.top+scrollY,w:a.width,h:a.height}})()`);
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h, scale: 1 } });
        writeFileSync(shot, Buffer.from(data, 'base64'));
      }
      out[key] = { xml, status, linkTotal };
    }
    out.errors = errors;
    return out;
  } finally { chrome.kill(); }
}
const parse = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(m => {
  const s = m[0]; const nm = (s.match(/name="([^"]*)"/) || [])[1];
  const o = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/) || [];
  return { kind: m[1], name: nm, x: +o[1], y: +o[2], w: +o[3], h: +o[4], sz: +((s.match(/ sz="(\d+)"/) || [])[1] || 0) };
});
const linkCount = shapes => new Set(shapes.filter(s => s.kind === 'cxnSp').map(s => (s.name.match(/^價值鏈連線 (\d+)/) || [])[1]).filter(Boolean)).size;
let fail = 0; const chk = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };

const deepSetup = `loadValueChainTemplate('bio-aesthetic');
  (()=>{let f=null;const w=l=>l.forEach(n=>{if(n.name==='中醫門診')f=n;if(n.children)w(n.children)});w(valueChain.primary);
    f.type='group'; f.children=[{id:'zz_deep',name:'深層測試',type:'unit',unitKind:'activity'}];
    valueChain.links.push({id:'zz_l1',from:'zz_deep',to:'ae_cmcare'},{id:'zz_l2',from:'ae_diag',to:'zz_nope'});})(); 0`;
// D) 在「中醫醫療服務」框裡多塞 n 個孫項：n=3 應改用較小字級但仍不溢字；n=20 應壓縮並提示「已縮小字級」
const moreSetup = n => `loadValueChainTemplate('bio-aesthetic');
  (()=>{let f=null;const w=l=>l.forEach(x=>{if(x.id==='ae_cm')f=x;if(x.children)w(x.children)});w(valueChain.primary);
    for(let i=1;i<=${n};i++) f.children.push({id:'zz_m'+i,name:'加項'+i,type:'unit',unitKind:'activity'});})(); 0`;
const scen = shotPath => [
  ['ae', `loadValueChainTemplate('bio-aesthetic'); 0`, shotPath],
  ['book', `loadExampleProject('bookstore-a'); 0`, null],
];
const N = await run(newHtml, [...scen(tmp + '/ST-20-vc.png'), ['deep', deepSetup, null], ['m3', moreSetup(3), null], ['m20', moreSetup(20), null]]);
const B = await run(baseHtml, scen(null));

// A) 醫美範本
const na = parse(N.ae.xml), ba = parse(B.ae.xml);
for (const n of ['中醫門診', '中醫調理', '雷射術後修護', '點滴']) chk(na.filter(s => s.kind === 'sp' && s.name === n).length === 1, `A 孫項方塊「${n}」存在（基準版：${ba.some(s => s.name === n) ? '有' : '無'}）`);
for (const n of ['中醫醫療服務', '中醫術後照顧', '西醫醫療服務']) chk(na.some(s => s.kind === 'sp' && s.name === n), `A 子群組框「${n}」存在`);
const nl = linkCount(na), bl = linkCount(ba);
const expA = N.ae.linkTotal;
chk(nl === expA, `A 連線條數 新 ${nl} = 範本連線數 ${expA}（參考：基準版 ${bl}，connector 段數 新 ${na.filter(s => s.kind === 'cxnSp').length}／基準 ${ba.filter(s => s.kind === 'cxnSp').length}）`);
const maxB = Math.max(...na.filter(s => s.kind === 'sp' && !/Margin/.test(s.name)).map(s => s.y + s.h));
chk(maxB <= 5143500, `A shape 最大 y+h = ${maxB} ≤ slide 高 5143500`);
// 孫項要落在其框內
const inside = (c, p) => c.x >= p.x && c.y >= p.y && c.x + c.w <= p.x + p.w && c.y + c.h <= p.y + p.h;
const f1 = na.find(s => s.name === '中醫醫療服務'), g1 = na.find(s => s.name === '中醫門診');
const f0 = na.find(s => s.name === '醫療服務');
chk(f1 && g1 && inside(g1, f1) && inside(f1, f0), 'A 「中醫門診」在「中醫醫療服務」框內、框在「醫療服務」欄內');
chk(!/略過|攤平|縮小字級/.test(N.ae.status), `A 狀態列無略過／攤平／縮小字級提示：「${N.ae.status}」`);
// A2 字放得下：孫項 h、框標題列高（框頂到第一個孫項頂）≥ 一行字高（1.2 倍行距）＋上下內距 9000×2（與 index.html vcTextMinH 同式）
const minH = sz => Math.ceil(sz / 100 * 12700 * 1.2) + 18000;
const checkFrames = (shapes, tag) => {
  const frames = ['西醫醫療服務', '中醫醫療服務', '術後修護', '中醫術後照顧', '醫學美容療程'].map(n => shapes.find(s => s.kind === 'sp' && s.name === n));
  let worst = Infinity;
  frames.forEach(f => {
    const kids = shapes.filter(s => s.kind === 'sp' && s !== f && inside(s, f));
    const titleRow = Math.min(...kids.map(k => k.y)) - f.y;
    const okTitle = titleRow >= minH(f.sz);
    const badKids = kids.filter(k => k.h < minH(k.sz));
    worst = Math.min(worst, ...kids.map(k => k.h - minH(k.sz)), titleRow - minH(f.sz));
    chk(okTitle && !badKids.length && kids.length, `${tag} 框「${f.name}」標題列 ${titleRow} ≥ ${minH(f.sz)}（${f.sz / 100}pt）、${kids.length} 個孫項 h ≥ 所需（不足：${badKids.map(k => k.name + ' ' + k.h).join(',') || '無'}）`);
  });
  return worst;
};
const g0 = na.find(s => s.name === '中醫門診');
console.log(`A 中醫門診 h = ${g0.h} EMU（${(g0.h / 914400).toFixed(3)} in）、字級 ${g0.sz / 100}pt；最少餘裕 ${checkFrames(na, 'A')} EMU`);

// B) 書店範例：完全一致
writeFileSync(tmp + '/ae-slide1.xml', N.ae.xml); writeFileSync(tmp + '/deep-slide1.xml', N.deep.xml);
const nb = parse(N.book.xml), bb = parse(B.book.xml);
const bookProds = new Set(['中文書籍', '專業書籍', '影音商品', '產品', 'Margin／利潤']);
const vMiss = bb.filter(b => b.kind === 'sp' && !bookProds.has(b.name) && b.y > 914400)
  .filter(b => !nb.some(n => n.kind === 'sp' && n.name === b.name && n.y === b.y && n.h === b.h)).map(b => b.name);
chk(vMiss.length === 0, `B 書店支援／主要活動方塊 y、h 與基準一致（不符：${vMiss.join(',') || '無'}）`);
chk(linkCount(nb) === linkCount(bb), `B 書店連線條數 新 ${linkCount(nb)} = 基準 ${linkCount(bb)}`);

// C) 第四層與壞連線
const nd = parse(N.deep.xml);
chk(nd.some(s => s.kind === 'sp' && s.name === '深層測試'), 'C 第四層「深層測試」攤平後有方塊');
chk(/略過 1 條連線/.test(N.deep.status) && /攤平/.test(N.deep.status), `C 狀態列：「${N.deep.status}」`);
console.log(`C 最少餘裕 ${checkFrames(nd, 'C')} EMU`);
chk(Math.max(...nd.filter(s => s.kind === 'sp' && !/Margin/.test(s.name)).map(s => s.y + s.h)) <= 5143500, 'C shape 不超出 slide');
chk(linkCount(nd) === nl + 1, `C 連線條數 ${linkCount(nd)} = A ${nl} + 1（zz_deep→中醫調理；壞連線被略過）`);

for (const [k, n] of [['m3', 3], ['m20', 20]]) {
  const sh = parse(N[k].xml), g = sh.find(s => s.name === '加項1'), sup = sh.find(s => s.name === '採購');
  const bottom = Math.max(...sh.filter(s => s.kind === 'sp' && !/Margin/.test(s.name)).map(s => s.y + s.h));
  console.log(`D +${n}：孫項字級 ${g.sz / 100}pt、孫項 h ${g.h}、支援列 h ${sup.h}、最大 y+h ${bottom}；狀態列「${N[k].status.replace(/^.*?張/, '…')}」`);
  chk(bottom <= 5143500, `D +${n} shape 不超出 slide`);
  if (n === 3) { chk(!/縮小字級/.test(N[k].status), 'D +3 不需壓縮'); checkFrames(sh, 'D+3'); }
  else chk(/價值鏈頁第三層過多，已縮小字級/.test(N[k].status) && g.sz === 600, 'D +20 壓縮：6pt 且狀態列提示');
}
console.log(`A 支援列 h（unitH）= ${na.find(s => s.name === '採購').h}`);
chk(N.errors.length === 0, `新版無 JS 例外（${N.errors.join(' | ') || '0'}）`);
console.log('截圖：', tmp + '/ST-20-vc.png');
process.exit(fail ? 1 : 0);
