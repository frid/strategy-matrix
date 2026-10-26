// ST-34c 驗收 spec（測試先行）
// TODO：「需舊檔遷移：ADV_BASES 改書上名稱與順序並加舊值對照（#31）；SUPPORT_COLUMN_GROUP「支援活動」建議不改常數只加註（#13）」
// 書上七項（策略要素 6-2～6-8，[S 331–339]；見 doc/reference/策略管理新論-Ch8-51項策略要素.md）：
//   獨特能力、獨佔力、時機、綜效、財力、關係、資訊科技之運用
// 舊值（dev 上的 ADV_BASES）：能力、獨佔、時機、財力、綜效、關係、資訊科技
//
// 受測頁面預設為本 worktree 的 index.html；設環境變數 SM_INDEX_HTML=<絕對路徑> 可改測別的版本（例如乾淨的 dev 基準）。
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const indexUrl = process.env.SM_INDEX_HTML
  ? pathToFileURL(process.env.SM_INDEX_HTML)
  : new URL('../../index.html', import.meta.url);
const fixturePath = (id: string) => fileURLToPath(new URL(`../fixtures/strategyMatrix_v4-${id}.json`, import.meta.url));
const readFixture = (id: string) => JSON.parse(readFileSync(fixturePath(id), 'utf8'));

const BOOK_BASES = ['獨特能力', '獨佔力', '時機', '綜效', '財力', '關係', '資訊科技之運用'];
const OLD_TO_NEW: Record<string, string> = { 能力: '獨特能力', 獨佔: '獨佔力', 資訊科技: '資訊科技之運用' };
// 兩份 fixture 的 F 列格子（舊名）→ 載入後應得的新名（依書上順序）
const FIXTURE_F: Record<string, { key: string; expect: string[] }> = {
  'bookstore-a': { key: '資訊系統|F', expect: ['獨特能力', '資訊科技之運用'] },
  'foundry-t':   { key: '製程研發|F', expect: ['獨特能力', '時機'] },
};

type Ctx = { page: Page; errors: string[] };

async function open(page: Page): Promise<Ctx> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(indexUrl.href);
  await page.waitForLoadState('load');
  return { page, errors };
}

// 把一份 strategyMatrix_v4 存檔寫進 localStorage 再 reload（模擬舊存檔載入）
async function loadSaved(page: Page, state: unknown) {
  await page.evaluate(s => localStorage.setItem('strategyMatrix_v4', s), JSON.stringify(state));
  await page.reload();
  await page.waitForLoadState('load');
}

// 讀目前頁面的 cellNotes（只取 F 列）
const readFBases = (page: Page) => page.evaluate(() => {
  const out: Record<string, string[]> = {};
  // @ts-ignore 頁面全域
  Object.entries(cellNotes as Record<string, { bases: string[] }>).forEach(([k, n]) => { if (k.endsWith('|F')) out[k] = n.bases; });
  return out;
});

// 切到「策略點描述」tab 並點某欄的 F 列格子，回傳面板的選項文字
async function openFCell(page: Page, colName: string) {
  // @ts-ignore 頁面全域
  await page.evaluate(() => guideGoto('cells'));
  // @ts-ignore 頁面全域
  const ci = await page.evaluate(n => COLUMNS.indexOf(n), colName);
  expect(ci, `找不到欄「${colName}」`).toBeGreaterThanOrEqual(0);
  await page.locator(`#matrixTable td[data-row="F"][data-col="${ci}"]`).click();
  await expect(page.locator('#cellPanel .cell-base-chip')).toHaveCount(BOOK_BASES.length);
}

// (a) 「ADV_BASES 改書上名稱與順序」：F 列格子面板的核取方塊文字與順序 = 書上七項（讀 DOM）
test('(a) F 列優勢基礎選項：名稱與順序照書上 6-2～6-8', async ({ page }) => {
  const { errors } = await open(page);
  // @ts-ignore
  await page.evaluate(() => loadExampleProject('bookstore-a'));
  await openFCell(page, '資訊系統');
  const labels = await page.locator('#cellPanel .cell-base-chip').allTextContents();
  expect(labels.map(s => s.trim())).toEqual(BOOK_BASES);
  // 範例資料本身也要用新名（勾選狀態跟著新名走）
  const checked = await page.locator('#cellPanel .cell-base-chip:has(input:checked)').allTextContents();
  expect(checked.map(s => s.trim())).toEqual(['獨特能力', '資訊科技之運用']);
  expect(errors, errors.join('\n')).toEqual([]);
});

// (b) 「需舊檔遷移…加舊值對照」：兩份舊存檔 fixture 載入後 bases 全部轉成新名、順序依書、無 console error
for (const id of Object.keys(FIXTURE_F)) {
  test(`(b) 舊存檔 fixture ${id} 載入後優勢基礎轉為書上名稱`, async ({ page }) => {
    const { errors } = await open(page);
    await loadSaved(page, readFixture(id));
    const f = await readFBases(page);
    const { key, expect: want } = FIXTURE_F[id];
    expect(f[key], `${key} 的 bases`).toEqual(want);
    for (const [k, bases] of Object.entries(f)) {
      for (const b of bases) expect(BOOK_BASES, `${k} 含非書上名稱「${b}」`).toContain(b);
      const idx = bases.map(b => BOOK_BASES.indexOf(b));
      expect(idx, `${k} 順序不依書`).toEqual([...idx].sort((x, y) => x - y));
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (c) 「加舊值對照」：含舊名（能力／獨佔／資訊科技）與未知名稱的存檔 → 舊名轉新名、未知名稱濾掉、重複合併
test('(c) 舊名＋未知名稱的存檔：舊名轉新名、未知名稱濾掉', async ({ page }) => {
  const { errors } = await open(page);
  const state = readFixture('bookstore-a');
  state.cellNotes['資訊系統|F'].bases = ['資訊科技', '不存在的基礎', '獨佔', '能力', '財力', '獨特能力'];
  state.cellNotes['採購|F'] = { text: '', vi: '', bases: ['關係', '什麼都不是'] };
  await loadSaved(page, state);
  const f = await readFBases(page);
  expect(f['資訊系統|F']).toEqual(['獨特能力', '獨佔力', '財力', '資訊科技之運用']);
  expect(f['採購|F']).toEqual(['關係']);
  for (const [oldName, newName] of Object.entries(OLD_TO_NEW)) {
    expect(Object.values(f).flat(), `舊名「${oldName}」未轉成「${newName}」`).not.toContain(oldName);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

// (d) 遷移後資料可往返：匯出 JSON → 匯入 JSON，bases 不變、無 console error
test('(d) 匯出 JSON 再匯入後優勢基礎不變', async ({ page }) => {
  const { errors } = await open(page);
  await loadSaved(page, readFixture('foundry-t'));
  const before = await readFBases(page);
  expect(before['製程研發|F']).toEqual(FIXTURE_F['foundry-t'].expect);

  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    // @ts-ignore
    page.evaluate(() => exportStateJSON()),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.json$/);
  const exported = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  expect(exported.cellNotes['製程研發|F'].bases).toEqual(FIXTURE_F['foundry-t'].expect);

  // 清掉 localStorage 再透過頁面的匯入流程把剛匯出的檔讀回來
  await page.evaluate(() => localStorage.removeItem('strategyMatrix_v4'));
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    // @ts-ignore
    page.evaluate(() => importStateJSON()),
  ]);
  await Promise.all([
    page.waitForEvent('load'),  // importStateJSON 寫入 localStorage 後 location.reload()
    chooser.setFiles({ name: 'export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) }),
  ]);
  await expect.poll(async () => (await readFBases(page))['製程研發|F']).toEqual(FIXTURE_F['foundry-t'].expect);
  expect(await readFBases(page)).toEqual(before);
  expect(errors, errors.join('\n')).toEqual([]);
});

// (e) 遷移後匯出 PPTX 不拋例外（PPTX 的 F 列文字來自 bases）
test('(e) 舊存檔載入後匯出 PPTX 不拋例外', async ({ page }) => {
  const { errors } = await open(page);
  await loadSaved(page, readFixture('bookstore-a'));
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    // @ts-ignore
    page.evaluate(() => exportPptx()),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.pptx$/);
  const path = await dl.path();
  expect(readFileSync(path).length).toBeGreaterThan(1000);
  expect(errors, errors.join('\n')).toEqual([]);
});

// (f) 「SUPPORT_COLUMN_GROUP 建議不改常數」：常數仍為「支援活動」；fixtures 的 COLUMN_PATHS 載入後欄數與支援欄數不變
for (const id of Object.keys(FIXTURE_F)) {
  test(`(f) 支援活動常數不變、fixture ${id} 欄數不變`, async ({ page }) => {
    const { errors } = await open(page);
    const fx = readFixture(id);
    await loadSaved(page, fx);
    const got = await page.evaluate(() => ({
      // @ts-ignore
      group: SUPPORT_COLUMN_GROUP as string,
      // @ts-ignore
      cols: COLUMNS.length as number,
      // @ts-ignore
      paths: getColumnPaths() as string[][],
    }));
    expect(got.group).toBe('支援活動');
    expect(got.cols).toBe(fx.COLUMN_PATHS.length);
    expect(got.paths).toEqual(fx.COLUMN_PATHS);
    expect(got.paths.filter(p => p[0] === '支援活動').length).toBe(fx.COLUMN_PATHS.filter((p: string[]) => p[0] === '支援活動').length);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (g) 兩種 viewport 下矩陣 tab 的 document 不得橫向捲動（矩陣本身設計為 .matrix-wrapper 容器內捲動，見 index.html CSS「矩陣主容器」）
for (const vp of [{ width: 375, height: 667 }, { width: 1440, height: 900 }]) {
  test(`(g) ${vp.width}×${vp.height} 矩陣 tab 不橫向捲動（document 層級）`, async ({ page }) => {
    await page.setViewportSize(vp);
    const { errors } = await open(page);
    await loadSaved(page, readFixture('bookstore-a'));
    await openFCell(page, '資訊系統');
    const m = await page.evaluate(() => ({
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
    }));
    expect(m.docScroll, `document 橫向捲動 ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.docClient);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (h) F 列格子彈出面板視覺基準（基準 PNG 由 worker 在實作完成後產生）
test('(h) F 列格子面板截圖', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await loadSaved(page, readFixture('bookstore-a'));
  await openFCell(page, '資訊系統');
  await expect(page.locator('#cellPanel')).toHaveScreenshot('ST-34c-f-cell-panel.png', { maxDiffPixelRatio: 0.01 });
});
