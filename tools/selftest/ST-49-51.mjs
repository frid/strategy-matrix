// ST-49／50／51 自測（橫帶 band 版型三個 bug）：node tools/selftest/ST-49-51.mjs（需 @playwright/test，已在 node_modules）
// 用 ST-35a spec 的同一份 fixture（頂層＋兩層巢狀群組），1440×900、layout='band'：
//   [51] 印每個主要活動葉節點寬度，預期全部相差 ≤ 1px（原本頂層 161.4／一層內 160.4／兩層內 159.8）、top 相差 ≤ 1px
//   [50] 滑鼠停在葉節點上（含剛點完 .vc-kind 切換活動／資產）時該節點高度不變，預期與其他葉節點同高
//   [49] 按「＋ 群組」後把「品牌」從名稱中央拖進新群組的 .vc-group-body，預期資料變成 新群組[品牌]；
//        另外驗點名稱列仍能進入編輯（textarea 取得 focus）
//   全程收 pageerror／console.error，預期 []。截圖寫到 $CLAUDE_JOB_DIR/tmp/st49/（band-1440.png、hover.png、grouped.png）
// 預期：最後印 ALL PASS、exit 0。
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out = (process.env.CLAUDE_JOB_DIR || '/tmp') + '/tmp/st49'; fs.mkdirSync(out, { recursive: true });
const url = new URL('../../index.html', import.meta.url).href;
const FIX = { v: 1, showArrowBg: true,
  primary: [
    { id: 'u_rd', name: '研發', type: 'unit', unitKind: 'activity' },
    { id: 'g_mfg', name: '製造', type: 'group', children: [
      { id: 'u_buy', name: '採購', type: 'unit', unitKind: 'asset' }, { id: 'u_prod', name: '生產', type: 'unit', unitKind: 'activity' }] },
    { id: 'g_mkt', name: '市場', type: 'group', children: [
      { id: 'g_sales', name: '銷售', type: 'group', children: [
        { id: 'u_store', name: '門市', type: 'unit', unitKind: 'activity' }, { id: 'u_web', name: '網路', type: 'unit', unitKind: 'activity' }] },
      { id: 'u_cs', name: '客服', type: 'unit', unitKind: 'activity' }] },
    { id: 'u_brand', name: '品牌', type: 'unit', unitKind: 'asset' }],
  support: [{ id: 's_hr', name: '人力資源', type: 'unit', unitKind: 'activity' }, { id: 's_it', name: '資訊系統', type: 'unit', unitKind: 'asset' }],
  products: [{ id: 'p_1', name: '產品一', type: 'unit', unitKind: 'activity' }, { id: 'p_2', name: '產品二', type: 'unit', unitKind: 'activity' }],
  links: [{ id: 'l_1', from: 'u_rd', to: 'u_prod' }, { id: 'l_2', from: 'u_store', to: 'u_cs' }, { id: 'l_3', from: 'u_cs', to: 'p_1' }] };
const LEAF = '#valueChainEditor .vc-zone-primary .vc-unit';
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const b = await chromium.launch(); const page = await b.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('dialog', d => d.accept());
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(url);
await page.evaluate(vc => {
  loadExampleProject('bookstore-a');
  valueChain = normaliseValueChain(JSON.parse(JSON.stringify(vc))); resetValueChainIds(valueChain);
  valueChain.layout = 'band'; commitValueChain(); guideGoto('chain');
}, FIX);
await page.waitForTimeout(300);
const leaves = () => page.$$eval(LEAF, els => els.map(e => { const r = e.getBoundingClientRect(); return { id: e.dataset.vcId, w: r.width, h: r.height, top: r.top }; }));
const spread = (a, k) => Math.max(...a.map(x => x[k])) - Math.min(...a.map(x => x[k]));

// [51] 等寬
let L = await leaves();
console.log('葉寬', L.map(l => l.id + ':' + l.w.toFixed(2)).join(' '));
check(spread(L, 'w') <= 1, `[51] 葉節點寬度差 ${spread(L, 'w').toFixed(2)} ≤ 1`);
check(spread(L, 'top') <= 1, `[51] 葉節點 top 差 ${spread(L, 'top').toFixed(2)} ≤ 1`);
await page.locator('#valueChainEditor .vc-zone-primary').screenshot({ path: `${out}/band-1440.png` });

// [50] hover／切換資產後高度
await page.hover(`${LEAF}[data-vc-id="u_web"]`);
L = await leaves();
console.log('hover 網路 高度', L.map(l => l.id + ':' + l.h.toFixed(1)).join(' '));
check(spread(L, 'h') <= 1 && spread(L, 'top') <= 1, `[50] hover 時高度差 ${spread(L, 'h').toFixed(1)}、top 差 ${spread(L, 'top').toFixed(1)} ≤ 1`);
await page.locator('#valueChainEditor .vc-zone-primary').screenshot({ path: `${out}/hover.png` });
await page.click(`${LEAF}[data-vc-id="u_prod"] .vc-kind`);
await page.click(`${LEAF}[data-vc-id="u_buy"] .vc-kind`);
L = await leaves();
console.log('切換後 高度', L.map(l => l.id + ':' + l.h.toFixed(1)).join(' '));
check(spread(L, 'h') <= 1 && spread(L, 'top') <= 1, `[50] 切換活動／資產（滑鼠仍停在節點上）後高度差 ${spread(L, 'h').toFixed(1)}、top 差 ${spread(L, 'top').toFixed(1)} ≤ 1`);
check(await page.evaluate(() => valueChain.primary[1].children.map(c => c.unitKind).join()) === 'activity,asset', '[50] 採購→活動、生產→資產');

// [49] 拖進空群組
await page.mouse.move(5, 5);
await page.locator('#valueChainEditor .vc-zone-primary .vc-zone-footer .col-item-add', { hasText: '＋ 群組' }).click();
const body = page.locator('#valueChainEditor .vc-zone-primary > .vc-zone-body > .vc-group').last().locator(':scope > .vc-group-body');
await page.locator(`${LEAF}[data-vc-id="u_brand"]`).dragTo(body);
const tree = await page.evaluate(() => JSON.stringify(valueChain.primary.map(n => n.name + (n.children ? '[' + n.children.map(c => c.name) + ']' : ''))));
console.log('拖曳後', tree);
check(tree.includes('新群組[品牌]'), '[49] 品牌拖進新群組');
await page.waitForTimeout(250);
await page.locator('#valueChainEditor .vc-zone-primary').screenshot({ path: `${out}/grouped.png` });
await page.click(`${LEAF}[data-vc-id="u_rd"] > .vc-node-head`, { position: { x: 30, y: 10 } });
check(await page.evaluate(() => document.activeElement && document.activeElement.closest('[data-vc-id="u_rd"]') && document.activeElement.tagName === 'TEXTAREA'), '[49] 點名稱列仍進入編輯');
check(errors.length === 0, '無 pageerror／console.error ' + JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FAIL` : 'ALL PASS', '截圖：' + out);
process.exit(fails ? 1 : 0);
