// ST-35c 自測：價值鏈摺疊式（E）版型。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35c.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35c/）
// 測了什麼：
//   [a] bio-aesthetic 1400：porter DOM 記下 → 切 fold：zones 同時有 vc-layout-band、vc-layout-fold；頂層 4 個群組全收合（.vc-folded）、
//       角標＝攤平葉節點數（醫療服務 +7、術後照護 +3、醫學美容 +5、周邊商品 +5）；收合群組 group-body display:none、本身 clip-path chevron、
//       與葉節點底緣對齊；第一支 chevron（公關接待）vc-chev-first；連線條數＝跨收合群組的連線數（2），端點落在對應「看得到的」方塊邊上；
//       「全部展開／全部收合」按鈕存在；截圖 a-bio-fold-collapsed.png
//   [b] 點「醫療服務」角標（真滑鼠）→ 展開（.vc-unfolded、角標 ▾）、子群組西醫 +6／中醫 +1 出現且預設收合、連線端點改落在子群組上；
//       點名稱 textarea 不切換；點標題空白處（head 本身）收合回去；收合／展開不寫 localStorage；截圖 b-bio-fold-open.png
//       全部展開 → 無 .vc-folded、連線端點落在原始節點；全部收合 → 4 個頂層都收合
//   [c] 測試價值鏈（g1 內部有連線 b1→b2）：收合時內部連線略過（7 條 links 畫 6 條）、全部展開畫 7 條
//   [d] reload 後 layout 仍 fold、全部回收合；切回 porter 後 DOM 與 [a] 切換前相同
//   [e] 800×900：fold 存檔載入無 error、沒有隱藏的 group-body、角標不顯示、主要活動列直排、連線＝links 數且端點在原節點邊上
//   [f] 兩範例（bookstore-a、foundry-t）與兩份 fixtures 載入無 console error，切 fold 連線端點正確
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35c'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
async function fresh(h) { await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html); }
const goChain = async h => { await h.ev(`guideGoto('chain'); 0`); await sleep(700); };
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
const domSig = h => h.ev(`(()=>{const c=document.getElementById('valueChainEditor').cloneNode(true);c.querySelectorAll('svg').forEach(s=>s.remove());return c.innerHTML})()`);
const setVc = async (h, vc) => { await h.ev(`valueChain = normaliseValueChain(${JSON.stringify(vc)}); resetValueChainIds(valueChain); commitValueChain(); 0`); await sleep(400); };
const clickBtn = async (h, key) => { await h.ev(`document.querySelector('.vc-fold-all[data-fold="${key}"]').click(); 0`); await sleep(300); };
// 連線檢查：期望畫出的＝兩端 vcFoldEndRect 不同的連線；每條 path 起訖點落在對應矩形邊上（容差 3px）
const linkCheck = `(()=>{
  const ps=[...document.querySelectorAll('#vcLineCanvas .vc-link-main')];
  const same=(a,b)=>a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
  const exp=valueChain.links.map(l=>({l,a:vcFoldEndRect(l.from),b:vcFoldEndRect(l.to)})).filter(o=>o.a&&o.b&&!same(o.a,o.b));
  const onEdge=(p,r,t=5)=>p.x>=r.x-t&&p.x<=r.x+r.w+t&&p.y>=r.y-t&&p.y<=r.y+r.h+t&&
    (Math.abs(p.x-r.x)<=t||Math.abs(p.x-r.x-r.w)<=t||Math.abs(p.y-r.y)<=t||Math.abs(p.y-r.y-r.h)<=t);
  const bad=[];
  ps.forEach((p,i)=>{const d=p.getAttribute('d')||'';const nums=(d.match(/-?\\d+(\\.\\d+)?/g)||[]).map(Number);
    const s={x:nums[0],y:nums[1]}, e={x:nums[nums.length-2],y:nums[nums.length-1]};const o=exp[i];
    if(/NaN/.test(d)||!o||!onEdge(s,o.a)||!onEdge(e,o.b)) bad.push({i,link:o&&o.l.id,s,e,a:o&&o.a,b:o&&o.b});});
  // 端點矩形是哪個節點（看得到的那個）
  const who=r=>{const el=[...document.querySelectorAll('#valueChainEditor [data-vc-id]')].find(e=>{const q=vcOffsetRect(e);return same(q,r)});return el&&el.dataset.vcId};
  return {n:ps.length, exp:exp.length, links:valueChain.links.length, bad, ends:exp.map(o=>[who(o.a),who(o.b)])};
})()`;
const foldInfo = `(()=>{
  const P=document.querySelector('.vc-zone-primary');
  const nm=g=>g.querySelector(':scope > .vc-node-head textarea').value;
  const top=[...P.querySelectorAll(':scope > .vc-zone-body > .vc-group')].map(g=>{const b=g.querySelector(':scope > .vc-node-head > .vc-fold-badge');
    return {id:g.dataset.vcId,name:nm(g),folded:g.classList.contains('vc-folded'),badge:b&&b.textContent,badgeShown:!!b&&getComputedStyle(b).display!=='none',
      bodyDisp:getComputedStyle(g.querySelector(':scope > .vc-group-body')).display,clip:getComputedStyle(g).clipPath,bottom:g.getBoundingClientRect().bottom,h:g.getBoundingClientRect().height}});
  const all=[...P.querySelectorAll('.vc-group')].map(g=>({name:nm(g),folded:g.classList.contains('vc-folded'),unfolded:g.classList.contains('vc-unfolded'),badge:(g.querySelector(':scope > .vc-node-head > .vc-fold-badge')||{}).textContent,visible:g.offsetWidth>0}));
  const leaves=[...P.querySelectorAll(':scope > .vc-zone-body > .vc-unit')].map(u=>u.getBoundingClientRect().bottom);
  return {zones:document.querySelector('.vc-zones').className, top, all, leaves, first:[...P.querySelectorAll('.vc-chev-first')].map(e=>e.dataset.vcId),
    btns:[...document.querySelectorAll('.vc-fold-all')].map(b=>b.dataset.fold), rowDir:getComputedStyle(document.querySelector('.vc-activities-row')).flexDirection};
})()`;
const groupId = (h, name) => h.ev(`(()=>{const g=[...document.querySelectorAll('.vc-zone-primary .vc-group')].find(g=>g.querySelector(':scope > .vc-node-head textarea').value===${JSON.stringify(name)});return g&&g.dataset.vcId})()`);

// [a]–[d] bio-aesthetic 1400
{
  const h = await launch();
  try {
    await fresh(h); await goChain(h);
    await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400);
    const porterDom = await domSig(h);
    await setLayout(h, 'fold');
    ok(h.errors().length === 0 && (await h.ev('valueChain.layout')) === 'fold', `[a] 切 fold 無 error ${JSON.stringify(h.errors())}`);
    const f = await h.ev(foldInfo);
    ok(/vc-layout-band/.test(f.zones) && /vc-layout-fold/.test(f.zones), `[a] zones class「${f.zones}」`);
    const want = { '醫療服務': '＋7', '術後照護': '＋3', '醫學美容': '＋5', '周邊商品': '＋5' };
    ok(f.top.length === 4 && f.top.every(t => t.folded && t.badge === want[t.name] && t.badgeShown), `[a] 頂層群組全收合、角標 ${JSON.stringify(f.top.map(t => [t.name, t.folded, t.badge]))}`);
    ok(f.top.every(t => t.bodyDisp === 'none' && /polygon/.test(t.clip)), `[a] 收合群組 body 隱藏、本身 chevron（${f.top.map(t => t.bodyDisp + '/' + t.clip.slice(0, 12))}）`);
    const bs = [...f.leaves, ...f.top.map(t => t.bottom)];
    ok(Math.max(...bs) - Math.min(...bs) <= 2, `[a] 收合 chevron 與葉節點底緣對齊 ${bs.map(Math.round)}`);
    ok(f.first.length === 1, `[a] vc-chev-first 只有一支（${f.first}）`);
    ok(JSON.stringify(f.btns) === '["open","close"]', `[a] 全部展開／收合按鈕 ${f.btns}`);
    const lc = await h.ev(linkCheck);
    const gMed = f.top.find(t => t.name === '醫療服務').id, gCare = f.top.find(t => t.name === '術後照護').id;
    ok(lc.n === lc.exp && lc.n === 2 && !lc.bad.length, `[a] 連線 ${lc.n}＝跨收合群組 ${lc.exp}、端點在邊上 ${JSON.stringify(lc.bad)}`);
    ok(JSON.stringify(lc.ends) === JSON.stringify([['ae_diag', gMed], [gMed, gCare]]), `[a] 端點接到收合群組 ${JSON.stringify(lc.ends)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/a-bio-fold-collapsed.png`);

    // [b] 真滑鼠點「醫療服務」角標
    const storeBefore = await h.ev(`localStorage.getItem('strategyMatrix_v4')`);
    const bp = await h.ev(`(()=>{const b=document.querySelector('[data-vc-id="${gMed}"] > .vc-node-head > .vc-fold-badge');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await h.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bp.x, y: bp.y, button: 'left', clickCount: 1 });
    await h.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bp.x, y: bp.y, button: 'left', clickCount: 1 });
    // 滑鼠移開：band 橫帶 hover 時動作鈕換行會讓版面變高、連線不重畫（既有行為，見 ST-37），避免干擾後續量測
    await h.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
    await sleep(400);
    const f2 = await h.ev(foldInfo);
    const med = f2.all.find(a => a.name === '醫療服務'), west = f2.all.find(a => a.name === '西醫醫療服務'), cm = f2.all.find(a => a.name === '中醫醫療服務');
    ok(med.unfolded && med.badge === '▾' && west.visible && west.folded && west.badge === '＋6' && cm.visible && cm.folded && cm.badge === '＋1',
      `[b] 點角標展開醫療服務、子群組出現且收合 ${JSON.stringify([med, west, cm])}`);
    const lc2 = await h.ev(linkCheck);
    const gCm = await groupId(h, '中醫醫療服務');
    ok(lc2.n === lc2.exp && lc2.n === 2 && !lc2.bad.length && JSON.stringify(lc2.ends) === JSON.stringify([['ae_diag', gCm], [gCm, gCare]]),
      `[b] 展開後連線重畫、端點落在子項 ${JSON.stringify(lc2.ends)} ${JSON.stringify(lc2.bad)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/b-bio-fold-open.png`);
    // 點名稱不切換、點標題空白處收合
    await h.ev(`document.querySelector('[data-vc-id="${gMed}"] > .vc-node-head textarea').click(); 0`); await sleep(200);
    ok((await h.ev(`document.querySelector('[data-vc-id="${gMed}"]').classList.contains('vc-unfolded')`)), `[b] 點名稱 textarea 不切換`);
    await h.ev(`document.querySelector('[data-vc-id="${gMed}"] > .vc-node-head').click(); 0`); await sleep(300);
    ok((await h.ev(`document.querySelector('[data-vc-id="${gMed}"]').classList.contains('vc-folded')`)), `[b] 點標題空白處收合`);
    ok(storeBefore === (await h.ev(`localStorage.getItem('strategyMatrix_v4')`)), `[b] 收合／展開不寫 localStorage`);
    await clickBtn(h, 'open');
    const f3 = await h.ev(foldInfo);
    const lc3 = await h.ev(linkCheck);
    ok(f3.all.every(a => !a.folded && a.unfolded) && lc3.n === 2 && !lc3.bad.length && JSON.stringify(lc3.ends) === JSON.stringify([['ae_diag', 'ae_cm'], ['ae_cmclinic', 'ae_cmcare']]),
      `[b] 全部展開：無收合、連線接原節點 ${JSON.stringify(lc3.ends)} ${JSON.stringify(f3.all.filter(a => a.folded || !a.unfolded))} ${JSON.stringify(lc3)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/b-bio-fold-all-open.png`);
    await clickBtn(h, 'close');
    const f4 = await h.ev(foldInfo);
    ok(f4.top.every(t => t.folded), `[b] 全部收合：頂層全收合`);

    // [d] reload：仍 fold、回到全收合；切回 porter DOM 相同
    await clickBtn(h, 'open');
    await h.open(html); await goChain(h);
    const f5 = await h.ev(foldInfo);
    ok((await h.ev('valueChain.layout')) === 'fold' && f5.top.length === 4 && f5.top.every(t => t.folded), `[d] reload 後 layout=fold、全部收合`);
    ok(!/fold/i.test(JSON.stringify(JSON.parse(await h.ev(`localStorage.getItem('strategyMatrix_v4')`)).valueChain).replace(/"layout":"fold"/, '')), `[d] 存檔除 layout 外沒有收合狀態`);
    await setLayout(h, 'porter');
    const back = await domSig(h);
    ok(back === porterDom, `[d] 切回 porter DOM 與切換前相同（${porterDom.length}/${back.length}）`);
    ok(h.errors().length === 0, `[a–d] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [c] 內部連線略過
{
  const h = await launch();
  try {
    await fresh(h); await goChain(h);
    await setVc(h, {
      support: [{ id: 's1', name: '人力資源', type: 'unit' }],
      primary: [
        { id: 'a', name: '研發', type: 'unit' },
        { id: 'g1', name: '製造', type: 'group', children: [
          { id: 'b1', name: '原料採購', type: 'unit' },
          { id: 'g2', name: '生產', type: 'group', children: [{ id: 'c1', name: '前段製程', type: 'unit' }, { id: 'c2', name: '後段封裝', type: 'unit', unitKind: 'asset' }] },
          { id: 'b2', name: '品管', type: 'unit' } ] },
        { id: 'd', name: '行銷', type: 'unit' },
        { id: 'g3', name: '服務', type: 'group', children: [{ id: 'e1', name: '客服', type: 'unit' }, { id: 'e2', name: '維修', type: 'unit' }] },
        { id: 'g4', name: '空群組', type: 'group', children: [] },
      ],
      products: [{ id: 'p1', name: '產品一', type: 'unit' }],
      links: [{ id: 'l1', from: 'a', to: 'c1' }, { id: 'l2', from: 'c2', to: 'd' }, { id: 'l3', from: 's1', to: 'b2' }, { id: 'l4', from: 'e2', to: 'p1' },
        { id: 'l5', from: 'g1', to: 'g3' }, { id: 'l6', from: 'b1', to: 'e1' }, { id: 'l7', from: 'b1', to: 'b2' }],
      showArrowBg: true, layout: 'fold',
    });
    const lc = await h.ev(linkCheck);
    ok(lc.links === 7 && lc.n === 6 && lc.exp === 6 && !lc.bad.length, `[c] 收合時內部連線略過：links ${lc.links}、畫 ${lc.n}、端點 ${JSON.stringify(lc.bad)}`);
    const emp = await h.ev(`document.querySelector('[data-vc-id="g4"]').className`);
    ok(!/vc-folded/.test(emp), `[c] 空群組不收合（${emp}）`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/c-test-fold.png`);
    await clickBtn(h, 'open');
    const lc2 = await h.ev(linkCheck);
    ok(lc2.n === 7 && !lc2.bad.length, `[c] 全部展開畫 7 條、端點在邊上 ${JSON.stringify(lc2.bad)}`);
    ok(h.errors().length === 0, `[c] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [e] 800 寬直排、全展開
{
  const h = await launch({ width: 800, height: 900 });
  try {
    await fresh(h); await goChain(h);
    await h.ev(`loadValueChainTemplate('bio-aesthetic'); 0`); await sleep(400);
    await setLayout(h, 'fold');
    await h.open(html); await goChain(h);
    const f = await h.ev(foldInfo);
    ok(f.top.every(t => t.bodyDisp !== 'none' && !t.badgeShown) && f.all.every(a => a.visible) && f.rowDir === 'column', `[e 800] 直排、無隱藏、無角標（${f.rowDir}）`);
    const lc = await h.ev(linkCheck);
    ok(lc.n === lc.links && !lc.bad.length && JSON.stringify(lc.ends) === JSON.stringify([['ae_diag', 'ae_cm'], ['ae_cmclinic', 'ae_cmcare']]), `[e 800] 連線接原節點 ${JSON.stringify(lc.ends)}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/e-bio-fold-800.png`);
    ok(h.errors().length === 0, `[e 800] console error 0 ${JSON.stringify(h.errors())}`);
  } finally { await h.close(); }
}

// [f] 範例與 fixtures
for (const id of ['bookstore-a', 'foundry-t']) {
  const h = await launch();
  try {
    await fresh(h); await h.loadExample(id); await goChain(h);
    await setLayout(h, 'fold');
    const lc = await h.ev(linkCheck);
    ok(h.errors().length === 0 && lc.n === lc.exp && !lc.bad.length, `[f 範例 ${id}] fold 無 error、連線 ${lc.n}/${lc.exp}（links ${lc.links}） ${JSON.stringify(h.errors())}`);
    const raw = JSON.stringify(JSON.parse(readFileSync(`${root}/tests/fixtures/strategyMatrix_v4-${id}.json`, 'utf8')));
    await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(raw)}); 0`);
    await h.open(html); await goChain(h);
    await setLayout(h, 'fold');
    const lc2 = await h.ev(linkCheck);
    ok(h.errors().length === 0 && lc2.n === lc2.exp && !lc2.bad.length, `[f fixture ${id}] 載入＋fold 無 error、連線 ${lc2.n}/${lc2.exp} ${JSON.stringify(h.errors())}`);
    await h.shot('#valueChainEditor .vc-zones', `${out}/f-${id}-fold.png`);
  } finally { await h.close(); }
}

console.log(fail ? `\n${fail} 項 FAIL` : '\n全部 PASS');
process.exit(fail ? 1 : 0);
