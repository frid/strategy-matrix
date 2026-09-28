---
name: task-next
description: >-
  從 TODO.md 挑下一項未完成任務，先補編號、先寫計畫給使用者確認，點頭後才動手改 index.html，
  改完驗證，再交給 task-release 收尾。當使用者說「下一步」「接著做」「做下一項」
  「/task-next」「把 TODO 的 XX-01 做掉」時使用。
  硬規則：一次只做一項；先規劃、等使用者點頭再執行；不在 main 上改；使用者沒說「merge」不合併。
metadata:
  version: "1.2.0"
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
6. **改檔、驗證都交給 subagent**：主 session 只負責讀 TODO、寫計畫、派工、檢查 subagent 的成果、收尾（`TODO.md`／頁尾日期／commit 可由主 session 做）。主 session 不直接改 `index.html`，連「只有一行」的改動也一樣。
7. **主 session 用量守在六成內**：context 用量超過約 60% → 先把目前進度收尾（commit），提醒使用者 `/clear` 後再用 `task-next` 接著做。`/clear` 只有使用者能按。

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

`index.html` 很大（2000+ 行），**不要整份讀進主 session**。派一個 `Explore` subagent（thoroughness 用 "medium"）去找：跟任務相關的區塊／函式在第幾行、資料怎麼存（localStorage 結構）、匯出（PPTX 等）有沒有要跟著改。只拿回結論和行號。

拿到結論後，用這個格式回報：

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

【派工】worker：<worker-haiku／worker-sonnet／worker-opus>，理由 <一句>；verifier：verifier-sonnet
```

「動作」要寫到使用者能直接說「第 3 步不要做」。

**使用者沒回應前不改任何檔。** 使用者點頭後，把 TODO.md 該項改成 `[~]`（進行中）。

---

## 步驟 4 — 派 worker subagent 執行

用 Agent tool，`subagent_type` 依下表選 `worker-haiku`／`worker-sonnet`／`worker-opus`（`.claude/agents/`，frontmatter 已固定模型，**不另傳 `model` 參數**；類型名帶模型，使用者在 subagent view 看得到）。由主 session 依任務自己選（不用問使用者）：

| 任務性質 | `subagent_type` | 例子 |
|---|---|---|
| 機械性小改：改文字、改顏色、改日期、加一個按鈕呼叫既有函式 | `worker-haiku` | 改副標題、換預設欄位名 |
| 一般功能：新 UI 區塊、新互動、改匯出內容，規格清楚 | `worker-sonnet` | 加一種匯出格式、加欄位拖曳 |
| 牽涉資料結構／多處連動／規格要推敲 | `worker-opus` | 價值鏈編輯（動到矩陣結構＋存檔＋PPTX 匯出） |

判準：規格越清楚、動到的地方越少 → 越輕。拿不準就往重的選一級。

prompt 至少交代：
- 任務代號、TODO.md 原文、附圖路徑（叫它用 Read 看圖）
- 使用者**已同意的計畫全文**（步驟 3），照計畫做，不加料
- Explore 找到的相關行號
- 寫法跟著檔案現有風格走（命名、縮排、註解密度）
- 會存進 localStorage／匯出（PPTX、JSON 等）的功能：舊資料要讀得進來，匯出要帶到新內容
- **禁止**：不得 commit、不得改 `TODO.md`、不得改頁尾「最後更新日期」（收尾由主 session 做）
- 做到一半發現計畫行不通 → 停下回報「哪裡不一樣、有哪些選項」，不要自己決定
- 回報：改了哪些檔、哪幾段、為什麼

worker 回來後，主 session 用 `git diff --stat` 看改動範圍有沒有超出計畫；超出 → 回報使用者。

---

## 步驟 5 — 派 verifier subagent 驗證

**改的人不驗自己。** 主 session 另派 `subagent_type: verifier-sonnet`（`.claude/agents/verifier-sonnet.md`，只有 Read／Bash／Grep／Glob，不能改檔）做驗證（subagent 不能再開 subagent，一定是主 session 依序派）。

verifier prompt 交代：任務代號、計畫中的【驗證方式】、worker 報告的改動清單、下面兩項檢查；並**禁止它改任何檔**，只回報 PASS／FAIL 和證據（截圖路徑、錯誤訊息）。

檢查項目：

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

verifier 回報後，主 session 自己看一眼截圖（Read 圖檔）確認。
**FAIL → 不收尾**：把失敗原因回報使用者，問要不要再派 worker 修。

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
| 1.2.0 | 2026-09-28 | 派工改用 `worker-haiku`／`worker-sonnet`／`worker-opus`、驗證改用 `verifier-sonnet`（`.claude/agents/`，類型名帶模型），取代 `general-purpose`＋`model` 參數；參考 QMSWeb |
| 1.1.0 | 2026-09-28 | 改檔交 worker subagent（依任務選 haiku／sonnet／opus）、驗證另派 verifier subagent、讀 index.html 用 Explore；主 session 用量守六成 |
| 1.0.0 | 2026-09-28 | 建立：參考 QMSWeb `qms-next`，簡化成單檔網頁專案版（先規劃再執行、補編號、截圖驗證） |
