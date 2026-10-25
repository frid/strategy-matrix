# tests/fixtures — 舊版存檔 fixture

`strategyMatrix_v4-<範例 id>.json` 是 localStorage 鍵 `strategyMatrix_v4` 的原字串（已縮排格式化），
用來驗證「舊存檔載入受測版不出錯」。目前兩份：`bookstore-a`（網路書店 A 公司）、`foundry-t`（晶圓代工 T 公司）。

## 產生方式
用**基準版**（`../dev/index.html`，即尚未加入新欄位的版本）：

```js
import { launch } from '../../tools/cdp-harness.mjs';
const h = await launch();
await h.open('/abs/path/to/dev/index.html');
await h.loadExample('bookstore-a');
const raw = await h.ev(`saveState(); localStorage.getItem('strategyMatrix_v4')`);
// JSON.stringify(JSON.parse(raw), null, 2) 後寫檔
```

之後若 `saveState` 結構有重大變更，可在變更**之前**的版本重產一份新 fixture（檔名加版本或日期），保留舊的。

## 使用方式：寫進 localStorage 後 reload
```js
import { readFileSync } from 'node:fs';
const raw = readFileSync('tests/fixtures/strategyMatrix_v4-bookstore-a.json', 'utf8');
await h.open('/abs/path/to/index.html');
await h.ev(`localStorage.setItem('strategyMatrix_v4', ${JSON.stringify(JSON.stringify(JSON.parse(raw)))}); 0`);
await h.send('Page.reload');
await new Promise(r => setTimeout(r, 1500));
await h.stubDialogs();           // reload 後 stub 消失，要重設
console.log(h.errors());         // 應為空
```
範例見 `tools/selftest/ST-19.mjs`。
