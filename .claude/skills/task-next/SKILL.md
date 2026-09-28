---
name: task-next
description: >-
  從 TODO.md 挑下一項未完成任務，先補編號、先寫計畫給使用者確認，點頭後才動手改 index.html，
  改完驗證，再交給 task-release 收尾。當使用者說「下一步」「接著做」「做下一項」
  「/task-next」「把 TODO 的 XX-01 做掉」時使用。
  硬規則：一次只做一項；先規劃、等使用者點頭再執行；不在 main 上改；使用者沒說「merge」不合併。
metadata:
  version: "1.0.0"
---

# Task Next — 從 TODO.md 接手下一項任務

流程：**補編號 → 選一項 → 寫計畫 → 等點頭 → 執行 → 驗證 → 收尾**。
一次只做一項。全程用繁體中文跟使用者溝通。

---

## 🚨 硬規則

1. **先規劃再執行**：步驟 3 的計畫沒被使用者點頭前，不改任何檔（補編號除外，見步驟 1）。
2. **一次一項**：上一項沒 commit，不開下一項。
3. **不在 `main` 上改**：必須在 worktree／feature branch 上（CLAUDE.md §Git 規則）。
4. **使用者沒明確說「merge」，不合併回 `main`**。`main` 一更新就自動部署 GitHub Pages。
5. **要刪檔、搬檔、改檔名，或規格有兩種以上合理解讀 → 停下問使用者**，不猜。

---

## 步驟 1 — 讀 TODO.md，補編號

```bash
cat TODO.md
git status --short
git branch --show-current
```

- 若目前在 `main` → 停下，請使用者開 worktree／branch（或經同意後用 EnterWorktree）。
- 有別人未 commit 的改動（`TODO.md` 以外）→ 先回報，別動。

**補編號**（TODO.md「# 規則」第 3 條：每次變更前先掃描沒編碼的項目並自動編碼）：

- 規則以 TODO.md 頂端「# 規則」節為準，動手前重讀。
- 主 task 格式：`- [ ] XX-NN 標題`（兩個大寫英文字母＋兩位數字，如 `ST-01`）。
- 子 task：縮排，用 `XX-NNa`、`XX-NNb`…（如 `ST-01a`）。
- 前綴：沿用**同一節內既有項目**的前綴；該節還沒有任何編號 → 自己提一個兩字母前綴，在步驟 3 計畫裡一併給使用者確認。
- 號碼：取該前綴目前最大號＋1；**用過的號碼不重用**。
- 補完用 `git diff TODO.md` 秀給使用者看。

---

## 步驟 2 — 選任務

- 使用者有指定代號 → 做那一項。
- 沒指定 → 取第一個 `- [ ]` 的主 task。有子 task 時，從第一個未完成的子 task 做起。
- 任務帶圖片（`![](assets/xxx.png)`）→ **用 Read 工具打開每張圖看**，圖通常就是規格。

---

## 步驟 3 — 寫計畫，等使用者點頭（強制關卡）

先讀 `index.html` 相關段落，弄清楚要改哪裡，再用這個格式回報：

```
▶ 準備動工：<代號> <標題>

【目標】<一句話：做完後網頁會多了／變成什麼>

【動作】
  1. <動詞開頭，具體到 index.html 的哪個區塊／函式>
  2. ...
  （≤5 步；超過表示太大，先拆成子 task）

【會動到】<檔案清單>
【不會動】<明確劃界>

【要你決定的點】<條列，最多 2 個選項＋我的建議；或「無」>

【驗證方式】<做完怎麼證明它對了>
```

「動作」要寫到使用者能直接說「第 3 步不要做」。

**使用者沒回應前不改任何檔。** 使用者點頭後，把 TODO.md 該項改成 `[~]`（進行中）。

---

## 步驟 4 — 執行

- 照計畫改 `index.html`（單一檔案網頁，HTML／CSS／JS 都在裡面）。
- 寫法跟著檔案現有風格走（命名、縮排、註解密度）。
- 新增的功能若會存進 localStorage／匯出（PPTX、JSON 等），確認舊資料讀得進來、匯出有帶到新欄位。
- 做到一半發現計畫要改 → 停下，跟使用者講哪裡不一樣、為什麼，再繼續。

---

## 步驟 5 — 驗證

1. **語法檢查**：把 `<script>` 抽出來用 node 檢查，不能有語法錯誤。

   ```bash
   python3 - <<'EOF'
   import re, pathlib
   html = pathlib.Path("index.html").read_text(encoding="utf-8")
   js = "\n;\n".join(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S))
   pathlib.Path("/tmp/_task_next_check.js").write_text(js, encoding="utf-8")
   EOF
   node --check /tmp/_task_next_check.js && echo "JS OK"
   ```
   （背景 job 時把 `/tmp` 換成 `$CLAUDE_JOB_DIR/tmp`。）

2. **截圖看畫面**：用 headless Chrome 開頁面截圖，再用 Read 工具看圖，確認新功能有出現、版面沒壞。

   ```bash
   google-chrome --headless=new --disable-gpu --no-sandbox \
     --window-size=1400,1000 --screenshot=<暫存目錄>/after.png \
     "file://$PWD/index.html"
   ```
   有互動（點按鈕、拖曳）才看得到的功能 → 請使用者本機開 `index.html` 手點，列出要點哪幾步。

3. 據實回報：過就說過；沒過就貼錯誤訊息，不要說成功。

---

## 步驟 6 — 收尾

呼叫 `task-release` skill：更新 TODO.md、更新網頁上的「最後更新日期」、commit、push 分支。

---

## 步驟 7 — 回報

- 做完哪一項、commit hash、分支名
- 驗證了什麼、結果如何
- TODO.md 下一個未完成項目是什麼
- 提醒：要上線請說「merge」

然後**停下來**。要不要接著做下一項，由使用者決定。

---

## 版本紀錄

| 版號 | 日期 | 變更 |
|---|---|---|
| 1.0.0 | 2026-09-28 | 建立：參考 QMSWeb `qms-next`，簡化成單檔網頁專案版（先規劃再執行、補編號、截圖驗證） |
