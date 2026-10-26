// ST-35a 驗收 spec（測試先行；在未實作的 dev 上預期失敗）
//
// TODO 條目：ST-35a 橫帶式（B）：葉節點等寬一排 chevron（CSS clip-path），群組名掛上方橫帶跨其子單元，巢狀疊帶；
//           與矩陣「群組表頭＋細項表頭」一對一；改名、拖曳、群組化、活動／資產切換、連線端點全部保留；≤800px 回現行直排
// ST-35 已定：預設 B；版型下拉與存檔欄位 vcLayout 留到 ST-35f。
//
// 啟用方式（planner 決定）：ST-35a 完成後，螢幕寬 >800px 時價值鏈編輯器（① tab）的主要活動區「直接」以 B 版型畫，
//   不需要任何開關（TODO 已定「預設 B」，而且下拉／存檔欄位是 ST-35f 的事）。本 spec 不設定任何 window／body 開關。
//   ≤800px（media max-width:800px）主要活動葉節點改為直排（一欄）。
//
// 對 worker 的 DOM 約定（spec 只靠這些既有 selector，不量函式名）：
//   - 葉節點：#valueChainEditor .vc-zone-primary .vc-unit（頂層與群組內的都算，DOM 順序＝資料順序＝矩陣欄順序）
//   - 群組：#valueChainEditor .vc-zone-primary .vc-group；群組的「橫帶」＝該群組的直接子元素 .vc-node-head（既有改名列）
//   - 葉節點名稱／群組名稱：節點內 .vc-node-head > textarea.vc-name-wrap 的 value
//   - 連線：#vcLineCanvas path.vc-link-main 的 d 屬性，依 valueChain.links 順序一條一個
//   - 活動／資產切換：葉節點的 .vc-kind（點一下切換，切成資產時節點加 .vc-asset、文字「資產」）
//   - 新增群組：主要活動區 footer 的「＋ 群組」（span.col-item-add）；把葉節點拖進群組的 .vc-group-body 即放入群組
import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

// index.html 的頂層 let／function（page.evaluate 內以裸識別字存取；它們不是 window 屬性）
declare let valueChain: any;
declare function loadExampleProject(id: string): void;
declare function normaliseValueChain(raw: any): any;
declare function resetValueChainIds(vc: any): void;
declare function commitValueChain(): void;
declare function guideGoto(k: string): void;
declare function expandValueChainToMatrix(supportFirst: boolean): any;

// 預設測本 worktree 的 index.html；設 SM_INDEX=<路徑> 可指到別份（例如乾淨 dev 基準）以證明 spec 在未實作時失敗
const indexUrl = process.env.SM_INDEX ? pathToFileURL(process.env.SM_INDEX) : new URL('../../index.html', import.meta.url);

// 測試用價值鏈：頂層單元＋兩層巢狀群組＋資產＋連線（主要活動內 2 條、到產品 1 條）
const FIXTURE_VC = {
  v: 1, showArrowBg: true,
  primary: [
    { id: 'u_rd', name: '研發', type: 'unit', unitKind: 'activity' },
    { id: 'g_mfg', name: '製造', type: 'group', children: [
      { id: 'u_buy', name: '採購', type: 'unit', unitKind: 'asset' },
      { id: 'u_prod', name: '生產', type: 'unit', unitKind: 'activity' },
    ] },
    { id: 'g_mkt', name: '市場', type: 'group', children: [
      { id: 'g_sales', name: '銷售', type: 'group', children: [
        { id: 'u_store', name: '門市', type: 'unit', unitKind: 'activity' },
        { id: 'u_web', name: '網路', type: 'unit', unitKind: 'activity' },
      ] },
      { id: 'u_cs', name: '客服', type: 'unit', unitKind: 'activity' },
    ] },
    { id: 'u_brand', name: '品牌', type: 'unit', unitKind: 'asset' },
  ],
  support: [
    { id: 's_hr', name: '人力資源', type: 'unit', unitKind: 'activity' },
    { id: 's_it', name: '資訊系統', type: 'unit', unitKind: 'asset' },
  ],
  products: [
    { id: 'p_1', name: '產品一', type: 'unit', unitKind: 'activity' },
    { id: 'p_2', name: '產品二', type: 'unit', unitKind: 'activity' },
  ],
  links: [
    { id: 'l_1', from: 'u_rd', to: 'u_prod' },
    { id: 'l_2', from: 'u_store', to: 'u_cs' },
    { id: 'l_3', from: 'u_cs', to: 'p_1' },
  ],
};
const FIXTURE_LEAVES = ['研發', '採購', '生產', '門市', '網路', '客服', '品牌'];

const PRIMARY = '#valueChainEditor .vc-zone-primary';
const LEAF = `${PRIMARY} .vc-unit`;
const GROUP = `${PRIMARY} .vc-group`;

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type LeafInfo = Box & { id: string; name: string; clipPath: string; asset: boolean };
type GroupInfo = { id: string; name: string; depth: number; band: Box; leaves: Box[]; innerBands: Box[] };

// 讀主要活動區所有葉節點的幾何（相對 viewport）、名稱、clip-path
async function readLeaves(page: Page): Promise<LeafInfo[]> {
  return page.$$eval(LEAF, els => els.map(el => {
    const r = el.getBoundingClientRect();
    const ta = el.querySelector(':scope > .vc-node-head > textarea, :scope > .vc-node-head > input') as HTMLInputElement | null;
    return {
      id: el.getAttribute('data-vc-id') || '', name: ta ? ta.value : '',
      clipPath: getComputedStyle(el).clipPath, asset: el.classList.contains('vc-asset'),
      left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
    };
  }));
}

// 讀每個群組：橫帶（直接子元素 .vc-node-head）、其下所有葉節點、其下巢狀群組的橫帶
async function readGroups(page: Page): Promise<GroupInfo[]> {
  return page.$$eval(GROUP, els => els.map(el => {
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const band = el.querySelector(':scope > .vc-node-head')!;
    const ta = band.querySelector('textarea, input') as HTMLInputElement | null;
    let depth = 0; let p = el.parentElement;
    while (p && !p.classList.contains('vc-zone-body')) { if (p.classList.contains('vc-group')) depth++; p = p.parentElement; }
    return {
      id: el.getAttribute('data-vc-id') || '', name: ta ? ta.value : '', depth,
      band: box(band),
      leaves: Array.from(el.querySelectorAll('.vc-unit')).map(box),
      innerBands: Array.from(el.querySelectorAll('.vc-group > .vc-node-head')).map(box),
    };
  }));
}

// 橫排一列：等寬（±1px）、同 top（±1px）、左到右依序不重疊
function expectSingleRowEqualWidth(leaves: LeafInfo[], label: string) {
  expect(leaves.length, `${label}：葉節點數`).toBeGreaterThan(1);
  const w0 = leaves[0].width, t0 = leaves[0].top;
  for (const l of leaves) {
    expect(Math.abs(l.width - w0), `${label}：「${l.name}」寬 ${l.width} 應等於「${leaves[0].name}」寬 ${w0}（±1px）`).toBeLessThanOrEqual(1);
    expect(Math.abs(l.top - t0), `${label}：「${l.name}」top ${l.top} 應等於第一個 top ${t0}（±1px）`).toBeLessThanOrEqual(1);
  }
  for (let i = 1; i < leaves.length; i++) {
    expect(leaves[i].left, `${label}：「${leaves[i].name}」應在「${leaves[i - 1].name}」右側且不重疊`).toBeGreaterThanOrEqual(leaves[i - 1].right - 1);
  }
}

function expectChevrons(leaves: LeafInfo[], label: string) {
  for (const l of leaves) {
    expect(l.clipPath, `${label}：「${l.name}」的 clip-path 應為 polygon（chevron）`).toMatch(/^polygon\(/);
  }
}

// 連線端點落在方塊邊緣（相對 #valueChainEditor 的座標，±2px）
async function expectLinkEndpointsOnBoxEdges(page: Page, label: string) {
  const data = await page.evaluate(() => {
    const editor = document.getElementById('valueChainEditor')!;
    const er = editor.getBoundingClientRect();
    const rect = (id: string) => {
      const el = editor.querySelector(`[data-vc-id="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left - er.left, top: r.top - er.top, right: r.right - er.left, bottom: r.bottom - er.top };
    };
    const links = valueChain.links as { id: string; from: string; to: string }[];
    const paths = Array.from(document.querySelectorAll('#vcLineCanvas path.vc-link-main')).map(p => p.getAttribute('d') || '');
    const inPrimary = (id: string) => !!editor.querySelector(`.vc-zone-primary [data-vc-id="${id}"]`);
    return { links: links.map(l => ({ ...l, from: rect(l.from), to: rect(l.to), primaryOnly: inPrimary(l.from) && inPrimary(l.to) })), paths };
  });
  expect(data.paths.length, `${label}：連線 path 數應等於 links 數`).toBe(data.links.length);
  const num = /-?\d+(?:\.\d+)?/g;
  const onEdge = (p: { x: number; y: number }, r: { left: number; top: number; right: number; bottom: number }) => {
    const inX = p.x >= r.left - 2 && p.x <= r.right + 2, inY = p.y >= r.top - 2 && p.y <= r.bottom + 2;
    const onV = Math.abs(p.x - r.left) <= 2 || Math.abs(p.x - r.right) <= 2;
    const onH = Math.abs(p.y - r.top) <= 2 || Math.abs(p.y - r.bottom) <= 2;
    return inX && inY && (onV || onH);
  };
  data.links.forEach((l, i) => {
    if (!l.primaryOnly) return;  // 到產品欄的線走產品專用路線（ST-23b），端點規則不同，這裡只驗主要活動之間
    const d = data.paths[i];
    expect(d, `${label}：連線 ${l.id} 的 d 不得含 NaN`).not.toMatch(/NaN/);
    const nums = (d.match(num) || []).map(Number);
    const first = { x: nums[0], y: nums[1] }, last = { x: nums[nums.length - 2], y: nums[nums.length - 1] };
    expect(onEdge(first, l.from!), `${label}：連線 ${l.id} 起點 ${JSON.stringify(first)} 應在來源方塊邊緣 ${JSON.stringify(l.from)}`).toBe(true);
    expect(onEdge(last, l.to!), `${label}：連線 ${l.id} 終點 ${JSON.stringify(last)} 應在目標方塊邊緣 ${JSON.stringify(l.to)}`).toBe(true);
  });
}

async function loadFixture(page: Page) {
  await page.evaluate(vc => {
    loadExampleProject('bookstore-a');
    valueChain = normaliseValueChain(JSON.parse(JSON.stringify(vc)));
    resetValueChainIds(valueChain);
    commitValueChain();
    guideGoto('chain');
  }, FIXTURE_VC);
  await expect(page.locator(LEAF)).toHaveCount(FIXTURE_LEAVES.length);
  await page.waitForTimeout(200);  // guideRedrawLines 的 rAF
}

test.describe('ST-35a 橫帶式價值鏈版型（B）', () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
    page.on('dialog', d => d.accept());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(indexUrl.href);
    await page.waitForLoadState('load');
    await loadFixture(page);
  });

  test.afterEach(() => {
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // (a)「葉節點等寬一排」：主要活動葉節點全部等寬（±1px）、同一列 top 相同、左到右依序不重疊（含群組內與巢狀群組內的葉節點）
  test('(a) 1440 寬：主要活動葉節點等寬排成一列', async ({ page }) => {
    const leaves = await readLeaves(page);
    expect(leaves.map(l => l.name)).toEqual(FIXTURE_LEAVES);
    expectSingleRowEqualWidth(leaves, '初始');
  });

  // (b)「chevron（CSS clip-path）」：每個葉節點（含群組內）的 computed clip-path 是 polygon，不是 none
  test('(b) 每個葉節點都是 clip-path polygon 的 chevron', async ({ page }) => {
    const leaves = await readLeaves(page);
    expectChevrons(leaves, '初始');
  });

  // (c)「群組名掛上方橫帶跨其子單元，巢狀疊帶」：每個群組有一條橫帶在其所有葉節點上方（帶底 ≤ 葉頂），
  //     帶的左右涵蓋第一到最後一個葉節點（±2px）；外層群組的帶在內層群組的帶更上方
  test('(c) 群組橫帶在子單元上方並跨其全部子單元；巢狀群組疊帶', async ({ page }) => {
    const groups = await readGroups(page);
    expect(groups.map(g => g.name).sort()).toEqual(['市場', '製造', '銷售']);
    for (const g of groups) {
      expect(g.leaves.length, `群組「${g.name}」應有葉節點`).toBeGreaterThan(0);
      const minTop = Math.min(...g.leaves.map(l => l.top));
      const minLeft = Math.min(...g.leaves.map(l => l.left));
      const maxRight = Math.max(...g.leaves.map(l => l.right));
      expect(g.band.height, `群組「${g.name}」橫帶應有高度`).toBeGreaterThan(8);
      expect(g.band.bottom, `群組「${g.name}」橫帶底 ${g.band.bottom} 應 ≤ 子單元頂 ${minTop}`).toBeLessThanOrEqual(minTop + 0.5);
      expect(g.band.left, `群組「${g.name}」橫帶左 ${g.band.left} 應涵蓋第一個子單元左 ${minLeft}（±2px）`).toBeLessThanOrEqual(minLeft + 2);
      expect(g.band.right, `群組「${g.name}」橫帶右 ${g.band.right} 應涵蓋最後一個子單元右 ${maxRight}（±2px）`).toBeGreaterThanOrEqual(maxRight - 2);
      for (const inner of g.innerBands) {
        expect(g.band.bottom, `外層群組「${g.name}」的帶應在內層帶上方`).toBeLessThanOrEqual(inner.top + 0.5);
      }
    }
    const outer = groups.find(g => g.name === '市場')!, inner = groups.find(g => g.name === '銷售')!;
    expect(inner.depth).toBe(1);
    expect(outer.band.bottom).toBeLessThanOrEqual(inner.band.top + 0.5);
    // 外層帶的左右也要涵蓋內層帶
    expect(outer.band.left).toBeLessThanOrEqual(inner.band.left + 2);
    expect(outer.band.right).toBeGreaterThanOrEqual(inner.band.right - 2);
  });

  // (d)「與矩陣『群組表頭＋細項表頭』一對一」：展開到策略矩陣後，主要活動細項表頭順序＝葉節點左到右順序；
  //     每條群組帶的文字與其涵蓋的葉節點，對應到一個同名、同跨欄的群組表頭
  test('(d) 葉節點順序與群組帶對應矩陣的細項表頭與群組表頭', async ({ page }) => {
    const leaves = await readLeaves(page);
    const groups = await readGroups(page);
    expectSingleRowEqualWidth(leaves, '展開前');
    await page.evaluate(() => expandValueChainToMatrix(true));
    // 解析 thead 的 colSpan／rowSpan，算出每個 th 的起始欄與跨欄數
    const header = await page.$$eval('#matrixTable thead tr', rows => {
      const occupied: Record<string, boolean> = {};
      const leafCols: { col: number; text: string; cls: string }[] = [];
      const groupCols: { col: number; span: number; text: string; cls: string }[] = [];
      rows.forEach((tr, ri) => {
        let col = 0;
        Array.from(tr.children).forEach(th => {
          while (occupied[`${ri},${col}`]) col++;
          const cs = (th as HTMLTableCellElement).colSpan || 1, rs = (th as HTMLTableCellElement).rowSpan || 1;
          for (let r = ri; r < ri + rs; r++) for (let c = col; c < col + cs; c++) occupied[`${r},${c}`] = true;
          const text = (th.childNodes[0] && th.childNodes[0].nodeType === 3 ? th.childNodes[0].textContent : th.textContent) || '';
          if (th.classList.contains('col-header-group')) groupCols.push({ col, span: cs, text: text.trim(), cls: th.className });
          else if (th.classList.contains('col-header') || th.classList.contains('col-header-leaf')) leafCols.push({ col, text: text.trim(), cls: th.className });
          col += cs;
        });
      });
      leafCols.sort((a, b) => a.col - b.col);
      return { leafCols, groupCols };
    });
    const isPrimary = (c: { cls: string }) => !/support-col-header|product-col-header/.test(c.cls);
    const matrixLeaves = header.leafCols.filter(isPrimary);
    expect(matrixLeaves.map(c => c.text), '矩陣主要活動細項表頭順序應與葉節點左到右順序一致').toEqual(leaves.map(l => l.name));
    const matrixGroups = header.groupCols.filter(isPrimary);
    expect(matrixGroups.length, '矩陣群組表頭數應等於群組帶數').toBe(groups.length);
    for (const g of groups) {
      const leafNames = leaves.filter(l => g.leaves.some(b => Math.abs(b.left - l.left) < 0.5 && Math.abs(b.top - l.top) < 0.5)).map(l => l.name);
      const th = matrixGroups.find(m => m.text === g.name);
      expect(th, `群組帶「${g.name}」應有同名群組表頭`).toBeTruthy();
      const spanned = matrixLeaves.filter(c => c.col >= th!.col && c.col < th!.col + th!.span).map(c => c.text);
      expect(spanned, `群組表頭「${g.name}」跨的欄應等於橫帶涵蓋的葉節點`).toEqual(leafNames);
    }
  });

  // (e-1)「改名…保留」：在葉節點與群組帶上改名後，名稱保留、仍等寬 chevron、無錯誤
  test('(e-1) 改名後名稱保留且版型不變', async ({ page }) => {
    const leaf = page.locator(`${LEAF}[data-vc-id="u_prod"] textarea.vc-name-wrap`);
    await leaf.fill('生產改');
    await leaf.press('Enter');
    const band = page.locator(`${GROUP}[data-vc-id="g_sales"] > .vc-node-head textarea.vc-name-wrap`);
    await band.fill('銷售改');
    await band.press('Enter');
    // 觸發一次重畫（點另一個單元的活動／資產標籤兩次＝切過去再切回來）
    await page.locator(`${LEAF}[data-vc-id="u_web"] .vc-kind`).click();
    await page.locator(`${LEAF}[data-vc-id="u_web"] .vc-kind`).click();
    const leaves = await readLeaves(page);
    expect(leaves.map(l => l.name)).toEqual(['研發', '採購', '生產改', '門市', '網路', '客服', '品牌']);
    expect((await readGroups(page)).map(g => g.name).sort()).toEqual(['市場', '製造', '銷售改']);
    expectSingleRowEqualWidth(leaves, '改名後');
    expectChevrons(leaves, '改名後');
  });

  // (e-2)「拖曳…保留」：用滑鼠把「客服」拖到「門市」前面，順序改變、仍等寬一列、連線端點仍在方塊邊緣
  test('(e-2) 拖曳換位後仍等寬一列且連線端點在方塊邊緣', async ({ page }) => {
    const src = page.locator(`${LEAF}[data-vc-id="u_cs"]`);
    const dst = page.locator(`${LEAF}[data-vc-id="u_store"]`);
    const db = (await dst.boundingBox())!;
    // 放在目標的左上 15%／25%：橫排看 X、直排看 Y，兩種情況都算「插在目標前面」
    await src.dragTo(dst, { targetPosition: { x: Math.max(2, db.width * 0.15), y: Math.max(2, db.height * 0.25) } });
    await expect.poll(async () => (await readLeaves(page)).map(l => l.name)).toEqual(['研發', '採購', '生產', '客服', '門市', '網路', '品牌']);
    await page.waitForTimeout(200);
    const leaves = await readLeaves(page);
    expectSingleRowEqualWidth(leaves, '拖曳後');
    expectChevrons(leaves, '拖曳後');
    await expectLinkEndpointsOnBoxEdges(page, '拖曳後');
  });

  // (e-3)「群組化…保留」：按「＋ 群組」新增群組，把「品牌」拖進去；新群組的橫帶跨「品牌」、葉節點仍等寬一列
  test('(e-3) 群組化後新群組有橫帶跨其子單元且葉節點仍等寬一列', async ({ page }) => {
    await page.locator(`${PRIMARY} .vc-zone-footer .col-item-add`, { hasText: '＋ 群組' }).click();
    await expect(page.locator(GROUP)).toHaveCount(4);
    const newGroup = page.locator(`${PRIMARY} > .vc-zone-body > .vc-group`).last();
    await expect(newGroup.locator(':scope > .vc-node-head textarea')).toHaveValue('新群組');
    const body = newGroup.locator(':scope > .vc-group-body');
    await page.locator(`${LEAF}[data-vc-id="u_brand"]`).dragTo(body);
    await expect.poll(async () => (await readGroups(page)).find(g => g.name === '新群組')?.leaves.length).toBe(1);
    const leaves = await readLeaves(page);
    expect(leaves.map(l => l.name)).toEqual(FIXTURE_LEAVES);
    expectSingleRowEqualWidth(leaves, '群組化後');
    const g = (await readGroups(page)).find(x => x.name === '新群組')!;
    const brand = leaves.find(l => l.name === '品牌')!;
    expect(g.band.bottom).toBeLessThanOrEqual(brand.top + 0.5);
    expect(g.band.left).toBeLessThanOrEqual(brand.left + 2);
    expect(g.band.right).toBeGreaterThanOrEqual(brand.right - 2);
  });

  // (e-4)「活動／資產切換…保留」：點 .vc-kind 把「生產」切成資產、「採購」切回活動；標記正確、仍等寬 chevron
  test('(e-4) 活動／資產切換後標記正確且版型不變', async ({ page }) => {
    await page.locator(`${LEAF}[data-vc-id="u_prod"] .vc-kind`).click();
    await expect(page.locator(`${LEAF}[data-vc-id="u_prod"]`)).toHaveClass(/vc-asset/);
    await expect(page.locator(`${LEAF}[data-vc-id="u_prod"] .vc-kind`)).toHaveText('資產');
    await page.locator(`${LEAF}[data-vc-id="u_buy"] .vc-kind`).click();
    await expect(page.locator(`${LEAF}[data-vc-id="u_buy"]`)).not.toHaveClass(/vc-asset/);
    const leaves = await readLeaves(page);
    expect(leaves.find(l => l.name === '生產')!.asset).toBe(true);
    expect(leaves.find(l => l.name === '採購')!.asset).toBe(false);
    expectSingleRowEqualWidth(leaves, '切換後');
    expectChevrons(leaves, '切換後');
  });

  // (e-5)「連線端點全部保留」：初始狀態主要活動之間的連線，SVG path 起點／終點落在來源／目標方塊邊緣（±2px）
  test('(e-5) 連線端點落在方塊邊緣', async ({ page }) => {
    await expectLinkEndpointsOnBoxEdges(page, '初始');
  });

  // (f)「≤800px 回現行直排」：375×667 下葉節點直排（top 遞增、left 相同）且不橫向捲動；
  //     800 寬＝直排、801 寬＝橫排（media max-width:800px 邊界）
  test('(f) 375 與 800 寬直排、801 寬橫排，皆不橫向捲動', async ({ page }) => {
    const vertical = async (label: string) => {
      const leaves = await readLeaves(page);
      expect(leaves.map(l => l.name)).toEqual(FIXTURE_LEAVES);
      for (let i = 1; i < leaves.length; i++) {
        expect(leaves[i].top, `${label}：「${leaves[i].name}」應在「${leaves[i - 1].name}」下方`).toBeGreaterThanOrEqual(leaves[i - 1].bottom - 1);
      }
      const l0 = leaves[0].left;
      for (const l of leaves) expect(Math.abs(l.left - l0), `${label}：「${l.name}」left 應與第一個相同（±1px）`).toBeLessThanOrEqual(1);
      const sw = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      expect(sw.s, `${label}：不得橫向捲動`).toBeLessThanOrEqual(sw.c);
    };
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);
    await vertical('375');
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(200);
    await vertical('800');
    await page.setViewportSize({ width: 801, height: 900 });
    await page.waitForTimeout(200);
    const leaves = await readLeaves(page);
    expectSingleRowEqualWidth(leaves, '801');
    const sw = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    expect(sw.s, '801：不得橫向捲動').toBeLessThanOrEqual(sw.c);
  });

  // (g) 視覺基準：1440 寬主要活動區截圖（基準 PNG 由 worker 實作完成後以 --update-snapshots 產生）
  test('(g) 1440 寬主要活動區截圖', async ({ page }) => {
    const leaves = await readLeaves(page);
    expectSingleRowEqualWidth(leaves, '截圖前');
    await expect(page.locator(PRIMARY)).toHaveScreenshot('ST-35a-primary-band-1440.png', { maxDiffPixelRatio: 0.01 });
  });
});
