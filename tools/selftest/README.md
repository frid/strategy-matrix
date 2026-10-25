# tools/selftest — worker 自測腳本

每項任務的 worker 在這裡留一支 `<任務代號>.mjs`（例如 `ST-14k.mjs`），verifier 直接重跑並延伸。

規則：
- 腳本開頭用註解寫：怎麼跑（需要哪個 Chrome、port）、測了什麼、預期結果。
- 用 CDP（`google-chrome --headless=new --remote-debugging-port=…` ＋ node `ws`）或既有 Playwright（有 `node_modules` 時）。
- `confirm`／`prompt`／`alert` 先 stub；reload 後要重設。
- 截圖與暫存輸出寫到 `$CLAUDE_JOB_DIR/tmp/`，不要寫進 repo。
- 腳本只讀不改專案檔。

2026-10-25 之前的任務（ST-03、ST-05、ST-14a–m、ST-15–17）自測腳本留在各 job 的暫存目錄，未納入 repo。
