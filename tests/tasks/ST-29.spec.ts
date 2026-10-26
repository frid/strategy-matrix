// ST-29 驗收 spec（測試先行；planner 寫、worker 不得改）
// TODO 條目：「價值鏈編輯器：主要活動欄太多折成第二列時，跨列連線（如醫美範本「中醫門診→中醫調理」，1400px 寬）
//   vcCrossRoute 找不到通道退回斜直線；需在折列情況補「列間水平通道」規則」
// 量測方式：#vcLineCanvas 裡每條 path.vc-link-main 的 d 屬性（drawVcLinks 由 vcRoundedPath 產生，只含 M／L／Q；
//   Q 的控制點就是折點），座標系＝#valueChainEditor 的 offset 座標，與 getVcNodeRect(id) 相同。
// ST_INDEX_HTML 環境變數可指定另一份 index.html（用來對照乾淨的 dev 基準），預設用本 repo 的 index.html。
import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

// index.html 的頂層 let／function（不是 window 屬性），只在 page.evaluate 裡用
declare const valueChain: any;
declare function loadValueChainTemplate(id: string): void;
declare function guideGoto(k: string): void;
declare function getVcNodeRect(id: string): Rect | null;

const indexUrl = process.env.ST_INDEX_HTML
  ? pathToFileURL(process.env.ST_INDEX_HTML).href
  : new URL('../../index.html', import.meta.url).href;

const TEMPLATE = 'bio-aesthetic';   // VC_TEMPLATES 裡的「連鎖醫美診所」（含 中醫門診→中醫調理）
const PRIMARY_TOP = '#valueChainEditor .vc-zone-primary > .vc-zone-body > [data-vc-id]';
const LINK_PATH = '#vcLineCanvas path.vc-link-main';

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type LinkInfo = { from: string; to: string; d: string; r1: Rect; r2: Rect; allow: Rect[] };

function setup(page: Page, errors: string[]) {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('dialog', d => d.accept());
}

// 載入醫美範本、切到 ①（價值鏈），等連線畫完（path 數＝valueChain.links 數）
async function openChain(page: Page) {
  await page.goto(indexUrl);
  await page.waitForLoadState('load');
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluate(id => { loadValueChainTemplate(id); guideGoto('chain'); }, TEMPLATE);
  const n = await page.evaluate(() => valueChain.links.length);
  expect(n, '範本連線數').toBeGreaterThanOrEqual(2);
  await expect(page.locator(LINK_PATH)).toHaveCount(n);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// 把 d 攤平成依序的點：M、L 的點，Q 的控制點（＝折點）與終點
function flatten(d: string): Pt[] {
  const pts: Pt[] = [];
  const re = /([MLQ])\s*([^MLQ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = m[2].trim().split(/[\s,]+/).map(Number);
    expect(nums.every(Number.isFinite), `d 含非數值：${d}`).toBe(true);
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  }
  expect(d.replace(/[MLQ\d\s.,e-]/g, ''), `d 只能含 M／L／Q：${d}`).toBe('');
  expect(pts.length, `d 至少兩點：${d}`).toBeGreaterThanOrEqual(2);
  return pts;
}

// 線段是否穿過矩形內部（內縮 1px，貼邊不算）；Liang–Barsky
function segHitsRect(a: Pt, b: Pt, r: Rect, inset = 1): boolean {
  const x0 = r.x + inset, y0 = r.y + inset, x1 = r.x + r.w - inset, y1 = r.y + r.h - inset;
  if (x1 <= x0 || y1 <= y0) return false;
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  if (!clip(-dx, a.x - x0) || !clip(dx, x1 - a.x) || !clip(-dy, a.y - y0) || !clip(dy, y1 - a.y)) return false;
  return t1 - t0 > 1e-9;
}

function onEdge(p: Pt, r: Rect, tol = 2): boolean {
  const inX = p.x >= r.x - tol && p.x <= r.x + r.w + tol;
  const inY = p.y >= r.y - tol && p.y <= r.y + r.h + tol;
  const onV = Math.abs(p.x - r.x) <= tol || Math.abs(p.x - (r.x + r.w)) <= tol;
  const onH = Math.abs(p.y - r.y) <= tol || Math.abs(p.y - (r.y + r.h)) <= tol;
  return (onV && inY) || (onH && inX);
}

// 每條連線：d、兩端矩形、允許穿過的矩形（兩端＋包住兩端的祖先群組）；其餘 [data-vc-id] 方塊都算障礙
async function collectLinks(page: Page): Promise<{ links: LinkInfo[]; obstacles: Rect[] }> {
  return page.evaluate(() => {
    const editor = document.getElementById('valueChainEditor')!;
    const all: Rect[] = Array.from(editor.querySelectorAll('[data-vc-id]')).map(el => getVcNodeRect(el.getAttribute('data-vc-id')!)!);
    const contains = (o: Rect, r: Rect) => o.x <= r.x && o.y <= r.y && o.x + o.w >= r.x + r.w && o.y + o.h >= r.y + r.h;
    const ds = Array.from(document.querySelectorAll('#vcLineCanvas path.vc-link-main')).map(p => p.getAttribute('d') || '');
    const links: LinkInfo[] = valueChain.links.map((l: any, i: number) => {
      const r1 = getVcNodeRect(l.from)!, r2 = getVcNodeRect(l.to)!;
      return { from: l.from, to: l.to, d: ds[i], r1, r2, allow: all.filter(o => contains(o, r1) || contains(o, r2)) };
    });
    return { links, obstacles: all };
  });
}

async function primaryRowTops(page: Page): Promise<number[]> {
  return page.evaluate(sel => {
    const tops = Array.from(document.querySelectorAll(sel)).map(el => Math.round(el.getBoundingClientRect().top));
    return Array.from(new Set(tops)).sort((a, b) => a - b);
  }, PRIMARY_TOP);
}

test.describe('ST-29 價值鏈折列時的跨列連線', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => { errors = []; setup(page, errors); });

  // 驗收條件（核心）：1400px 寬、主要活動折成兩列時，每條連線都是正交折線（不得退回斜直線），
  // 端點停在起訖方塊邊緣，路徑不穿過其他方塊。對應 TODO「需在折列情況補列間水平通道規則」。
  test('1400 寬醫美範本：折成兩列、連線全部正交、端點在方塊邊、不穿過其他方塊', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await openChain(page);
    const rows = await primaryRowTops(page);
    expect(rows.length, `主要活動頂層方塊應折成 ≥2 列（各列 top：${rows.join(',')}）`).toBeGreaterThanOrEqual(2);

    const { links, obstacles } = await collectLinks(page);
    expect(links.length).toBeGreaterThanOrEqual(2);
    const diagonal: string[] = [], badEnd: string[] = [], crossing: string[] = [];
    for (const l of links) {
      const pts = flatten(l.d);
      const tag = `${l.from}→${l.to}`;
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i].x - pts[i - 1].x), dy = Math.abs(pts[i].y - pts[i - 1].y);
        if (dx > 1 && dy > 1) diagonal.push(`${tag} 第${i}段 (${pts[i - 1].x.toFixed(1)},${pts[i - 1].y.toFixed(1)})→(${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)})`);
      }
      if (!onEdge(pts[0], l.r1)) badEnd.push(`${tag} 起點 ${JSON.stringify(pts[0])} 不在 ${JSON.stringify(l.r1)} 邊上`);
      if (!onEdge(pts[pts.length - 1], l.r2)) badEnd.push(`${tag} 終點 ${JSON.stringify(pts[pts.length - 1])} 不在 ${JSON.stringify(l.r2)} 邊上`);
      const blockers = obstacles.filter(o => !l.allow.some(a => a.x === o.x && a.y === o.y && a.w === o.w && a.h === o.h));
      for (let i = 1; i < pts.length; i++) {
        for (const o of blockers) if (segHitsRect(pts[i - 1], pts[i], o)) crossing.push(`${tag} 第${i}段穿過 ${JSON.stringify(o)}`);
      }
    }
    expect(diagonal, '不得有斜線段（每段 dx==0 或 dy==0，容差 1px）：\n' + diagonal.join('\n')).toEqual([]);
    expect(badEnd, '端點須在起訖方塊邊緣（容差 2px）：\n' + badEnd.join('\n')).toEqual([]);
    expect(crossing, '路徑不得穿過其他方塊內部：\n' + crossing.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // 驗收條件（回歸）：375×667 與 1440×900 的 ① tab 不得橫向捲動
  for (const vp of [{ width: 375, height: 667 }, { width: 1440, height: 900 }]) {
    test(`${vp.width}×${vp.height} 價值鏈 tab 不橫向捲動`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openChain(page);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw[0], `scrollWidth ${sw[0]} > clientWidth ${sw[1]}`).toBeLessThanOrEqual(sw[1]);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  // 驗收條件（回歸）：切換 tab 來回、拖曳一個主要活動單元換位後，無 pageerror／console.error，連線數不變、仍全部正交
  test('切 tab 與拖曳價值單元後無錯誤、連線重畫仍正交', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await openChain(page);
    const n = await page.locator(LINK_PATH).count();
    for (const k of ['ideas', 'chain', 'cells', 'chain']) {
      await page.evaluate(key => guideGoto(key), k);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    await expect(page.locator(LINK_PATH)).toHaveCount(n);
    const units = page.locator('#valueChainEditor .vc-zone-primary > .vc-zone-body > .vc-unit');
    expect(await units.count()).toBeGreaterThanOrEqual(2);
    const firstId = await units.nth(0).getAttribute('data-vc-id');
    await units.nth(1).dragTo(units.nth(0));
    await expect.poll(async () => (await page.locator(PRIMARY_TOP).first().getAttribute('data-vc-id')) !== firstId, { message: '拖曳後第 2 個單元應插到第 1 個前面' }).toBe(true);
    await expect(page.locator(LINK_PATH)).toHaveCount(n);
    const { links } = await collectLinks(page);
    const diagonal = links.flatMap(l => { const p = flatten(l.d); return p.slice(1).filter((q, i) => Math.abs(q.x - p[i].x) > 1 && Math.abs(q.y - p[i].y) > 1).map(() => `${l.from}→${l.to}`); });
    expect(diagonal, '拖曳後重畫仍不得有斜線：' + diagonal.join(',')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // 視覺基準：1400 寬醫美範本的價值鏈區域（基準 PNG 由 worker 實作完成後以 --update-snapshots 產生）
  test('1400 寬醫美範本價值鏈區域截圖', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await openChain(page);
    await expect(page.locator('#valueChainEditor')).toHaveScreenshot('st29-aesthetic-1400.png', { maxDiffPixelRatio: 0.01 });
  });
});
