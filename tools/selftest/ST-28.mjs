// ST-28 自測：manual.html／README 與重拍截圖的一致性
// 跑法：node tools/selftest/ST-28.mjs [開工時間 epoch 秒；預設以最新圖檔時間往前 15 分鐘為門檻]
// 測：a manual/img 39 張皆被 manual.html 引用且 naturalWidth>0；b 圖檔 mtime 為同一批重拍；
//     c manual.html／README 不含過時字樣（下方面板、疊圖、產品面板（上）、overlayChk）；
//     d manual.html 含 37-elem-card 與說明卡文字；e index.html 與 HEAD 無差異。
// 預期：全部 PASS，exit 0。另請重跑 ST-21f.mjs。
import { launch } from '../cdp-harness.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const files = readdirSync(resolve(root, 'manual/img')).filter(f => f.endsWith('.png'));
ok(files.length === 39, `manual/img 共 ${files.length} 張（預期 39）`);
const h = await launch({ width: 1200, height: 900 });
await h.open(resolve(root, 'manual.html'));
await h.ev(`Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))`);
const imgs = await h.ev(`[...document.images].map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth }))`);
const used = new Set(imgs.filter(i => i.w > 0).map(i => i.src.split('/').pop()));
ok(imgs.every(i => i.w > 0), '所有 img 載入成功');
ok(files.every(f => used.has(f)), '每張 png 都被引用 ' + files.filter(f => !used.has(f)).join(','));
const m = files.map(f => statSync(resolve(root, 'manual/img', f)).mtimeMs);
const since = process.argv[2] ? +process.argv[2] * 1000 : Math.max(...m) - 15 * 60e3;
ok(m.every(t => t >= since), '圖檔 mtime 皆在同一批重拍');
const bad = ['下方面板', '疊圖', '產品面板（上）', 'overlayChk'];
for (const f of ['manual.html', 'README.md']) {
  const t = readFileSync(resolve(root, f), 'utf8');
  for (const w of bad) ok(!t.includes(w), `${f} 不含「${w}」`);
}
const mh = readFileSync(resolve(root, 'manual.html'), 'utf8');
ok(mh.includes('37-elem-card.png') && mh.includes('要素說明卡'), 'manual.html 含說明卡圖與文字');
ok(execSync('git diff --stat -- index.html', { cwd: root }).toString().trim() === '', 'index.html 未改');
try { await h.close(); } catch {}
process.exit(fail ? 1 : 0);
