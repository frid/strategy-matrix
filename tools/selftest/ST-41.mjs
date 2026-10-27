// ST-41 自測：價值單元 icon 選單改為「搜尋框＋分類 emoji 資料集（VC_EMOJI_SET）」，normVcIcon 以 grapheme 截字。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-41.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-41/）
// 測了什麼：
//   [d] 資料集：emoji 數 350–450、無重複、每個都是 1 個 grapheme 且不含 ZWJ、含原 VC_ICON_CHOICES 24 個且排最前
//   [c] bookstore-a：CDP 點主要活動第一個 icon 按鈕 → 選單出現、搜尋框取得 focus、有類別小標題（截圖 c-picker.png）；
//       搜「顯微」→ 只剩少量（≤ 3）且含 🔬（截圖 c-search.png）；搜「truck」→ 含 🚚；搜「藥 pill」（AND）→ 含 💊；
//       搜「zzqq」→ 0 顆且顯示「無符合」；清空 → 恢復全部、小標題回來；搜「卡車」後點 🚚 → unit.icon='🚚'、
//       方塊按鈕顯示 🚚、選單關閉；再開選單 🚚 有 .vc-icon-cur；自訂輸入「👨‍👩‍👧」Enter → unit.icon 為完整 1 個 grapheme；
//       自訂「AB🧬CDE」→ 'AB🧬C'（4 grapheme）；Esc 關閉；面板在視窗內（底部放不下會往上翻：捲到按鈕貼視窗底再開一次檢查）
//   [f] tests/fixtures 兩份舊存檔：寫入 localStorage 後 reload、切價值鏈頁並開關選單，console error 0
//   全程 console error 0。預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-41'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h, file = html) { await h.open(file); await h.ev('localStorage.clear(); 0'); await h.open(file); }
const goChain = async h => { await h.ev(`guideGoto('chain'); 0`); await sleep(700); };
const visible = `[...document.querySelectorAll('#vcIconPicker .vc-icon-grid button')].filter(b=>!b.hidden).map(b=>b.textContent)`;
const search = async (h, q) => { await h.ev(`(()=>{const s=document.querySelector('#vcIconPicker .vc-icon-search');s.value=${JSON.stringify(q)};s.dispatchEvent(new Event('input'));})(); 0`); await sleep(100); return h.ev(visible); };

// [d] 資料集
{
  const h = await launch();
  try {
    await fresh(h);
    const r = await h.ev(`(()=>{const seg=new Intl.Segmenter(undefined,{granularity:'grapheme'});const cats=getVcEmojiCats();
      const all=cats.flatMap(c=>c.items.map(i=>i.ic));const raw=VC_EMOJI_SET.flatMap(([c,t])=>t.split('\\n').map(l=>l.split(' ')[0]));
      return {n:all.length, cats:cats.map(c=>c.cat+':'+c.items.length), dup:raw.length-new Set(raw).size,
        bad:all.filter(i=>[...seg.segment(i)].length!==1||i.includes('\\u200d')),
        first:all.slice(0,24).join('')===VC_ICON_CHOICES.join('')}})()`);
    ok(r.n >= 350 && r.n <= 450, `[d] emoji 數 ${r.n}（${r.cats.join('、')}）`);
    ok(r.dup === 0 && r.bad.length === 0, `[d] 無重複、皆單一 grapheme 無 ZWJ dup=${r.dup} bad=${JSON.stringify(r.bad)}`);
    ok(r.first, `[d] 原 24 個排最前`);
  } finally { await h.close(); }
}

// [c] 選單操作
{
  const h = await launch();
  try {
    await fresh(h); await h.loadExample('bookstore-a'); await goChain(h);
    const uid = await h.ev(`document.querySelector('.vc-zone-primary .vc-unit').dataset.vcId`);
    const btnSel = `[data-vc-id="${uid}"] > .vc-node-head > .vc-icon-btn`;
    const click = async (sel, scroll = true) => {
      const p = await h.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});${scroll ? "e.scrollIntoView({block:'center'});" : ''}const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      for (const type of ['mousePressed', 'mouseReleased']) await h.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(300);
    };
    await click(btnSel);
    const st = await h.ev(`({open:!!document.getElementById('vcIconPicker'), focus:document.activeElement&&document.activeElement.classList.contains('vc-icon-search'),
      cats:[...document.querySelectorAll('#vcIconPicker .vc-icon-cat')].filter(x=>!x.hidden).length, n:${visible}.length, w:document.getElementById('vcIconPicker').offsetWidth})`);
    ok(st.open && st.focus && st.cats >= 8 && st.n >= 350, `[c] 選單開啟、搜尋框 focus、類別小標題 ${st.cats}、emoji ${st.n}、寬 ${st.w}`);
    await h.shot('#vcIconPicker', `${out}/c-picker.png`);
    const total = st.n;
    const s1 = await search(h, '顯微');
    ok(s1.includes('🔬') && s1.length <= 3, `[c] 搜「顯微」→ ${s1.join('')}`);
    await h.shot('#vcIconPicker', `${out}/c-search.png`);
    const cHidden = await h.ev(`[...document.querySelectorAll('#vcIconPicker .vc-icon-cat')].every(x=>x.hidden)`);
    ok(cHidden, `[c] 搜尋時類別小標題隱藏`);
    const s2 = await search(h, 'truck');
    ok(s2.includes('🚚'), `[c] 搜「truck」→ ${s2.join('')}`);
    const s3 = await search(h, '藥 PILL');
    ok(s3.includes('💊') && s3.length <= 3, `[c] 搜「藥 PILL」（AND、大小寫不分）→ ${s3.join('')}`);
    const s4 = await search(h, 'zzqq');
    const noneShown = await h.ev(`!document.querySelector('#vcIconPicker .vc-icon-none').hidden`);
    ok(s4.length === 0 && noneShown, `[c] 搜「zzqq」→ 0 顆、顯示「無符合」`);
    await h.shot('#vcIconPicker', `${out}/c-none.png`);
    const s5 = await search(h, '');
    const back = await h.ev(`({cats:[...document.querySelectorAll('#vcIconPicker .vc-icon-cat')].filter(x=>!x.hidden).length, none:document.querySelector('#vcIconPicker .vc-icon-none').hidden})`);
    ok(s5.length === total && back.cats >= 8 && back.none, `[c] 清空搜尋 → 恢復全部 ${s5.length}／${total}、小標題 ${back.cats}`);
    await search(h, '卡車');
    await h.ev(`[...document.querySelectorAll('#vcIconPicker .vc-icon-grid button')].find(b=>b.textContent==='🚚').setAttribute('data-t','1'); 0`);
    await click('#vcIconPicker button[data-t="1"]', false);
    const got = await h.ev(`({icon:locateVcNode(${JSON.stringify(uid)}).node.icon, btn:document.querySelector(${JSON.stringify(btnSel)}).textContent, open:!!document.getElementById('vcIconPicker')})`);
    ok(got.icon === '🚚' && got.btn === '🚚' && !got.open, `[c] 點 🚚 → unit.icon、按鈕顯示、選單關閉 ${JSON.stringify(got)}`);
    await goChain(h);
    await h.shot('#valueChainEditor', `${out}/c-applied.png`);
    await click(btnSel);
    const cur = await h.ev(`[...document.querySelectorAll('#vcIconPicker .vc-icon-cur')].map(b=>b.textContent)`);
    ok(cur.length === 1 && cur[0] === '🚚', `[c] 再開選單目前 icon 標 .vc-icon-cur ${JSON.stringify(cur)}`);
    await h.ev(`(()=>{const i=document.querySelector('#vcIconPicker .vc-icon-row input');i.value='👨‍👩‍👧';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})(); 0`); await sleep(300);
    const fam = await h.ev(`(()=>{const v=locateVcNode(${JSON.stringify(uid)}).node.icon;return {v, g:[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(v)].length}})()`);
    ok(fam.v === '👨‍👩‍👧' && fam.g === 1, `[c] 自訂「👨‍👩‍👧」→ 完整 1 個 grapheme ${JSON.stringify(fam)}`);
    ok(await h.ev(`normVcIcon('AB🧬CDE')`) === 'AB🧬C', `[c] normVcIcon('AB🧬CDE') = 'AB🧬C'`);
    await click(btnSel);
    await h.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await h.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(200);
    ok(!(await h.ev(`!!document.getElementById('vcIconPicker')`)), `[c] Esc 關閉`);
    // 按鈕貼視窗底再開：面板須整個在視窗內（往上翻）
    await h.ev(`(()=>{const e=document.querySelector(${JSON.stringify(btnSel)});e.scrollIntoView({block:'end'});window.scrollBy(0,-10);})(); 0`); await sleep(200);
    await click(btnSel, false);
    const pos = await h.ev(`(()=>{const p=document.getElementById('vcIconPicker').getBoundingClientRect();const b=document.querySelector(${JSON.stringify(btnSel)}).getBoundingClientRect();return {top:p.top,bottom:p.bottom,vh:document.documentElement.clientHeight,btnTop:b.top}})()`);
    ok(pos.top >= 0 && pos.bottom <= pos.vh, `[c] 按鈕近視窗底時面板仍在視窗內 ${JSON.stringify(pos)}`);
    await h.shot(null, `${out}/c-flip.png`);
    ok(h.errors().length === 0, `[c] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [f] fixtures 舊存檔
for (const id of ['bookstore-a', 'foundry-t']) {
  const raw = JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')));
  const h = await launch();
  try {
    await fresh(h);
    await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
    await h.open(html); await goChain(h);
    await h.ev(`(()=>{const b=document.querySelector('.vc-icon-btn');b.scrollIntoView({block:'center'});b.click();})(); 0`); await sleep(200);
    const opened = await h.ev(`!!document.getElementById('vcIconPicker')`);
    await h.ev(`closeVcIconPicker(); 0`);
    ok(opened && h.errors().length === 0, `[f] ${id} 舊存檔載入＋開關選單 console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
