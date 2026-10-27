// ST-45 驗收 spec（測試先行；在 dev ef8fe9e 上預期失敗）
// TODO：「ST-45 價值鏈下方的主要活動（assets/20261027_220149.png）的框線，移到左側，跟支援活動依樣方式（assets/20261027_220235.png）」
//
// 現況（dev）：主要活動的裝飾括號 .vc-primary-label 畫在 chevron 列「下方」（grid-area pbracket：底線＋左右短豎線，文字橫排置中）；
// 支援活動的括號 .vc-support-label 畫在支援活動區「左側」（grid-area supportlabel：左豎線＋上下短橫線，writing-mode vertical-rl 直書）。
// 目標：主要活動括號也改到主要活動列左側、同支援活動的直向框線畫法，兩個括號左緣對齊、兩區內容左緣對齊。
//
// 元素約定（既有 class，tools/selftest/ST-23a、ST-34a 也用這兩個 class 找括號，實作請保留）：
//   括號：.vc-zones > .vc-support-label（支援活動）、.vc-zones > .vc-primary-label（主要活動）
//   內容區：.vc-zone-support（支援活動橫條區）、.vc-activities-row（主要活動 chevron 列，含 .vc-zone-primary）
// 受測頁面預設為本 worktree 的 index.html；設環境變數 SM_INDEX_HTML=<絕對路徑> 可改測別的版本。
import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const indexUrl = process.env.SM_INDEX_HTML
  ? pathToFileURL(process.env.SM_INDEX_HTML)
  : new URL('../../index.html', import.meta.url);

const LAYOUTS = ['porter', 'band', 'fold', 'segment', 'circle', 'hex'];
const SEL = {
  supportLabel: '#valueChainEditor .vc-zones > .vc-support-label',
  primaryLabel: '#valueChainEditor .vc-zones > .vc-primary-label',
  supportContent: '#valueChainEditor .vc-zones .vc-zone-support',
  primaryContent: '#valueChainEditor .vc-zones .vc-activities-row',
};

type Ctx = { page: Page; errors: string[] };

async function open(page: Page, viewport = { width: 1440, height: 900 }): Promise<Ctx> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.setViewportSize(viewport);
  await page.goto(indexUrl.href);
  await page.waitForLoadState('load');
  // @ts-ignore 頁面全域
  await page.evaluate(() => { loadExampleProject('bookstore-a'); guideGoto('chain'); });
  await expect(page.locator('#valueChainEditor .vc-zones')).toBeVisible();
  return { page, errors };
}

async function setLayout(page: Page, key: string) {
  // @ts-ignore 頁面全域
  await page.evaluate(k => { valueChain.layout = k; commitValueChain(); }, key);
  await expect(page.locator('#valueChainEditor .vc-zones')).toBeVisible();
}

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
const box = (page: Page, sel: string): Promise<Box> => page.evaluate(s => {
  const r = document.querySelector(s)!.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
}, sel);

const STYLE_KEYS = ['writing-mode', 'border-left-width', 'border-left-style', 'border-left-color', 'border-top-width', 'border-bottom-width',
  'font-size', 'font-weight', 'color', 'background-color', 'display'] as const;
const styles = (page: Page, sel: string) => page.evaluate(([s, keys]) => {
  const cs = getComputedStyle(document.querySelector(s)!);
  const out: Record<string, string> = {};
  (keys as string[]).forEach(k => { out[k] = cs.getPropertyValue(k); });
  return out;
}, [sel, STYLE_KEYS] as const);

// 檢查「主要活動括號在主要活動列左側、垂直涵蓋整列」與「兩個括號、兩區內容左緣對齊」（(a)(c)，各版型共用）
async function assertLeftBracket(page: Page, tag: string) {
  const pl = await box(page, SEL.primaryLabel);
  const pc = await box(page, SEL.primaryContent);
  const sl = await box(page, SEL.supportLabel);
  const sc = await box(page, SEL.supportContent);
  // (a) 括號在內容區左側，不是在下方
  expect(pl.width, `${tag}: 主要活動括號應有寬度`).toBeGreaterThan(0);
  expect(pl.right, `${tag}: 主要活動括號右緣應 ≤ 主要活動列左緣（括號在左側）`).toBeLessThanOrEqual(pc.left + 2);
  expect(pl.top, `${tag}: 括號上緣應 ≤ 主要活動列上緣`).toBeLessThanOrEqual(pc.top + 2);
  expect(pl.bottom, `${tag}: 括號下緣應 ≥ 主要活動列下緣`).toBeGreaterThanOrEqual(pc.bottom - 2);
  expect(pl.top, `${tag}: 括號不應在主要活動列下方`).toBeLessThan(pc.bottom);
  // (c) 左緣對齊：兩個括號 x 相同、兩區內容 x 相同（±1px）
  expect(Math.abs(pl.left - sl.left), `${tag}: 主要／支援活動括號左緣應對齊`).toBeLessThanOrEqual(1);
  expect(Math.abs(pc.left - sc.left), `${tag}: 主要／支援活動內容區左緣應對齊`).toBeLessThanOrEqual(1);
}

// (a) 「框線移到左側」：1440×900、porter 版型，主要活動括號存在、文字「主要活動」、位於主要活動列左側並垂直涵蓋整列
test('(a) 主要活動括號在主要活動列左側（porter，1440×900）', async ({ page }) => {
  const { errors } = await open(page);
  const label = page.locator(SEL.primaryLabel);
  await expect(label).toHaveCount(1);
  await expect(label).toHaveText('主要活動');
  await expect(page.locator(SEL.supportLabel)).toHaveText('支援活動');
  await assertLeftBracket(page, 'porter');
  expect(errors, errors.join('\n')).toEqual([]);
});

// (b) 「跟支援活動依樣方式」：主要活動括號的 computed style 與支援活動括號一致
//     （writing-mode 直書、左框線寬／色、上下框線寬、字級／字重／顏色、背景、display）
test('(b) 主要活動括號樣式與支援活動括號一致', async ({ page }) => {
  const { errors } = await open(page);
  const ps = await styles(page, SEL.primaryLabel);
  const ss = await styles(page, SEL.supportLabel);
  expect(ss['writing-mode'], '支援活動括號應為直書').toMatch(/^vertical-/);
  expect(ps, '主要活動括號的樣式應與支援活動括號相同').toEqual(ss);
  // 左側框線要畫出來（不是 0 或 none）
  expect(parseFloat(ps['border-left-width'])).toBeGreaterThan(0);
  expect(ps['border-left-style']).not.toBe('none');
  expect(errors, errors.join('\n')).toEqual([]);
});

// (c)(d) 六種版型（VC_LAYOUTS）逐一切換，主要活動括號仍在左側、對齊支援活動括號，且無 console error
for (const key of LAYOUTS) {
  test(`(d) 版型 ${key}：主要活動括號仍在左側且對齊`, async ({ page }) => {
    const { errors } = await open(page);
    await setLayout(page, key);
    await expect(page.locator(SEL.primaryLabel)).toHaveText('主要活動');
    await assertLeftBracket(page, key);
    const ps = await styles(page, SEL.primaryLabel);
    const ss = await styles(page, SEL.supportLabel);
    expect(ps['writing-mode']).toBe(ss['writing-mode']);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (e) 不得 document 層級橫向捲動：
//     1440×900 與 801×900（>800px，括號顯示）直接斷言 scrollWidth <= clientWidth。
//     375×667：dev 上價值鏈編輯器本來就橫向捲動（ST-47，scrollWidth 667 > 375，與本任務無關），
//     所以這裡只斷言 (1) 主要活動括號與支援活動括號在 ≤800px 的顯示狀態一致（兩者同為隱藏，不多佔一欄），
//     (2) 六種版型切換後 document scrollWidth 不比切換前（porter）更大——避免 spec 因 ST-47 既有問題永遠紅。
for (const vp of [{ width: 1440, height: 900 }, { width: 801, height: 900 }]) {
  test(`(e) ${vp.width}×${vp.height}：括號顯示且不橫向捲動`, async ({ page }) => {
    const { errors } = await open(page, vp);
    await expect(page.locator(SEL.primaryLabel)).toBeVisible();
    await expect(page.locator(SEL.supportLabel)).toBeVisible();
    for (const key of LAYOUTS) {
      await setLayout(page, key);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(m.sw, `${key}: scrollWidth ${m.sw} > clientWidth ${m.cw}`).toBeLessThanOrEqual(m.cw);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
test('(e) 375×667：主要活動括號顯示狀態同支援活動括號，且不使橫向捲動變寬（ST-47 既有問題不在此驗）', async ({ page }) => {
  const { errors } = await open(page, { width: 375, height: 667 });
  const base = await page.evaluate(() => document.documentElement.scrollWidth);
  for (const key of LAYOUTS) {
    await setLayout(page, key);
    const ps = await styles(page, SEL.primaryLabel);
    const ss = await styles(page, SEL.supportLabel);
    expect(ps['display'], `${key}: 375px 下主要活動括號 display 應同支援活動括號`).toBe(ss['display']);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw, `${key}: scrollWidth 不應比 porter 時更大`).toBeLessThanOrEqual(base + 1);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

// (f) 視覺基準：1440×900、bookstore-a、porter 版型的價值鏈三區（含兩側括號）。基準 PNG 由 worker 實作完成後以 --update-snapshots 產生。
test('(f) 價值鏈三區截圖（porter，1440×900）', async ({ page }) => {
  const { errors } = await open(page);
  await setLayout(page, 'porter');
  await expect(page.locator('#valueChainEditor .vc-zones')).toHaveScreenshot('ST-45-vc-zones-porter.png', { maxDiffPixelRatio: 0.01 });
  expect(errors, errors.join('\n')).toEqual([]);
});
