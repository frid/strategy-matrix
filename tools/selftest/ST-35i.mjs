// ST-35i 自測：價值單元 icon（unit.icon、名稱前 icon 按鈕＋選單、矩陣欄頭 icon 開關、PPTX 文字前置 icon）。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35i.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35i/；
//       基準版用 `git show dev:index.html` 寫到同一目錄的 base-index.html）
// 測了什麼：
//   [n] normaliseValueChain：icon 123／'  '／null 都不留欄位；' 🔬 ' → '🔬'；超過 4 字只取前 4 字；group 的 icon 丟掉
//   [f] 兩份 fixtures（舊存檔，無 icon）：新版載入無 console error；價值鏈編輯器 DOM（去 svg、去 .vc-icon-btn）與
//       矩陣 thead 和基準版完全相同；showUnitIcons 預設 true
//   [b] bookstore-a 範例（資料本身不含 icon，regression 才能逐張相同）：腳本動態給主要活動 5 個 icon →
//       價值鏈方塊 .vc-icon-btn 顯示 icon（porter、band 各截圖）、矩陣欄頭 .col-icon 數 = 5；
//       PPTX 不拋例外、slide XML 含 icon；取消勾選「欄頭 icon」→ 欄頭無 .col-icon，reload 後仍取消且勾選框未勾
//   [c] CDP 點 icon 按鈕 → 選單出現 24 個 → 點第 3 個 → valueChain 該 unit.icon 更新、按鈕顯示；自訂輸入「AB C」→ 'ABC'；
//       清除 → 欄位刪除；再設一次後 reload 仍在
//   [p] foundry-t 範例 exportPptx：每張 ppt/slides/slide*.xml 與基準版（dev）輸出完全相同
//   全程 console error 0。預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35i'; mkdirSync(out, { recursive: true });
const baseHtml = out + '/base-index.html';
writeFileSync(baseHtml, execSync('git show dev:index.html', { cwd: root, maxBuffer: 64 << 20 }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h, file = html) { await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file); }
const goChain = async h => { await h.ev(`guideGoto('chain'); 0`); await sleep(700); };
const goMatrix = async h => { await h.ev(`guideGoto('ideas'); 0`); await sleep(700); };
const vcSig = `(()=>{const c=document.getElementById('valueChainEditor').cloneNode(true);c.querySelectorAll('svg,.vc-icon-btn').forEach(s=>s.remove());return c.innerHTML})()`;
const theadSig = `document.querySelector('#matrixTable thead').innerHTML`;
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
async function exportSlides(h) {
  await h.captureDownloads();
  const err = await h.ev(`(async()=>{try{await exportPptx();return ''}catch(e){return String(e&&e.stack||e)}})()`);
  for (let i = 0; i < 40 && !(await h.downloads()).some(d => d.name && /pptx$/.test(d.name)); i++) await sleep(250);
  const idx = (await h.downloads()).findIndex(d => d.name && /pptx$/.test(d.name));
  const slides = {};
  if (idx >= 0) {
    const z = await h.zipEntries(idx);
    for (const n of z.names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))) slides[n] = await z.read(n);
  }
  return { err, slides };
}
const ICONS = ['📚', '🚚', '🏬', '📣', '🤝'];

// [n] normalise
{
  const h = await launch();
  try {
    await fresh(h);
    const r = await h.ev(`(()=>{const vc=normaliseValueChain({primary:[
      {id:'u1',name:'a',type:'unit',icon:123},{id:'u2',name:'b',type:'unit',icon:'  '},{id:'u3',name:'c',type:'unit',icon:null},
      {id:'u4',name:'d',type:'unit',icon:' 🔬 '},{id:'u5',name:'e',type:'unit',icon:'ABCDEF'},
      {id:'g',name:'g',type:'group',icon:'⭐',children:[{id:'u6',name:'f',type:'unit',icon:'⚙️'}]}],support:[],products:[{id:'p',name:'p',type:'unit',icon:'💊'}]});
      const P=vc.primary;return {has:P.slice(0,3).map(u=>'icon' in u), d:P[3].icon, e:P[4].icon, g:'icon' in P[5], f:P[5].children[0].icon, p:vc.products[0].icon}})()`);
    ok(JSON.stringify(r.has) === '[false,false,false]', `[n] icon 123／'  '／null 不留欄位 ${JSON.stringify(r.has)}`);
    ok(r.d === '🔬' && r.e === 'ABCD' && !r.g && r.f === '⚙️' && r.p === '💊', `[n] 去空白／截 4 字／group 丟 icon／產品保留 ${JSON.stringify(r)}`);
    ok(h.errors().length === 0, `[n] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [f] fixtures：新版 vs 基準版
for (const id of ['bookstore-a', 'foundry-t']) {
  const raw = JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')));
  const sig = {};
  for (const [tag, file] of [['base', baseHtml], ['new', html]]) {
    const h = await launch();
    try {
      await fresh(h, file);
      await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
      await h.open(file);
      await goChain(h); const vc = await h.ev(vcSig);
      await goMatrix(h); const th = await h.ev(theadSig);
      const extra = tag === 'new' ? await h.ev(`({flag:showUnitIcons, chk:document.getElementById('unitIconChk').checked, btns:document.querySelectorAll('.vc-icon-btn').length, icons:document.querySelectorAll('.vc-icon-btn:not(.vc-icon-empty)').length})`) : null;
      sig[tag] = { vc, th, extra, errs: h.errors() };
    } finally { await h.close(); }
  }
  ok(sig.new.errs.length === 0, `[f ${id}] 新版載入 fixture 無 console error ${JSON.stringify(sig.new.errs)}`);
  ok(sig.new.vc === sig.base.vc, `[f ${id}] 價值鏈 DOM（去 icon 按鈕）與基準相同（${sig.new.vc.length}/${sig.base.vc.length}）`);
  ok(sig.new.th === sig.base.th, `[f ${id}] 矩陣 thead 與基準相同`);
  ok(sig.new.extra.flag === true && sig.new.extra.chk === true && sig.new.extra.btns > 0 && sig.new.extra.icons === 0, `[f ${id}] showUnitIcons 預設 true、勾選框勾、${sig.new.extra.btns} 個空 icon 按鈕 ${JSON.stringify(sig.new.extra)}`);
}

// [b] bookstore-a 動態給 icon
{
  const h = await launch();
  try {
    await fresh(h); await h.loadExample('bookstore-a');
    const names = await h.ev(`(()=>{const us=[];const w=l=>l.forEach(n=>n.type==='group'?w(n.children):us.push(n));w(valueChain.primary);
      const pick=us.filter(u=>COLUMNS.includes(u.name)).slice(0,${ICONS.length});const ic=${JSON.stringify(ICONS)};pick.forEach((u,i)=>u.icon=ic[i]);commitValueChain();rebuildTable();return pick.map(u=>u.name)})()`);
    ok(names.length === ICONS.length, `[b] 給 ${names.length} 個主要活動 icon：${names.join('、')}`);
    await goChain(h);
    const shown = await h.ev(`[...document.querySelectorAll('.vc-icon-btn:not(.vc-icon-empty)')].map(b=>b.textContent)`);
    ok(ICONS.every(i => shown.includes(i)), `[b] 價值鏈方塊名稱前顯示 icon ${JSON.stringify(shown)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/b-bookstore-porter.png`);
    await setLayout(h, 'band');
    const shownB = await h.ev(`[...document.querySelectorAll('.vc-zone-primary .vc-icon-btn:not(.vc-icon-empty)')].map(b=>{const r=b.getBoundingClientRect();return r.width>0&&getComputedStyle(b).display!=='none'})`);
    ok(shownB.length === ICONS.length && shownB.every(Boolean), `[b] band 版型 icon 也看得到 ${JSON.stringify(shownB)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/b-bookstore-band.png`);
    await setLayout(h, 'porter');
    await goMatrix(h);
    const ci = await h.ev(`[...document.querySelectorAll('#matrixTable thead .col-icon')].map(e=>e.textContent)`);
    ok(ci.length === ICONS.length && ICONS.every(i => ci.includes(i)), `[b] 矩陣欄頭 icon ${JSON.stringify(ci)}`);
    await h.shot('#matrixTable thead', `${out}/b-bookstore-thead.png`);
    const { err, slides } = await exportSlides(h);
    ok(err === '', `[b] exportPptx 不拋例外 ${err}`);
    const hit = Object.entries(slides).filter(([, x]) => ICONS.some(i => x.includes(i))).map(([n]) => n);
    ok(hit.length > 0 && (slides['ppt/slides/slide1.xml'] || '').includes(ICONS[0]), `[b] PPTX 含 icon 的 slide：${hit.join(', ')}（slide1 含 ${ICONS[0]}）`);
    // 關掉欄頭 icon
    await h.ev(`(()=>{const c=document.getElementById('unitIconChk');c.checked=false;c.dispatchEvent(new Event('change'));})(); 0`); await sleep(300);
    const off = await h.ev(`document.querySelectorAll('#matrixTable thead .col-icon').length`);
    ok(off === 0, `[b] 取消勾選後欄頭無 icon（${off}）`);
    await h.open(html); await goMatrix(h);
    const rl = await h.ev(`({flag:showUnitIcons, chk:document.getElementById('unitIconChk').checked, n:document.querySelectorAll('#matrixTable thead .col-icon').length, vcIcons:(()=>{let k=0;const w=l=>l.forEach(n=>n.type==='group'?w(n.children):(n.icon&&k++));w(valueChain.primary);return k})()})`);
    ok(rl.flag === false && rl.chk === false && rl.n === 0 && rl.vcIcons === ICONS.length, `[b] reload 後仍關閉、icon 資料保留 ${JSON.stringify(rl)}`);
    const { slides: s2 } = await exportSlides(h);
    const thHit = Object.values(s2).some(x => /<a:tbl>/.test(x) && ICONS.some(i => x.includes(i)));
    ok(!thHit, `[b] 關閉後 PPTX 矩陣表格不含 icon`);
    ok(h.errors().length === 0, `[b] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [c] CDP 點按鈕選 icon
{
  const h = await launch();
  try {
    await fresh(h); await h.loadExample('bookstore-a'); await goChain(h);
    const uid = await h.ev(`document.querySelector('.vc-zone-primary .vc-unit').dataset.vcId`);
    const click = async sel => {
      const p = await h.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      for (const type of ['mousePressed', 'mouseReleased']) await h.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(300);
    };
    const btnSel = `[data-vc-id="${uid}"] > .vc-node-head > .vc-icon-btn`;
    await click(btnSel);
    const n = await h.ev(`document.querySelectorAll('#vcIconPicker .vc-icon-grid button').length`);
    ok(n === 24, `[c] 點 icon 按鈕出現選單（${n} 個 emoji）`);
    await h.shot('#vcIconPicker', `${out}/c-picker.png`);
    const want = await h.ev(`document.querySelectorAll('#vcIconPicker .vc-icon-grid button')[2].textContent`);
    await click('#vcIconPicker .vc-icon-grid button:nth-child(3)');
    const got = await h.ev(`({icon:locateVcNode(${JSON.stringify(uid)}).node.icon, btn:document.querySelector(${JSON.stringify(btnSel)}).textContent, open:!!document.getElementById('vcIconPicker')})`);
    ok(got.icon === want && got.btn === want && !got.open, `[c] 選第 3 個 → unit.icon=${got.icon}、按鈕顯示、選單關閉 ${JSON.stringify(got)}`);
    await click(btnSel);
    await h.ev(`(()=>{const i=document.querySelector('#vcIconPicker input');i.value='AB C';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})(); 0`); await sleep(300);
    const custom = await h.ev(`locateVcNode(${JSON.stringify(uid)}).node.icon`);
    ok(custom === 'ABC', `[c] 自訂輸入「AB C」→ ${custom}`);
    await click(btnSel);
    await h.ev(`[...document.querySelectorAll('#vcIconPicker button')].find(b=>b.textContent==='清除').click(); 0`); await sleep(300);
    const cleared = await h.ev(`'icon' in locateVcNode(${JSON.stringify(uid)}).node`);
    ok(cleared === false, `[c] 清除 → 欄位刪除`);
    await click(btnSel);
    await h.ev(`(()=>{const i=document.querySelector('#vcIconPicker input');i.value='💊';[...document.querySelectorAll('#vcIconPicker button')].find(b=>b.textContent==='套用').click();})(); 0`); await sleep(300);
    // 點外面關選單
    await click(btnSel); await h.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 }); await sleep(200);
    ok(!(await h.ev(`!!document.getElementById('vcIconPicker')`)), `[c] 點選單外關閉`);
    await h.open(html); await goChain(h);
    const kept = await h.ev(`({icon:locateVcNode(${JSON.stringify(uid)}).node.icon, saved:JSON.stringify(JSON.parse(localStorage.getItem('strategyMatrix_v4')).valueChain).includes('💊')})`);
    ok(kept.icon === '💊' && kept.saved, `[c] 套用後存檔、reload 仍在 ${JSON.stringify(kept)}`);
    ok(h.errors().length === 0, `[c] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [p] foundry-t PPTX 與基準相同
{
  const res = {};
  for (const [tag, file] of [['base', baseHtml], ['new', html]]) {
    const h = await launch();
    try {
      await fresh(h, file); await h.loadExample('foundry-t'); await sleep(300);
      res[tag] = { ...(await exportSlides(h)), errs: h.errors() };
    } finally { await h.close(); }
  }
  const names = Object.keys(res.base.slides);
  const diff = names.filter(n => res.base.slides[n] !== res.new.slides[n]);
  ok(res.new.err === '' && res.new.errs.length === 0, `[p foundry-t] exportPptx 不拋例外、無 console error ${res.new.err} ${JSON.stringify(res.new.errs)}`);
  ok(names.length > 0 && names.length === Object.keys(res.new.slides).length && !diff.length, `[p foundry-t] ${names.length} 張 slide XML 與 dev 基準相同（不同：${diff.join(', ') || '無'}）`);
}

console.log(fail ? `\n${fail} 項 FAIL` : '\n全部 PASS');
process.exit(fail ? 1 : 0);
