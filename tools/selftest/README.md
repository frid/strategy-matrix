# tools/selftest — worker 自測腳本

每項任務的 worker 在這裡留一支 `<任務代號>.mjs`（例如 `ST-14k.mjs`），verifier 直接重跑並延伸。

規則：
- 腳本開頭用註解寫：怎麼跑（需要哪個 Chrome、port）、測了什麼、預期結果。
- 優先用共用 harness（見下）；沒有時才自己走 CDP 或既有 Playwright（有 `node_modules` 時）。
- `confirm`／`prompt`／`alert` 先 stub；reload 後要重設。
- 截圖與暫存輸出寫到 `$CLAUDE_JOB_DIR/tmp/`，不要寫進 repo。
- 腳本只讀不改專案檔。

2026-10-25 之前的任務（ST-03、ST-05、ST-14a–m、ST-15–17）自測腳本留在各 job 的暫存目錄，未納入 repo。

## 共用 harness：`tools/cdp-harness.mjs`
```js
import { launch } from '../cdp-harness.mjs';
const h = await launch();                       // 1400×900；CHROME_BIN 可覆寫 Chrome 路徑
await h.open('/abs/path/index.html');           // 自動 stubDialogs
await h.loadExample('bookstore-a');             // 另有 foundry-t、theory-semi 等
await h.captureDownloads();                     // 攔 Blob 下載；reload 後要重呼叫
await h.ev('exportPptx()');
const buf = await h.blobBytes(0);               // 大檔分塊取回 Buffer（downloads() 只回 name/type/size）
const z = await h.zipEntries(0);                // { names, read(name) }
await h.shot('#matrixContainer', out + '/m.png'); // null＝整頁
console.log(h.errors()); await h.close();
```
舊存檔 fixture 在 `tests/fixtures/`（用法見該目錄 README），範例腳本：`ST-18.mjs`、`ST-19.mjs`。
