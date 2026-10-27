# tests

## ST-21 回歸腳本

`node tests/st-21-regression.mjs [--base <舊版 index.html>] [--out <截圖目錄>] [--strict-slide1]`（零 npm 依賴，用 `tools/cdp-harness.mjs`，需 Node 24+、Chrome）。
`--base` 預設自動 `git show v1.0.0:index.html` 到暫存；`--out` 預設 `$CLAUDE_JOB_DIR/tmp/st21e`（無則 `os.tmpdir()/st21e`）。

檢查項：
- a：兩份 `tests/fixtures` 舊存檔載入無 console error、六個 tab 逐一切換並截圖；③ `#lineCanvas` 連線數 >0 且座標無 NaN／0；① `#vcLineCanvas` 連線數對得上存檔 `valueChain.links`；①→③→① 往返連線數不變。
- b：載 bookstore-a、foundry-t 範例，六步 `guideProgress()` pct 與 v1.0.0 同範例結果相同（印對照表）。
- c：兩範例各匯出 PPTX，張數相同；`ppt/slides/slide*.xml` 除 slide1 外與 v1.0.0 逐張完全相同。slide1（價值鏈頁）自 ST-23c 起產品改在 Margin 右側直欄，必然與 v1.0.0 不同，改驗：產品直排方塊數＝範例產品數、產品 x 在 Margin 右緣之右、連接器涵蓋每條連線且全部正交（cx 或 cy 為 0）、`buildValueChainShapesXml.lastInfo.skippedLinks === 0`。加 `--strict-slide1` 恢復 slide1 也逐張比對（以新基準版比對時用）。
- d：六張說明卡存在且 purpose 非空；`#step-3` 直連開在 ideas。
- e（ST-22）：重新整理／他 tab 套用價值鏈後切回 ①，`textarea.vc-name-wrap` offsetHeight >10；主「載入」選價值鏈檔（`kind==="strategyMatrix.valueChain"`）不 reload、不取代 arrows／標題。

結果以 exit code 回報（全過 0、有 FAIL 為 1）。截圖不進 git。
最近一次結果：2026-10-26 ALL PASS（基準 v1.0.0；dev 916e5ac）。
