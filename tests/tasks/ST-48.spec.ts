// ST-48 驗收 spec（測試先行）
// TODO（# Bug）：「ST-48 ③ 策略構想在 375px 寬會橫向捲動：箭頭清單的前提 chip（.arrow-premises／.premise-chip right 425、
//   .arrow-elems right 386）超出 viewport（ST-46 spec 發現）；②④⑤⑥ 不會；應讓 chip 換行或容器內捲動」
//
// dev b6b285d 在 375×667 進 ③ 的實測（planner 量測腳本，#pane-ideas 內 right > 376 的元素）：
//   bookstore-a（範例與 fixture 相同）：scrollWidth 425 / clientWidth 375，23 個元素溢出——
//     div.arrow-premises right=425 w=381、span.premise-chip right=425 w=345（7 個 chip 中 6 個 right 397～425）、
//     span.premise-dot right=418、div.arrow-elems right=386 w=342、div.arrow-elems-line right=386、
//     span.elem-chip right=386 w=306（「2-3 新的市場區隔對規模經濟之影響 ⓘ」）、span.elem-chip-x right=379
//   foundry-t：scrollWidth 425，20 個元素溢出（同一組 class；premise-chip right 401～425、arrow-elems right=386）
//   醫美範本（bio-aesthetic 價值鏈範本展開後畫一條箭頭、加一個前提與一個要素）：scrollWidth 425，
//     arrow-elems／elem-chip right=386、arrow-premises／premise-chip right=425
//   1440×900 bookstore-a：scrollWidth 1440 = clientWidth，無溢出；同一箭頭的兩個前提 chip 排同一列（right 463、814）。
// 原因：.premise-chip 與 .elem-chip 都是 white-space: nowrap（index.html 1398、1356 行），chip 內文 premiseShortText 截 16 字
//   加〔類型〕與狀態點後寬約 300～345px，再加 .arrow-premises／.arrow-elems 的 padding-left: 36px（1397、1325 行）
//   與 .arrow-item padding，超過 375px 時整個 flex 容器被撐寬（flex-basis: 100% 但 min-content 更大）。
//
// 受測頁面預設為本 worktree 的 index.html；設環境變數 SM_INDEX_HTML=<絕對路徑> 可改測別的版本。
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const indexUrl = process.env.SM_INDEX_HTML
  ? pathToFileURL(process.env.SM_INDEX_HTML)
  : new URL('../../index.html', import.meta.url);

const STEP3 = 'ideas';  // 第三步「策略構想」
const PHONE = { width: 375, height: 667 };
const PHONE_L = { width: 414, height: 896 };
const DESKTOP = { width: 1440, height: 900 };

type Ctx = { page: Page; errors: string[] };

async function openPage(page: Page): Promise<Ctx> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(indexUrl.href);
  await page.waitForLoadState('load');
  return { page, errors };
}

// 三個樣本：bookstore-a 與 foundry-t 用 tests/fixtures 的舊存檔（localStorage strategyMatrix_v4 → reload），
// 醫美範本用 VC_TEMPLATES 的 bio-aesthetic 價值鏈展開到矩陣後，畫一條箭頭並加一個前提、一個要素
// （範本本身沒有箭頭，用此方式讓 ③ 清單出現前提 chip 與要素 chip）。
const SAMPLES: { name: string; load: (page: Page) => Promise<void> }[] = [
  {
    name: 'bookstore-a（fixture）',
    load: page => loadFixture(page, 'bookstore-a'),
  },
  {
    name: 'foundry-t（fixture）',
    load: page => loadFixture(page, 'foundry-t'),
  },
  {
    name: '醫美範本（bio-aesthetic＋一條箭頭）',
    load: async page => {
      // @ts-ignore 頁面全域
      await page.evaluate(() => { loadValueChainTemplate('bio-aesthetic'); applyValueChainColumns(buildValueChainColumns(true)); });
      // @ts-ignore 頁面全域
      await page.evaluate(k => guideGoto(k), STEP3);
      await cell(page, 'A', 0).click();
      await cell(page, 'B', 2).click();
      // @ts-ignore 頁面全域
      await expect.poll(() => page.evaluate(() => arrows[activeIdx].length as number)).toBe(1);
      await page.evaluate(() => {
        // @ts-ignore 頁面全域
        const a = arrows[activeIdx][0];
        // @ts-ignore 頁面全域
        a.premises.push({ id: newPremiseId(), type: 'env', text: '醫美市場需求持續成長且競爭者短期不會大量進入', status: 'unsure' });
        a.elements.push('2-3');
        // @ts-ignore 頁面全域
        normaliseArrowPremises(); renderArrowList(); saveState();
      });
    },
  },
];

async function loadFixture(page: Page, id: string) {
  const raw = readFileSync(new URL(`../fixtures/strategyMatrix_v4-${id}.json`, import.meta.url), 'utf8');
  await page.evaluate(s => localStorage.setItem('strategyMatrix_v4', s), JSON.stringify(JSON.parse(raw)));
  await page.reload();
  await page.waitForLoadState('load');
}

// @ts-ignore 頁面全域
const goto = (page: Page, k: string) => page.evaluate(k => guideGoto(k), k);
const cell = (page: Page, row: string, col: number) => page.locator(`#matrixTable td[data-row="${row}"][data-col="${col}"]`);

async function enterStep3(page: Page, load: (p: Page) => Promise<void>) {
  await load(page);
  await goto(page, STEP3);
  await expect(page.locator('#pane-ideas')).toBeVisible();
  await expect(page.locator('#pane-ideas .premise-chip').first()).toBeVisible();
}

const docScroll = (page: Page) => page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));

// #pane-ideas 內所有後代的 right；位於 overflow-x: auto/scroll 的祖先容器（#pane-ideas 之內）裡的元素不計
// （「容器內捲動」是 TODO 允許的做法），但該容器本身仍要在 viewport 內。
const overflowing = (page: Page) => page.evaluate(() => {
  const pane = document.getElementById('pane-ideas')!;
  const cw = document.documentElement.clientWidth;
  const insideScroller = (el: Element) => {
    for (let p = el.parentElement; p && p !== pane; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  const out: string[] = [];
  for (const el of pane.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > cw + 1 && !insideScroller(el)) {
      out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} right=${Math.round(r.right)} text=${(el.textContent || '').trim().slice(0, 16)}`);
    }
  }
  return { clientWidth: cw, items: out };
});

// (a) 「③ 策略構想在 375px 寬會橫向捲動 … 應讓 chip 換行或容器內捲動」：
//     375×667 三個樣本進 ③ 後 document.documentElement.scrollWidth ≤ clientWidth（核心驗收）
for (const s of SAMPLES) {
  test(`(a) 375×667 ③ 不橫向捲動（document 層級）— ${s.name}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { errors } = await openPage(page);
    await enterStep3(page, s.load);
    const m = await docScroll(page);
    expect(m.scrollWidth, `③ 橫向捲動 ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.clientWidth);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (b) 「前提 chip（.arrow-premises／.premise-chip right 425、.arrow-elems right 386）超出 viewport」：
//     375 下 #pane-ideas 所有後代 right ≤ clientWidth + 1（overflow-x auto/scroll 容器內部不計）
for (const s of SAMPLES) {
  test(`(b) 375×667 ③ #pane-ideas 後代都在 viewport 內 — ${s.name}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { errors } = await openPage(page);
    await enterStep3(page, s.load);
    const o = await overflowing(page);
    expect(o.items, `超出 viewport 的元素：\n${o.items.join('\n')}`).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (c) 「應讓 chip 換行或容器內捲動」：修好後每個 .premise-chip 與 .elem-chip 仍看得到（寬高 > 0、水平在 viewport 內：
//     left ≥ −1、right ≤ clientWidth + 1），且文字沒被裁掉（chip 本身 scrollWidth ≤ clientWidth + 1；
//     overflow-x auto/scroll 容器內的 chip 另以容器為準，容器本身也不得超出）
for (const s of SAMPLES) {
  test(`(c) 375×667 ③ 每個前提／要素 chip 仍可見且文字未被裁切 — ${s.name}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { errors } = await openPage(page);
    await enterStep3(page, s.load);
    const chips = await page.evaluate(() => {
      const pane = document.getElementById('pane-ideas')!;
      const cw = document.documentElement.clientWidth;
      return [...pane.querySelectorAll('.premise-chip, .elem-chip')].map(el => {
        const r = el.getBoundingClientRect();
        let scroller: Element | null = null;
        for (let p = el.parentElement; p && p !== pane; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll') { scroller = p; break; }
        }
        const box = scroller ? scroller.getBoundingClientRect() : r;
        return {
          cls: el.className, text: (el.textContent || '').trim().slice(0, 16),
          w: r.width, h: r.height, left: r.left, right: r.right,
          boxLeft: box.left, boxRight: box.right,
          clipped: el.scrollWidth > el.clientWidth + 1,
          clientWidth: cw,
        };
      });
    });
    expect(chips.length, '③ 應有前提／要素 chip').toBeGreaterThan(0);
    for (const c of chips) {
      const tag = `${c.cls}「${c.text}」`;
      expect(c.w, `${tag} 寬度`).toBeGreaterThan(0);
      expect(c.h, `${tag} 高度`).toBeGreaterThan(0);
      expect(c.boxLeft, `${tag} 左緣`).toBeGreaterThanOrEqual(-1);
      expect(c.boxRight, `${tag} 右緣 ${Math.round(c.boxRight)} > viewport ${c.clientWidth}`).toBeLessThanOrEqual(c.clientWidth + 1);
      expect(c.clipped, `${tag} 文字被裁切（scrollWidth > clientWidth）`).toBe(false);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

// (d) 414×896（較寬手機）同 (a)：bookstore-a 進 ③ 不橫向捲動
test('(d) 414×896 ③ 不橫向捲動 — bookstore-a', async ({ page }) => {
  await page.setViewportSize(PHONE_L);
  const { errors } = await openPage(page);
  await enterStep3(page, SAMPLES[0].load);
  const m = await docScroll(page);
  expect(m.scrollWidth, `③ 橫向捲動 ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.clientWidth);
  expect(errors, errors.join('\n')).toEqual([]);
});

// (e) 1440×900 版面不變（回歸）：③ 不橫向捲動；同一箭頭有 ≥ 2 個前提 chip 時排在同一列（top 相同 ±1，寬裕時不應硬換行）
test('(e) 1440×900 ③ 不橫向捲動、同一箭頭的前提 chip 排同一列 — bookstore-a', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const { errors } = await openPage(page);
  await enterStep3(page, SAMPLES[0].load);
  const m = await docScroll(page);
  expect(m.scrollWidth, `③ 橫向捲動 ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.clientWidth);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('#pane-ideas .arrow-premises')]
      .map(w => [...w.querySelectorAll('.premise-chip')].map(c => Math.round(c.getBoundingClientRect().top)))
      .filter(t => t.length >= 2));
  expect(rows.length, '應有至少一個箭頭帶 ≥ 2 個前提 chip').toBeGreaterThan(0);
  for (const tops of rows) {
    for (const t of tops) expect(Math.abs(t - tops[0]), `前提 chip 應排同一列 tops=${JSON.stringify(tops)}`).toBeLessThanOrEqual(1);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

// (f) 375 下互動不壞：在 ③ 畫一條箭頭（點兩格）、點第一個前提 chip 打開 inline 編輯（.premise-edit 出現），
//     全程 pageerror／console.error 為 []；開著編輯框時 document 仍不橫向捲動
test('(f) 375×667 ③ 畫箭頭、點前提 chip 開編輯：無 console error、仍不橫向捲動', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { errors } = await openPage(page);
  await enterStep3(page, SAMPLES[0].load);
  // @ts-ignore 頁面全域
  const before = await page.evaluate(() => arrows[activeIdx].length as number);
  await cell(page, 'A', 0).click();
  await cell(page, 'B', 2).click();
  // @ts-ignore 頁面全域
  await expect.poll(() => page.evaluate(() => arrows[activeIdx].length as number)).toBe(before + 1);
  await page.locator('#pane-ideas .premise-chip').first().click();
  await expect(page.locator('#pane-ideas .premise-edit')).toHaveCount(1);
  await expect(page.locator('#pane-ideas .premise-edit input[type=text]')).toBeVisible();
  const m = await docScroll(page);
  expect(m.scrollWidth, `開編輯框後 ③ 橫向捲動 ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.clientWidth);
  expect(errors, errors.join('\n')).toEqual([]);
});

// (g) 375 下 ③ 視覺基準（基準 PNG 由 worker 在實作完成後產生）
test('(g) 375×667 ③ #pane-ideas 截圖 — bookstore-a', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await openPage(page);
  await enterStep3(page, SAMPLES[0].load);
  await expect(page.locator('#pane-ideas')).toHaveScreenshot('st48-375-pane-ideas.png', { maxDiffPixelRatio: 0.01 });
});
