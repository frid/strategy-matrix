// ST-47 驗收 spec（測試先行；dev cc11d02 上預期失敗）
// TODO（# Bug）：「ST-47 價值鏈編輯器在 375px 寬（手機）會橫向捲動：ST-29 spec 的 375×667 斷言量到 document scrollWidth 667 > 375
//   （v1.2.0），支援活動欄表頭與主要活動列未在窄螢幕收合；應讓 document 層級不橫向捲動（容器內捲動可接受）」
//
// ── 診斷（planner 在 dev cc11d02 量測，/home/frid/.claude/jobs/a606fbe4/tmp/st47/probe-dev.txt）──
// 375×667 價值鏈 tab：醫美範本（loadValueChainTemplate('bio-aesthetic')）與 bookstore-a，六版型 scrollWidth 都 > 375：
//   porter／band／fold／segment／hex：scrollWidth=667；circle：scrollWidth=524。#valueChainEditor 本身 right=339（沒被撐開），
//   溢出的是它的後代（editor 沒有 overflow 設定，所以直接撐大 document）。
// 溢出元素兩類（都在 .vc-zones 內，與主要活動括號 .vc-primary-label 無關，ST-45 改括號 grid 不影響本 spec）：
//   1. 主要活動列「頂層」價值單元（`.vc-zone-primary > .vc-zone-body > .vc-unit`，不在群組內，bookstore-a 有 11 個、醫美範本 2 個）：
//      .vc-unit w=462 right=498，其 .vc-node-head w=400，textarea.vc-name-wrap w=404（inline style.width 只有 2.6～5.6em，
//      卻量到 404px），後面的 span.vc-kind／.vc-role／.vc-act／.vc-act-remove 一路排到 right=667。
//      原因：index.html 約 959–963 行 ST-38 的 @media (max-width:800px) 規則
//        `#valueChainEditor .vc-zones:not(.vc-layout-circle) .vc-zone-primary .vc-unit > .vc-node-head > textarea.vc-name-wrap { width:100% !important; … }`
//      也套到頂層單元，但頂層單元是 `flex: 0 0 auto; white-space: nowrap`（約 397–399 行）、.vc-node-head 是 `flex: 0 1 auto`，
//      沒有任何寬度上限 → textarea 100% 參照的是由內容決定寬度的父層，循環後被撐到 ~400px。
//      circle 版型（約 950–957 行）則是 `.vc-unit > .vc-node-head { flex:1 1 auto }` ＋ textarea `flex: 1 1 calc(100% - 56px)`，
//      同樣父層無上限 → .vc-unit w=488 right=524。
//   2. 支援活動橫條（`.vc-zone-support .vc-unit > .vc-node-head`，「醫師招募訓練管理」等）：.vc-node-head w=349／367，
//      right=400／418（editor 右緣 339，溢出 20～80px）。.vc-node-head 是 `display:flex; gap:3px` 不換行，裡面 ☺ icon 鈕＋
//      名稱 input（JS 設 style.width=字數+2 em，約 8270 行 sizeVcInput）＋「活動」「＋角色」「＋同層」「✕」四個 nowrap 標籤加起來
//      比欄寬多；.vc-zone-support .vc-unit 又有 padding 9px 30px 9px 14px（約 455 行）。
// 414×896：同上（porter 系 667、circle 524）。
// 801×900：醫美範本 circle 版型 scrollWidth=975（頂層群組「醫療服務」.vc-group w=907、巢狀子群組「中醫醫療服務」w=343；
//   約 940 行 circle 群組 head 的 textarea `flex: 1 0 100%; white-space: nowrap` 配 `.vc-group { flex: 0 0 auto }`）；其餘 11 組與
//   1440×900 全部 12 組都不溢出。
// 現有 @media (max-width: 800px) 區塊：359–363（.vc-zones 改單欄、藏括號／Margin、.vc-activities-row 直排）、486–494（產品欄）、
//   950–957（circle）、959–964（ST-38 群組內葉節點撐滿）。沒有任何規則讓「頂層」價值單元與支援活動橫條在窄螢幕收合。
// 建議改法（給 worker 參考，不限定）：在 ≤800px 區塊加
//   `.vc-zone-primary > .vc-zone-body > .vc-unit { flex: 1 1 100%; max-width: 100%; min-width: 0; white-space: normal; }`、
//   `.vc-zone-primary > .vc-zone-body > .vc-unit > .vc-node-head { flex: 1 1 auto; min-width: 0; flex-wrap: wrap; }`，
//   支援活動 `.vc-zone-support .vc-unit > .vc-node-head { flex-wrap: wrap; min-width: 0 }` 且名稱 input `max-width: 100%`（或 flex:1 1 auto）；
//   circle 群組 head 的 textarea 在窄螢幕改 `flex: 1 1 100%; white-space: normal`。也可讓 .vc-zones 在 ≤800px `max-width:100%; overflow-x:auto`
//   （本 spec 允許 overflow-x:auto/scroll 的容器內部捲動），但 (e) 仍要求支援活動名稱在 375 viewport 內可見。
//
// 受測頁面預設為本 worktree 的 index.html；設環境變數 SM_INDEX_HTML=<絕對路徑> 可改測別的版本。
import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const indexUrl = process.env.SM_INDEX_HTML
  ? pathToFileURL(process.env.SM_INDEX_HTML)
  : new URL('../../index.html', import.meta.url);

const LAYOUTS = ['porter', 'band', 'fold', 'segment', 'circle', 'hex'] as const;
// 兩個樣本：醫美範本（價值鏈範本，用 loadValueChainTemplate）與 bookstore-a（範例專案）
const SAMPLES = ['bio-aesthetic', 'bookstore-a'] as const;
type Sample = typeof SAMPLES[number];

type Ctx = { page: Page; errors: string[] };

async function open(page: Page, width: number, height: number): Promise<Ctx> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.setViewportSize({ width, height });
  await page.goto(indexUrl.href);
  await page.waitForLoadState('load');
  await page.evaluate(() => localStorage.clear());
  return { page, errors };
}

// 載入樣本並切到價值鏈 tab
async function loadSample(page: Page, sample: Sample) {
  if (sample === 'bookstore-a') {
    // @ts-ignore 頁面全域
    await page.evaluate(() => loadExampleProject('bookstore-a'));
  } else {
    // @ts-ignore 頁面全域（confirm 由 dialog handler 自動接受）
    await page.evaluate(() => loadValueChainTemplate('bio-aesthetic'));
  }
  // @ts-ignore 頁面全域
  await page.evaluate(() => guideGoto('chain'));
  await expect(page.locator('#valueChainEditor .vc-zones')).toHaveCount(1);
}

async function setLayout(page: Page, layout: string) {
  // @ts-ignore 頁面全域
  await page.evaluate(l => { valueChain.layout = l; commitValueChain(); }, layout);
  // 版型切換後 zones 的 class 要反映（porter 沒有 vc-layout-* class）
  await expect.poll(async () => page.evaluate(() => document.querySelector('#valueChainEditor .vc-zones')!.className))
    .toMatch(layout === 'porter' ? /^((?!vc-layout-).)*$/ : new RegExp(`vc-layout-${layout}`));
}

// document 層級的橫向捲動量測
const docScroll = (page: Page) => page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));

// #valueChainEditor 右緣，以及其後代中 right > limit 的元素（overflow-x 為 auto/scroll 的容器內部不計）
const editorOverflow = (page: Page, limit: number) => page.evaluate(limit => {
  const ed = document.getElementById('valueChainEditor')!;
  const scrollers: Element[] = [];
  const over: string[] = [];
  for (const e of ed.querySelectorAll('*')) {
    if (scrollers.some(s => s.contains(e))) continue;
    const cs = getComputedStyle(e);
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') scrollers.push(e);
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.right > limit) {
      const txt = ((e as HTMLInputElement).value || e.textContent || '').trim().slice(0, 12);
      over.push(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} right=${Math.round(r.right)} "${txt}"`);
    }
  }
  return { editorRight: ed.getBoundingClientRect().right, count: over.length, over: over.slice(0, 10) };
}, limit);

// 在指定 viewport 下，對一個樣本逐一套六種版型，收集 document 橫向捲動的失敗
async function collectDocScrollFailures(page: Page, sample: Sample) {
  await loadSample(page, sample);
  const fails: string[] = [];
  for (const layout of LAYOUTS) {
    await setLayout(page, layout);
    const d = await docScroll(page);
    if (d.scrollWidth > d.clientWidth) fails.push(`${sample}/${layout}: scrollWidth ${d.scrollWidth} > clientWidth ${d.clientWidth}`);
  }
  return fails;
}

// (a) 核心：「應讓 document 層級不橫向捲動」— 375×667、兩樣本 × 六版型，價值鏈 tab scrollWidth <= clientWidth
for (const sample of SAMPLES) {
  test(`(a) 375×667 ${sample}：六種版型 document 不橫向捲動`, async ({ page }) => {
    const { errors } = await open(page, 375, 667);
    const fails = await collectDocScrollFailures(page, sample);
    expect(fails, fails.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (b) 「支援活動欄表頭與主要活動列未在窄螢幕收合」— 375 下 #valueChainEditor 右緣 <= 376，
//     且其後代沒有任何元素 right > 376（overflow-x:auto/scroll 的容器內部捲動可接受：「容器內捲動可接受」）
for (const sample of SAMPLES) {
  test(`(b) 375×667 ${sample}：#valueChainEditor 與其後代都收在 375px 內（六版型）`, async ({ page }) => {
    const { errors } = await open(page, 375, 667);
    await loadSample(page, sample);
    const fails: string[] = [];
    for (const layout of LAYOUTS) {
      await setLayout(page, layout);
      const o = await editorOverflow(page, 376);
      if (o.editorRight > 376) fails.push(`${sample}/${layout}: #valueChainEditor right=${o.editorRight}`);
      if (o.count > 0) fails.push(`${sample}/${layout}: ${o.count} 個後代超出 376px，例如\n    ${o.over.join('\n    ')}`);
    }
    expect(fails, fails.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (c) 414×896（大一點的手機）同樣不橫向捲動
for (const sample of SAMPLES) {
  test(`(c) 414×896 ${sample}：六種版型 document 不橫向捲動`, async ({ page }) => {
    const { errors } = await open(page, 414, 896);
    const fails = await collectDocScrollFailures(page, sample);
    expect(fails, fails.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (d) 回歸：1440×900 與 801×900（剛超過 800px 斷點的寬螢幕版型）不橫向捲動
for (const [w, h] of [[1440, 900], [801, 900]] as const) {
  for (const sample of SAMPLES) {
    test(`(d) ${w}×${h} ${sample}：六種版型 document 不橫向捲動（回歸）`, async ({ page }) => {
      const { errors } = await open(page, w, h);
      const fails = await collectDocScrollFailures(page, sample);
      expect(fails, fails.join('\n')).toEqual([]);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}

// (e1) 「支援活動欄表頭…未在窄螢幕收合」→ 收合後仍可用：375 下醫美範本（有 8 條支援活動；bookstore-a 沒有支援活動）
//      每條支援活動的 .vc-node-head 右緣 <= 376，名稱輸入框可見（寬高 > 0、整個在 viewport 內）；改名後 pageerror／console.error 為 []
test('(e1) 375×667 bio-aesthetic：支援活動表頭收在 375px 內、名稱可見、改名無錯誤', async ({ page }) => {
  const { errors } = await open(page, 375, 667);
  await loadSample(page, 'bio-aesthetic');
  await setLayout(page, 'porter');

  const heads = page.locator('#valueChainEditor .vc-zone-support .vc-unit > .vc-node-head');
  const n = await heads.count();
  expect(n, '支援活動數').toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const head = heads.nth(i);
    const name = head.locator(':is(input, textarea)').first();
    const val = await name.inputValue();
    const h = await head.evaluate(e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; });
    expect(h.r, `支援活動「${val}」表頭右緣`).toBeLessThanOrEqual(376);
    const r = await name.evaluate(e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, h: b.height }; });
    expect(r.w, `支援活動「${val}」名稱框寬度`).toBeGreaterThan(0);
    expect(r.h, `支援活動「${val}」名稱框高度`).toBeGreaterThan(0);
    expect(r.l, `支援活動「${val}」名稱框左緣`).toBeGreaterThanOrEqual(-1);
    expect(r.r, `支援活動「${val}」名稱框右緣`).toBeLessThanOrEqual(376);
  }

  // 改名：第一條支援活動
  const first = heads.first().locator(':is(input, textarea)').first();
  await first.fill('手機改名測試');
  await first.press('Enter');
  // @ts-ignore 頁面全域
  await expect.poll(() => page.evaluate(() => valueChain.support.map((u: { name: string }) => u.name))).toContain('手機改名測試');
  // 改名後仍不橫向捲動
  const d = await docScroll(page);
  expect(d.scrollWidth, '改名後 scrollWidth').toBeLessThanOrEqual(d.clientWidth);
  expect(errors, errors.join('\n')).toEqual([]);
});

// (e2) 「主要活動列未在窄螢幕收合」→ 收合後仍可操作：375 下 bookstore-a 拖曳一個頂層價值單元換位、改名後無錯誤且不橫向捲動
test('(e2) 375×667 bookstore-a：拖曳頂層價值單元換位、改名無錯誤', async ({ page }) => {
  const { errors } = await open(page, 375, 667);
  await loadSample(page, 'bookstore-a');
  await setLayout(page, 'porter');

  // 拖曳：把主要活動列第 1 個頂層單元拖到第 2 個之後（模擬 HTML5 DnD：dragstart → dragover → drop）
  const topUnits = () => page.evaluate(() => [...document.querySelectorAll('#valueChainEditor .vc-zone-primary > .vc-zone-body > .vc-unit')].map(e => (e as HTMLElement).dataset.vcId));
  const before = await topUnits();
  expect(before.length).toBeGreaterThanOrEqual(2);
  await page.evaluate(([a, b]) => {
    const src = document.querySelector(`[data-vc-id="${a}"]`)!, tgt = document.querySelector(`[data-vc-id="${b}"]`)!;
    const dt = new DataTransfer(); const r = tgt.getBoundingClientRect();
    const x = r.left + r.width * 0.9, y = r.top + r.height * 0.9;
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    tgt.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  }, [before[0]!, before[1]!]);
  const after = await topUnits();
  expect(after.length, '拖曳後頂層單元數不變').toBe(before.length);
  expect(after.indexOf(before[0]!), '第 1 個單元拖到第 2 個之後').toBeGreaterThan(after.indexOf(before[1]!));

  // 改名：拖完後的第一個頂層單元
  const name = page.locator('#valueChainEditor .vc-zone-primary > .vc-zone-body > .vc-unit').first().locator('.vc-node-head :is(input, textarea)').first();
  await name.fill('手機改名測試');
  await name.press('Enter');
  // @ts-ignore 頁面全域
  await expect.poll(() => page.evaluate(() => valueChain.primary.map((u: { name: string }) => u.name))).toContain('手機改名測試');
  const d = await docScroll(page);
  expect(d.scrollWidth, '拖曳＋改名後 scrollWidth').toBeLessThanOrEqual(d.clientWidth);
  expect(errors, errors.join('\n')).toEqual([]);
});

// (f) 視覺基準：375 下 bookstore-a porter 的 #valueChainEditor（基準 PNG 由 worker 實作完成後產生）
test('(f) 375×667 bookstore-a porter：#valueChainEditor 截圖', async ({ page }) => {
  const { errors } = await open(page, 375, 667);
  await loadSample(page, 'bookstore-a');
  await setLayout(page, 'porter');
  await expect(page.locator('#valueChainEditor')).toHaveScreenshot('ST-47-375-bookstore-porter.png', { maxDiffPixelRatio: 0.01 });
  expect(errors, errors.join('\n')).toEqual([]);
});
