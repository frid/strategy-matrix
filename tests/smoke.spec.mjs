import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const indexUrl = new URL('../index.html', import.meta.url);
const manualUrl = new URL('../manual.html', import.meta.url);

test.describe('index.html 冒煙測試', () => {
  let errors;
  let page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push('console.error: ' + m.text());
    });
    page.on('dialog', d => d.accept());
    await page.goto(indexUrl.href);
    await page.waitForLoadState('load');
  });

  test('載入無錯誤、關鍵元素存在、CDN 函式庫可用', async () => {
    await expect(page.locator('#matrixTable')).toHaveCount(1);
    await expect(page.locator('#exampleSelect')).toHaveCount(1);
    await expect(page.locator('#matrixContainer')).toHaveCount(1);
    const libs = await page.evaluate(() => ({
      html2canvas: typeof window.html2canvas,
      JSZip: typeof window.JSZip,
    }));
    expect(libs.html2canvas).not.toBe('undefined');
    expect(libs.JSZip).not.toBe('undefined');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('每個範例專案都能載入並產生矩陣', async () => {
    const ids = await page.evaluate(() => EXAMPLE_PROJECTS.map(x => x.id));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const before = errors.length;
      await page.evaluate(i => loadExampleProject(i), id);
      const n = await page.locator('#matrixTable td').count();
      expect(n, `範例 ${id} 的 td 數量`).toBeGreaterThan(0);
      expect(errors.slice(before), `範例 ${id} 載入後的錯誤`).toEqual([]);
    }
  });
});

test('內嵌 JS 語法檢查（node --check）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-check-'));
  for (const url of [indexUrl, manualUrl]) {
    const html = readFileSync(fileURLToPath(url), 'utf8');
    const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
    const name = url.pathname.split('/').pop().replace('.html', '');
    let m, i = 0;
    while ((m = re.exec(html))) {
      if (/\ssrc\s*=/i.test(m[1] || '')) continue;
      if (!m[2].trim()) continue;
      const file = join(dir, `${name}-${i++}.js`);
      writeFileSync(file, m[2]);
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    }
  }
});
