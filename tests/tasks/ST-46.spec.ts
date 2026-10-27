// ST-46 驗收 spec（測試先行）
// TODO：「ST-46 在第三步策略構想下，不用出現"描述策略點"」（assets/20261027_221530.png：③ 時模式列仍有「📝 描述策略點」且被選中）
// 背景：ST-33 已定 ②「策略點描述」才處理策略點描述、③「策略構想」用箭頭表達因果；
//       六步 key 見 GUIDE_STEPS（chain / cells / ideas / premise / action / control），第三步＝'ideas'。
//
// 受測頁面預設為本 worktree 的 index.html；設環境變數 SM_INDEX_HTML=<絕對路徑> 可改測別的版本。
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const indexUrl = process.env.SM_INDEX_HTML
  ? pathToFileURL(process.env.SM_INDEX_HTML)
  : new URL('../../index.html', import.meta.url);

const STEP3 = 'ideas';            // 第三步「策略構想」
const STEP_WITH_DESC = 'premise'; // 第四步「前提驗證」：模式列與策略點面板（#cellPanel）都顯示，描述策略點在此仍有意義，按鈕應保留
const ALL_STEPS = ['chain', 'cells', 'ideas', 'premise', 'action', 'control'];

type Ctx = { page: Page; errors: string[] };

async function open(page: Page): Promise<Ctx> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(indexUrl.href);
  await page.waitForLoadState('load');
  // @ts-ignore 頁面全域
  await page.evaluate(() => loadExampleProject('bookstore-a'));
  return { page, errors };
}

// @ts-ignore 頁面全域
const goto = (page: Page, k: string) => page.evaluate(k => guideGoto(k), k);
// @ts-ignore 頁面全域
const mode = (page: Page) => page.evaluate(() => currentMode as string);
const rect = (page: Page, sel: string) => page.evaluate(sel => {
  const r = document.querySelector(sel)!.getBoundingClientRect();
  return { w: r.width, h: r.height };
}, sel);
const cell = (page: Page, row: string, col: number) => page.locator(`#matrixTable td[data-row="${row}"][data-col="${col}"]`);

// (a) 「在第三步策略構想下，不用出現"描述策略點"」：③ 時 #modeDescBtn 不可見（寬高 0），
//     「✏️ 繪製箭頭」「👁 檢視模式」仍可見且寬高 > 0
test('(a) 第三步策略構想：不顯示「描述策略點」按鈕，繪製／檢視仍顯示', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors } = await open(page);
  await goto(page, STEP3);
  await expect(page.locator('#pane-ideas')).toBeVisible();
  await expect(page.locator('#modeDescBtn')).toBeHidden();
  const desc = await rect(page, '#modeDescBtn');
  expect(desc.w, '描述策略點按鈕寬度應為 0').toBe(0);
  expect(desc.h, '描述策略點按鈕高度應為 0').toBe(0);
  await expect(page.locator('#modeDrawBtn')).toBeVisible();
  await expect(page.locator('#modeViewBtn')).toBeVisible();
  for (const sel of ['#modeDrawBtn', '#modeViewBtn']) {
    const r = await rect(page, sel);
    expect(r.w, `${sel} 寬度`).toBeGreaterThan(0);
    expect(r.h, `${sel} 高度`).toBeGreaterThan(0);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

// (b) 進第三步前若在描述模式（② 會自動切 describe），進第三步後不得停在 describe；
//     點格子是畫箭頭的起點行為（格子標 pending），不開策略點描述面板（#cellPanel 不可見）、無 console error
test('(b) 從描述模式進第三步：模式不是 describe，點格子為畫箭頭行為', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors } = await open(page);
  await goto(page, 'cells');
  expect(await mode(page)).toBe('describe');
  await goto(page, STEP3);
  expect(await mode(page)).not.toBe('describe');
  await expect(page.locator('#modeDescBtn')).not.toHaveClass(/active/);
  // 手動 setMode('describe') 在 ③ 已無按鈕可按；確保 ③ 下模式列沒有任何「描述」的 active 狀態
  await cell(page, 'A', 0).click();
  await expect(cell(page, 'A', 0)).toHaveClass(/pending/);
  await expect(page.locator('#cellPanel')).toBeHidden();
  await cell(page, 'A', 0).click();  // 再點同格取消起點
  await expect(cell(page, 'A', 0)).not.toHaveClass(/pending/);
  expect(errors, errors.join('\n')).toEqual([]);
});

// (c) 來回切換：③ 隱藏 → ④（前提驗證，面板與模式列都在）恢復可見 → ③ 又隱藏，來回兩次
test('(c) 第三步與第四步來回切換兩次：按鈕隱藏／顯示跟著步驟', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors } = await open(page);
  for (let i = 0; i < 2; i++) {
    await goto(page, STEP3);
    await expect(page.locator('#modeDescBtn'), `第 ${i + 1} 次進 ③ 應隱藏`).toBeHidden();
    expect((await rect(page, '#modeDescBtn')).w).toBe(0);
    await goto(page, STEP_WITH_DESC);
    await expect(page.locator('#modeDescBtn'), `第 ${i + 1} 次進 ④ 應顯示`).toBeVisible();
    expect((await rect(page, '#modeDescBtn')).w).toBeGreaterThan(0);
    // ④ 仍可切到描述模式（既有行為不變）
    await page.locator('#modeDescBtn').click();
    expect(await mode(page)).toBe('describe');
  }
  await goto(page, STEP3);
  await expect(page.locator('#modeDescBtn')).toBeHidden();
  expect(await mode(page)).not.toBe('describe');
  expect(errors, errors.join('\n')).toEqual([]);
});

// (d) 第三步畫一條箭頭（點兩格）、六個 tab 切一輪、匯出 PPTX，整個過程 pageerror／console.error 為 []
test('(d) 第三步畫箭頭、六 tab 一輪、匯出 PPTX 無錯誤', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors } = await open(page);
  await goto(page, STEP3);
  expect(await mode(page)).toBe('draw');
  // @ts-ignore 頁面全域
  const before = await page.evaluate(() => arrows[activeIdx].length as number);
  await cell(page, 'A', 0).click();
  await cell(page, 'B', 2).click();
  // @ts-ignore 頁面全域
  await expect.poll(() => page.evaluate(() => arrows[activeIdx].length as number)).toBe(before + 1);
  // @ts-ignore 頁面全域
  const last = await page.evaluate(() => { const a = arrows[activeIdx]; return a[a.length - 1]; });
  expect(last.from).toEqual({ row: 'A', col: 0 });
  expect(last.to).toEqual({ row: 'B', col: 2 });
  // 矩陣上有畫出線（排除 defs 內的箭頭標記）
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('#lineCanvas path, #lineCanvas line')].filter(e => !e.closest('defs')).length)).toBeGreaterThan(0);

  for (const k of ALL_STEPS) {
    await goto(page, k);
    await expect(page.locator(`#pane-${k}`)).toBeVisible();
  }
  await goto(page, STEP3);

  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    // @ts-ignore 頁面全域
    page.evaluate(() => exportPptx()),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.pptx$/);
  expect(readFileSync((await dl.path())!).length).toBeGreaterThan(1000);
  expect(errors, errors.join('\n')).toEqual([]);
  // 整輪結束仍在 ③：描述策略點按鈕不得出現
  await expect(page.locator('#modeDescBtn')).toBeHidden();
});

// (e) 375×667 與 1440×900 在第三步：模式列（.action-bar，ST-46 動到的區塊）不得超出 viewport；
//     1440 下 document 層級不橫向捲動。
//     注意：dev（ef8fe9e）在 375 寬的 ③ 本來就會橫向捲動 50px（scrollWidth 425），來源是箭頭清單的 .arrow-premises／.premise-chip，
//     與本任務無關（另登記 TODO），所以 375 只驗模式列與「不比 dev 更糟」（scrollWidth − clientWidth ≤ 50）。
for (const vp of [{ width: 375, height: 667 }, { width: 1440, height: 900 }]) {
  test(`(e) ${vp.width}×${vp.height} 第三步模式列不超出 viewport、不橫向捲動（document 層級）`, async ({ page }) => {
    await page.setViewportSize(vp);
    const { errors } = await open(page);
    await goto(page, STEP3);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.action-bar')!.getBoundingClientRect();
      const tog = document.querySelector('.action-bar .mode-toggle')!.getBoundingClientRect();
      return {
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
        barRight: bar.right, togRight: tog.right,
      };
    });
    expect(m.barRight, `模式列超出 viewport ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.docClient + 1);
    expect(m.togRight, `模式按鈕群超出 viewport ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.docClient + 1);
    const allowance = vp.width === 375 ? 50 : 0;  // 375：dev 既有的箭頭清單溢出，不在本任務範圍
    expect(m.docScroll, `document 橫向捲動 ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.docClient + allowance);
    expect(errors, errors.join('\n')).toEqual([]);
    await expect(page.locator('#modeDescBtn'), '③ 不得出現描述策略點').toBeHidden();
  });
}

// (f) 第三步模式列視覺基準（基準 PNG 由 worker 在實作完成後產生）
test('(f) 第三步模式列截圖', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await goto(page, STEP3);
  await expect(page.locator('#modeDescBtn')).toBeHidden();
  await expect(page.locator('.action-bar .mode-toggle')).toHaveScreenshot('st46-step3-mode-toggle.png', { maxDiffPixelRatio: 0.01 });
});
