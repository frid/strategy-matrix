// ST-35h 自測：分色模式（COLOR_PALETTES[i].perUnit）——價值鏈主要活動頂層依序取色、矩陣表頭同色、PPTX 跟著走。
// 跑法：CLAUDE_JOB_DIR=... node tools/selftest/ST-35h.mjs   （需 Chrome；截圖寫 $CLAUDE_JOB_DIR/tmp/ST-35h/）
// 測了什麼：
//   [a] 對比度（WCAG）：三套分色的 perUnit 每色對白字、淡版（18% 混白）對深版（70% 混黑）、支援活動底對字、
//       矩陣支援細項底對字、角落／列標籤底對字，全部 ≥ 4.5；perUnit 色數 ≥ 5；單色六套沒有 perUnit
//   [b] 三套分色 × { bookstore-a（porter）、bio-aesthetic 範本展開到矩陣（band） } 1400 寬：
//       .vc-zones 有 vc-per-unit、#matrixTable 有 matrix-per-unit；主要活動相鄰頂層的代表色（單元底色／群組第一個葉節點底色）不同；
//       群組內所有非資產葉節點底色＝該群組的 --vc-unit-color；矩陣 th[data-vc-top]：群組表頭／無群組欄底色＝價值鏈該頂層葉節點底色，
//       細項表頭底色＝同色淡版；支援活動欄表頭沒有 data-vc-top；截圖 vc-<套>-<範例>.png、mx-<套>-<範例>.png
//   [c] 切回「價值鏈同調」：沒有任何元素留 --vc-unit-color、沒有 vc-per-unit／matrix-per-unit，
//       #valueChainEditor（去 svg）與 #matrixTable thead 的 outerHTML 與切換前相同
//   [d] exportPptx：三套分色不拋例外、slide1（價值鏈頁）含 ≥ 2 種 perUnit 填色；pptxPalette().perUnit 在單色模式為 null；
//       單色模式匯出 slide1 與切過分色再切回後的匯出逐字相同
//   [e] console error 0
// 預期：全部 PASS、exit 0。
import { launch } from '../cdp-harness.mjs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = root + '/index.html';
const out = (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : tmpdir()) + '/ST-35h'; mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// WCAG 對比
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (h, pct, w) => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * pct + parseInt(w.slice(i, i + 2), 16) * (1 - pct)).toString(16).padStart(2, '0')).join('');

const setPalette = async (h, idx) => { await h.ev(`(()=>{const s=document.getElementById('paletteSelect');s.value=String(${idx});s.dispatchEvent(new Event('change'));})(); 0`); await sleep(300); };
const setLayout = async (h, v) => { await h.ev(`(()=>{const s=document.querySelector('.vc-layout-select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change'));})(); 0`); await sleep(500); };
const sig = h => h.ev(`(()=>{const c=document.getElementById('valueChainEditor').cloneNode(true);c.querySelectorAll('svg').forEach(s=>s.remove());
  return c.innerHTML + '|||' + document.querySelector('#matrixTable thead').outerHTML + '|||' + document.getElementById('matrixTable').getAttribute('class')})()`);
const probe = `(()=>{
  const bg=e=>getComputedStyle(e).backgroundColor;
  const tops=[...document.querySelectorAll('#valueChainEditor .vc-zone-primary > .vc-zone-body > [data-vc-id]')];
  const leafOf=t=>t.classList.contains('vc-unit')?t:t.querySelector('.vc-unit:not(.vc-asset)');
  const top=tops.map((t,i)=>{const lf=leafOf(t);const uc=t.style.getPropertyValue('--vc-unit-color');
    const kids=[...t.querySelectorAll('.vc-group-body .vc-unit:not(.vc-asset)')].map(bg);
    const d=document.createElement('div');d.style.background=uc?'color-mix(in srgb, '+uc+' 18%, white)':'';document.body.appendChild(d);const tint=bg(d);d.remove();
    const d2=document.createElement('div');d2.style.background=uc;document.body.appendChild(d2);const full=bg(d2);d2.remove();
    return {i,id:t.dataset.vcId,group:t.classList.contains('vc-group'),asset:t.classList.contains('vc-asset'),uc,rep:lf?bg(lf):null,kids,full,tint}});
  const th=[...document.querySelectorAll('#matrixTable thead th')].map(e=>({t:e.textContent.slice(0,8),cls:e.className,top:e.dataset.vcTop,bg:bg(e)}));
  return {zones:document.querySelector('.vc-zones').className, table:document.getElementById('matrixTable').className, top, th};
})()`;

const h = await launch({ width: 1400, height: 900 });
try {
  await h.open(html); await h.ev('localStorage.clear(); 0'); await h.open(html);
  const pals = await h.ev(`COLOR_PALETTES.map((p,i)=>({i,name:p.name,perUnit:p.perUnit||null,v:p.vars}))`);
  const per = pals.filter(p => p.perUnit);
  ok(per.length === 3 && per.map(p => p.name).join() === '分色・鮮彩,分色・沉穩土色,分色・藍綠紫', `[a] 三套分色 ${per.map(p => p.name)}`);
  ok(pals.slice(0, 6).every(p => !p.perUnit), '[a] 前六套單色沒有 perUnit');
  // [a] 對比度
  per.forEach(p => {
    const rows = [];
    p.perUnit.forEach(c => { rows.push([c + '/白', cr(c, '#FFFFFF')]); rows.push([c + ' 淡/深', cr(mix(c, 0.18, '#FFFFFF'), mix(c, 0.7, '#000000'))]); });
    const v = p.v;
    rows.push(['支援', cr(v['--vc-support-bg'], v['--vc-support-text'])]);
    rows.push(['支援細項', cr(v['--mx-support-leaf-bg'], v['--mx-support-leaf-text'])]);
    rows.push(['角落', cr(v['--mx-corner-bg'], v['--mx-corner-text'])]);
    rows.push(['Margin', cr(v['--vc-margin-bg'], v['--vc-margin-text'])]);
    const bad = rows.filter(r => r[1] < 4.5);
    console.log('   ' + p.name + '：' + rows.map(r => r[0] + ' ' + r[1].toFixed(2)).join('、'));
    ok(p.perUnit.length >= 5 && !bad.length, `[a] ${p.name} 對比全部 ≥ 4.5 ${JSON.stringify(bad)}`);
  });

  for (const ex of [{ key: 'bookstore', layout: 'porter' }, { key: 'bio', layout: 'band' }]) {
    await h.ev('localStorage.clear(); 0'); await h.open(html);
    if (ex.key === 'bookstore') await h.loadExample('bookstore-a');
    else { await h.ev(`guideGoto('chain'); loadValueChainTemplate('bio-aesthetic'); expandValueChainToMatrix(true); 0`); await sleep(500); }
    await h.ev(`guideGoto('chain'); 0`); await sleep(500);
    await setLayout(h, ex.layout);
    await setPalette(h, 0);
    const before = await sig(h);
    for (const p of per) {
      await setPalette(h, p.i);
      const r = await h.ev(probe);
      const tag = `[b] ${p.name} ${ex.key}/${ex.layout}`;
      ok(/vc-per-unit/.test(r.zones) && /matrix-per-unit/.test(r.table), `${tag} class 已加`);
      const reps = r.top.filter(t => !t.asset && t.rep);
      const adj = reps.filter((t, k) => k > 0 && t.rep === reps[k - 1].rep && reps[k - 1].i === t.i - 1);
      ok(reps.length >= 3 && !adj.length, `${tag} 相鄰頂層代表色不同（${reps.length} 個）${JSON.stringify(adj.map(t => t.id))}`);
      const badKids = r.top.filter(t => t.group && t.kids.some(k => k !== t.full));
      const nGroups = r.top.filter(t => t.group && t.kids.length).length;  // bookstore-a 沒有群組；bio-aesthetic 必須有
      ok((ex.key !== 'bio' || nGroups >= 3) && !badKids.length, `${tag} 群組內子項同色（${nGroups} 個群組）${JSON.stringify(badKids.map(t => t.id))}`);
      const thTop = r.th.filter(t => t.top !== undefined);
      const badTh = thTop.filter(t => {
        const T = r.top[Number(t.top)];
        if (!T) return true;
        return /col-header-leaf/.test(t.cls) ? t.bg !== T.tint : t.bg !== T.full;
      });
      const sup = r.th.filter(t => /support-col-header/.test(t.cls));
      ok(thTop.length >= 3 && !badTh.length && sup.every(t => t.top === undefined),
        `${tag} 矩陣 ${thTop.length} 個表頭與價值鏈同色（支援欄 ${sup.length} 個不取色）${JSON.stringify(badTh)}`);
      const slug = p.name.replace('分色・', '');
      await h.shot('#valueChainEditor .vc-zones', `${out}/vc-${slug}-${ex.key}-${ex.layout}.png`);
      await h.ev(`guideGoto('cells'); 0`); await sleep(500);
      await h.shot('#matrixTable', `${out}/mx-${slug}-${ex.key}.png`);
      await h.ev(`guideGoto('chain'); 0`); await sleep(500);
    }
    await setPalette(h, 0);
    const left = await h.ev(`[...document.querySelectorAll('[style*="--vc-unit-color"]')].length`);
    const after = await sig(h);
    ok(left === 0 && after === before, `[c] ${ex.key} 切回價值鏈同調：inline 變數 ${left}、DOM 與切換前${after === before ? '相同' : '不同'}`);
  }

  // [d] PPTX
  await h.ev('localStorage.clear(); 0'); await h.open(html);
  await h.loadExample('bookstore-a');
  await h.captureDownloads();
  const slide1 = async () => { const n = (await h.downloads()).length; await h.ev('exportPptx()'); for (let i = 0; i < 40 && (await h.downloads()).length === n; i++) await sleep(250); const z = await h.zipEntries(n); return z.read('ppt/slides/slide1.xml'); };
  await setPalette(h, 0);
  ok(await h.ev('pptxPalette().perUnit === null'), '[d] 單色模式 pptxPalette().perUnit === null');
  const mono1 = await slide1();
  for (const p of per) {
    await setPalette(h, p.i);
    let xml = '', err = null;
    try { xml = await slide1(); } catch (e) { err = e.message; }
    const used = p.perUnit.filter(c => xml.includes(`val="${c.slice(1).toUpperCase()}"`));
    ok(!err && used.length >= 2, `[d] ${p.name} 匯出不拋例外、slide1 用到 ${used.length} 種 perUnit 填色 ${err || ''}`);
  }
  await setPalette(h, 0);
  const mono2 = await slide1();
  ok(mono1 === mono2 && mono1.length > 1000, `[d] 單色模式 slide1 切換前後逐字相同（${mono1.length} 字）`);
  ok(h.errors().length === 0, `[e] 無 console error ${JSON.stringify(h.errors())}`);
} finally { await h.close(); }
console.log(fail ? `FAIL ${fail}` : 'ALL PASS', '截圖：' + out);
process.exit(fail ? 1 : 0);
