// CDP 測試 harness：零 npm 依賴（Node 24 內建 WebSocket／fetch），供 worker／verifier 的自測腳本共用。
// 環境：CHROME_BIN 覆寫 Chrome 路徑（預設 /usr/bin/google-chrome）；profile 放 $CLAUDE_JOB_DIR/tmp（無則 os.tmpdir()）。
// 用法：
//   import { launch } from '../cdp-harness.mjs';          // 從 tools/selftest/ 引用
//   const h = await launch();                              // 1400×900，可傳 { width, height }
//   await h.open('/abs/path/index.html');                  // 絕對路徑會轉 file://；開頁後自動 stubDialogs
//   await h.loadExample('bookstore-a');                    // stub 後呼叫 loadExampleProject 並等渲染
//   await h.captureDownloads();                            // 攔 Blob 下載（PPTX／CSV／JSON），reload 後要重呼叫
//   await h.ev('exportPptx()'); await new Promise(r => setTimeout(r, 1500));
//   const d = await h.downloads();                         // [{ name, type, size }]；downloads({withData:true}) 另附 base64
//   const buf = await h.blobBytes(0);                      // 第 idx 個下載的 Buffer（分塊 512KB 取回，大檔安全）
//   const z = await h.zipEntries(0);                       // { names: [...], read: async name => 字串 }
//   const xml = await z.read('ppt/slides/slide1.xml');
//   await h.shot('#matrix', outDir + '/matrix.png');       // selector 為 null → 整頁
//   console.log(h.errors());                               // exceptionThrown 與 console.error 的累積文字
//   await h.close();
// 方法：ev、send、open、stubDialogs、loadExample、shot、captureDownloads、downloads、blobBytes、zipEntries、errors、close。
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ width = 1400, height = 900 } = {}) {
  const base = process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir();
  mkdirSync(base, { recursive: true });
  const PORT = 9400 + Math.floor(Math.random() * 500);
  const chrome = spawn(process.env.CHROME_BIN || '/usr/bin/google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`,
    '--no-sandbox', '--disable-gpu', `--user-data-dir=${base}/prof-${PORT}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let t;
  for (let i = 0; i < 60; i++) {
    try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(x => x.type === 'page'); if (t) break; } catch {}
    await sleep(250);
  }
  if (!t) { chrome.kill(); throw new Error('Chrome 沒有在時限內啟動（CHROME_BIN？）'); }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let seq = 0; const pend = new Map(); const errs = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails; errs.push('exception: ' + (d.exception?.description || d.text));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errs.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pend.set(id, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const stubDialogs = () => ev('window.confirm=()=>true; window.alert=()=>{}; window.prompt=()=>null; 0');
  const open = async p => {
    const url = /^[a-z]+:\/\//i.test(p) ? p : 'file://' + resolve(p);
    await send('Page.navigate', { url });
    for (let i = 0; i < 40; i++) { try { if (await ev('document.readyState') === 'complete') break; } catch {} await sleep(150); }
    await sleep(800);
    await stubDialogs();
  };
  const loadExample = async id => {
    await stubDialogs();
    await ev(`loadExampleProject(${JSON.stringify(id)}); 0`);
    await sleep(500);
  };
  const shot = async (selector, outPath) => {
    let params = { format: 'png', captureBeyondViewport: true };
    if (selector) {
      const r = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const a=e.getBoundingClientRect();return {x:a.left+scrollX,y:a.top+scrollY,w:a.width,h:a.height}})()`);
      if (!r) throw new Error('shot：找不到元素 ' + selector);
      params.clip = { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, r.w), height: Math.max(1, r.h), scale: 1 };
    }
    const { data } = await send('Page.captureScreenshot', params);
    writeFileSync(outPath, Buffer.from(data, 'base64'));
    return outPath;
  };
  // 攔下載：記錄 createObjectURL 的 Blob，anchor.click 時補上檔名並擋掉實際下載
  const captureDownloads = () => ev(`(()=>{
    window.__blobs=window.__blobs||[]; if(window.__dlHooked) return 0; window.__dlHooked=true;
    const c=URL.createObjectURL.bind(URL);
    URL.createObjectURL=function(b){const u=c(b);window.__blobs.push({url:u,blob:b,name:null});return u;};
    HTMLAnchorElement.prototype.click=function(){const x=window.__blobs.find(e=>e.url===this.href);if(x)x.name=this.download||x.name;};
    return 0;})()`);
  // 頁內只回 metadata（大 blob 一次 base64 經 CDP 會卡死，>4MB 實測 HANG）；要資料用 blobBytes(idx) 分塊取回
  const blobBytes = async (idx, chunk = 512 * 1024) => {
    const size = await ev(`window.__blobs[${idx}].blob.size`);
    const parts = [];
    for (let o = 0; o < size; o += chunk) {
      const b64 = await ev(`new Promise(r=>{const f=new FileReader();f.onload=()=>r(String(f.result).split(',')[1]||'');
        f.readAsDataURL(window.__blobs[${idx}].blob.slice(${o},${Math.min(o + chunk, size)}));})`);
      parts.push(Buffer.from(b64, 'base64'));
    }
    return Buffer.concat(parts);
  };
  const downloads = async ({ withData = false } = {}) => {
    const meta = await ev(`(window.__blobs||[]).map(e=>({name:e.name,type:e.blob.type,size:e.blob.size}))`);
    if (withData) for (let i = 0; i < meta.length; i++) meta[i].base64 = (await blobBytes(i)).toString('base64');
    return meta;
  };
  const zipEntries = async idx => {
    const key = '__zip' + idx;
    const names = await ev(`(async()=>{const d=(window.__blobs||[])[${idx}];if(!d)throw new Error('沒有第 ${idx} 個下載');
      window.${key}=await JSZip.loadAsync(d.blob);return Object.keys(window.${key}.files)})()`);
    return { names, read: name => ev(`window.${key}.file(${JSON.stringify(name)}).async('string')`) };
  };
  const close = async () => { try { ws.close(); } catch {} chrome.kill(); };
  return { ev, send, open, stubDialogs, loadExample, shot, captureDownloads, downloads, blobBytes, zipEntries, errors: () => errs.slice(), close };
}
