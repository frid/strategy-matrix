// 重新產生操作手冊（manual.html）用的截圖 → manual/img/NN-名稱.png
// 執行方式（需 Node 24+、/usr/bin/google-chrome，不需安裝任何 npm 套件）：
//   node tools/capture-manual.mjs
// 介面改版後重跑即可。示範資料（虛構公司「見安醫材」）寫在下方「示範資料」區，
// 使用暫時的 Chrome profile，不會動到你瀏覽器裡的存檔。
// 可用環境變數 CAPTURE_TMP 指定暫存 profile 位置。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'manual', 'img');
const profile = process.env.CAPTURE_TMP || '/home/frid/.claude/jobs/69e42d45/tmp/chrome-profile';
const PORT = 9333 + Math.floor(Math.random() * 500);
mkdirSync(outDir, { recursive: true });
rmSync(profile, { recursive: true, force: true });

const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox', '--disable-gpu',
  `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.find(t => t.type === 'page')) break; } catch {}
  await sleep(250);
}
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let seq = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, m => m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result));
  ws.send(JSON.stringify({ id, method, params }));
});
const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval 失敗：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + expr);
  return r.result.value;
};

// shot(檔名, 目標)：目標是回傳元素（或元素陣列）的 JS 運算式，取其聯集矩形；pad 為外擴像素
async function shot(name, targetExpr, pad = 8) {
  const h = await ev('document.documentElement.scrollHeight');
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(150);
  const rect = await ev(`(() => { let t = (${targetExpr}); if (!Array.isArray(t)) t = [t];
    let l=1e9,tp=1e9,r=0,b=0; t.forEach(el => { const q = el.getBoundingClientRect(); l=Math.min(l,q.left); tp=Math.min(tp,q.top); r=Math.max(r,q.right); b=Math.max(b,q.bottom); });
    return {l,tp,r,b}; })()`);
  const x = Math.max(0, rect.l - pad), y = Math.max(0, rect.tp - pad);
  const clip = { x, y, width: Math.min(1400, rect.r + pad) - x, height: rect.b + pad - y, scale: 1 };
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  writeFileSync(join(outDir, name + '.png'), Buffer.from(data, 'base64'));
  console.log('OK', name, Math.round(clip.width) + 'x' + Math.round(clip.height));
}

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file://' + join(root, 'index.html') });
await sleep(2500);
await ev(`window.confirm = () => true; window.alert = () => {}; localStorage.clear(); true`);

// 頁面內的小幫手：依名稱找價值鏈節點、依欄名找欄位索引、建立連線
// 截圖期間讓「專案」區不要 sticky，避免蓋住其他區塊（只在這個頁面暫時注入，不改 index.html）
await ev(`(() => { const st = document.createElement('style'); st.textContent = '.project-panel { position: static !important; }'; document.head.appendChild(st); return true; })()`);
await ev(`window.__byName = n => { let hit=null; const walk = l => l.forEach(x => { if (x.name === n && !hit) hit = x; if (x.children) walk(x.children); }); walk(valueChain.primary); walk(valueChain.support); walk(valueChain.products); return hit; };
 window.__colIdx = n => COLUMNS.indexOf(n);
 window.__L = (a,b) => { vcLinkMode = true; handleVcLinkClick(__byName(a).id); handleVcLinkClick(__byName(b).id); vcLinkMode = false; };
 true`);

// ── 示範資料（虛構公司「見安醫材」）──
await ev(`document.getElementById('strategyTitle').value = '見安醫材：高階影像設備進軍連鎖診所通路';
 document.getElementById('strategyDesc').value = '見安醫材（虛構範例）為連鎖診所通路製造高階超音波設備(A24)。透過差異化產品設計(A05)與通路整合(A20)，提升品牌(A22)並強化售後服務(A23)。';
 saveState(); true`);
await ev(`loadValueChainTemplate('bio-meddevice'); true`);
await ev(`valueChain.products[0].name = '高階超音波設備'; valueChain.products[1].name = '耗材與配件'; valueChain.links = []; commitValueChain(); true`);

const vcPanel = `document.getElementById('valueChainEditor').closest('.panel')`;
// 01 頁首＋策略名稱與說明
await shot('01-header-title', `[document.querySelector('.header-row'), document.getElementById('strategyTitle').closest('.panel')]`);
// 01b 專案區塊
await shot('01b-project-panel', `[document.querySelector('.project-panel').previousElementSibling, document.querySelector('.project-panel')]`);
// 02 價值鏈整體（尚未連線）
await shot('02-value-chain', `[${vcPanel}.previousElementSibling, ${vcPanel}]`);
// 03 價值鏈工具列
await shot('03-vc-toolbar', `document.querySelector('#valueChainEditor .vc-toolbar')`);
// 04 方塊近照：群組「研發」與其子項
await shot('04-vc-node-group', `[...document.querySelectorAll('#valueChainEditor .vc-group')].find(n => n.querySelector('textarea,input').value === '研發')`, 10);
// 05 連線模式：點第一個方塊（黃色）
await ev(`vcLinkMode = true; renderValueChainEditor(); handleVcLinkClick(__byName('市場分析').id); true`);
await shot('05-vc-link-pending', vcPanel);
await ev(`handleVcLinkClick(__byName('業務開發').id); vcLinkMode = false; renderValueChainEditor(); true`);
await ev(`__L('產品設計','試產'); __L('通路','銷售'); __L('品牌','售後服務'); true`);
// 06 連線完成
await shot('06-vc-links', vcPanel);
// 07 產品面板＋連線清單
await shot('07-vc-products', `[document.querySelector('.vc-products-panel'), document.getElementById('valueChainEditor').lastElementChild]`);
// 07 展開對話框
await ev(`openExpandDialog(); true`);
await shot('08-expand-dialog', `document.getElementById('expandModalBox')`, 14);
await ev(`document.getElementById('expandOkBtn').click(); true`);
await shot('09-expand-result', `document.getElementById('expandModalBox')`, 14);
await ev(`closeExpandModal(); true`);

// 策略與箭頭
await ev(`competitors[0].name = '產品差異化'; competitors[1].name = '通路整合'; competitors.push({ name: '品牌服務', color: COLORS[2] }); arrows.push([]);
 const A = (ci, r1, c1, r2, c2, note) => arrows[ci].push({ from: {row:r1, col:__colIdx(c1)}, to: {row:r2, col:__colIdx(c2)}, note });
 A(0,'A','市場分析','A','產品設計','先找出診所端的影像診斷需求');
 A(0,'A','產品設計','A','試產','以新設計打樣、小量試產');
 A(0,'F','試產','F','臨床測試','取得臨床證據支持差異化');
 A(1,'B','物流','B','通路','與連鎖診所建立直營式通路');
 A(1,'B','通路','B','銷售','通路與銷售團隊整合');
 A(1,'C','倉儲','C','物流','倉儲物流自營以縮短交期');
 A(2,'F','品牌','F','售後服務','以品牌帶動長期服務合約');
 A(2,'D','銷售','D','品牌','');
 activeIdx = 0; saveState(); rebuildTable(); renderCompetitorBar(); updateStatus(); true`);
// 09 策略構想
await shot('10-competitors', `document.getElementById('competitorBar').closest('.panel')`);
// 10 圖例＋箭頭清單（含補充說明）
await shot('11-arrow-list', `[document.getElementById('legendContainer').closest('.panel'), document.getElementById('arrowListPanel')]`);
// 11 操作列
await shot('12-action-bar', `document.querySelector('.action-bar')`);
// 12 矩陣（目前策略）
await shot('13-matrix', `[document.querySelector('.matrix-wrapper'), document.querySelector('.instructions')]`);
// 13 繪製中：黃色起點格
await ev(`setMode('draw'); onCellClick('A', __colIdx('倉儲'), document.getElementById('cell-A-' + __colIdx('倉儲'))); true`);
await shot('14-draw-pending', `[document.querySelector('.action-bar'), document.querySelector('.matrix-wrapper')]`);
await ev(`cancelPending(); true`);
// 14 換成「莫蘭迪柔和」配色（價值鏈＋矩陣），截完切回預設配色
await ev(`applyPalette(COLOR_PALETTES.findIndex(p => p.name === '莫蘭迪柔和')); true`);
await shot('15a-palette-morandi-vc', vcPanel);
await shot('15b-palette-morandi-matrix', `document.querySelector('.matrix-wrapper')`);
await ev(`applyPalette(0); true`);
// 15 產業矩陣
await ev(`if (!showIndustryLabels) toggleIndustryMatrix(); true`);
await shot('16-industry-matrix', `[document.querySelector('.action-bar'), document.querySelector('.matrix-wrapper')]`);

// 17 策略要素：第一條箭頭展開要素選擇面板
await ev(`openElemPanelKey = '0-0'; renderArrowList(); true`);
await shot('17-elements', `document.getElementById('arrowList')`);
await ev(`openElemPanelKey = null; renderArrowList(); true`);
// 18 策略句型：展開句型框
await ev(`document.getElementById('sentenceBox').open = true; true`);
await shot('18-sentences', `document.getElementById('sentenceBox')`);
// 19 載入範例：專案區塊（載入「網路書店 A 公司」後）
await ev(`loadExampleProject(EXAMPLE_PROJECTS[0].id); true`);
await shot('19-example', `[document.querySelector('.project-panel').previousElementSibling, document.querySelector('.project-panel')]`);

// ── ST-16：三波新功能（以下都在已載入的「網路書店 A 公司」範例上拍）──
// 20 流程導引步驟條（展開要點面板）
await ev(`document.getElementById('guideDetail').open = true; true`);
await shot('20-guide-bar', `document.getElementById('guideBar')`);
// 22 短版矩陣：自動隱藏無箭頭欄後（含 chip 列），截完還原
await ev(`autoHideUnusedCols(); true`);
await shot('22-short-view', `[document.querySelector('.action-bar'), document.querySelector('.matrix-wrapper'), document.getElementById('hiddenColsBar')]`);
await ev(`shortView = false; hiddenCols = {}; afterShortViewChange(); true`);
// 23 策略點描述：切到描述模式、點 C 列（有 ○✕◐ 的格子）
const noteKey = await ev(`Object.keys(cellNotes).find(k => k.endsWith('|C')) || Object.keys(cellNotes)[0]`);
await ev(`setMode('describe'); (() => { const k = ${JSON.stringify(noteKey)}.split('|'); selectCell(k[1], COLUMNS.indexOf(k[0])); })(); true`);
await shot('23-cell-panel', `[document.querySelector('.action-bar'), document.querySelector('.matrix-wrapper'), document.getElementById('cellPanel')]`);
await ev(`setMode('draw'); currentCell = null; renderCellPanel(); true`);
// 24 策略構想分型＋疊圖對陣點
await shot('24-kinds', `[document.getElementById('competitorBar').closest('.panel'), document.querySelector('.action-bar'), document.querySelector('.matrix-wrapper')]`);
// 25 對陣點列表
await ev(`document.getElementById('clashBox').open = true; true`);
await shot('25-clash', `document.getElementById('clashBox')`);
// 26 策略模組 chip 列＋箭頭清單
await shot('26-modules', `[document.getElementById('moduleBox'), ...[...document.getElementById('arrowList').children].slice(0, 4)]`);
// 27 前提與 SWOT
await ev(`document.getElementById('premiseBox').open = true; true`);
await shot('27-premise-swot', `document.getElementById('premiseBox')`);
// 28 行動計畫
await ev(`document.getElementById('actionBox').open = true; true`);
await shot('28-actions', `document.getElementById('actionBox')`);
// 29 前提控制表
await ev(`document.getElementById('controlBox').open = true; true`);
await shot('29-control', `document.getElementById('controlBox')`);
// 21 單元角色：載入理論骨架「半成品外售流程」範本（放最後，之後不再用範例）
await ev(`loadValueChainTemplate('theory-semi'); true`);
await shot('21-vc-roles', vcPanel);

ws.close(); chrome.kill(); await sleep(1500);
try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }); } catch {}
