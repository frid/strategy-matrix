# strategy-matrix

策略矩陣分析工具（司徒達賢教授的 Strategic Matrix）。單一檔案網頁 `index.html`，部署在 GitHub Pages：https://jack0630.github.io/strategy-matrix/

## Git 規則

三層分支：`worktree／feature` → `dev` → `main`。

- `main`：正式版，一更新就自動部署到 GitHub Pages。**只在 release 時**從 `dev` 合併過來，並打版號 tag（`vX.Y.Z`）。
- `dev`：開發整合分支。worktree 做完、驗證過的任務先合併到這裡。
- 修改一律在新的 worktree／feature branch 上做（從 `dev` 分出），不要直接改 `dev` 或 `main`。
- **使用者說「merge」→ 合併到 `dev`**（worktree branch → dev，合併後可刪該 branch）。
- **使用者說「release」→ 從 `dev` 合併到 `main` 並打 tag**；版號由使用者指定，沒指定就提議一個（patch +1）再確認。release 時順便把 `TODO.md` 已完成的項目搬到 `## Complete` 區並標 release 版號（平時收尾只勾 `[x]` 不搬）。
- 沒聽到上面兩個字之前，只能 commit / push 分支。

## 參考資料

- 原始教材（教科書掃描、講義 PDF、上課備忘、錄音逐字稿）都在上一層課程資料夾 `../../`（本機 Google Drive 掛載），**不進 git**。
- 來源清單、代號與頁碼標法見 `doc/reference/README.md`；要找資料先讀它。本機找不到的檔案用 Google Drive 連接器搜（資料夾 ID 也記在該檔）。
- 新資料的處理方式：在 README 登記 → 摘要成 `doc/reference/<主題>.md` 並標頁碼 → `TODO.md` 只指向摘要。

## 溝通
- 用繁體中文回覆。

## 工作流程

待辦事項都記在 `TODO.md`（編號規則見該檔頂端「# 規則」）。做 TODO 的任務一律走下面流程：

1. **接任務** → 用 `task-next` skill（使用者說「下一步」「接著做」「/task-next」時）。
   - 先掃 `TODO.md`，把沒編號的項目自動編號。
   - 一次只挑一項（使用者沒指定就取第一個 `[ ]`）；有附圖要先看圖。
2. **先規劃再執行** → 先把「目標／動作／會動到／驗證方式」寫給使用者看，**使用者點頭後才改檔**。
3. **執行（交 subagent）** → 開工時把該項標成 `[~]`。主 session 不直接改 `index.html`：讀程式派 `Explore`，改檔派一個 worker subagent，由 Claude 依任務自選（小改 `worker-haiku`／一般功能 `worker-sonnet`／動到資料結構或多處連動 `worker-opus`；定義在 `.claude/agents/`，名字帶模型）。
4. **驗證（另派 subagent）** → 改的人不驗自己：另派 `verifier-sonnet`（不能改檔）做 JS 語法檢查（`node --check`）＋ headless Chrome 截圖；需要手點的功能請使用者本機確認。結果據實回報，FAIL 不收尾。
5. **收尾** → 用 `task-release` skill：`TODO.md` 標 `[x]` 加完成日、更新頁尾「最後更新日期」、commit、push 分支。
6. **停下** → 回報 commit / 分支，等使用者決定下一步。要上線必須等使用者說「merge」。

**用量守六成**：主 session context 用量超過約 60% → 先 commit 目前進度，提醒使用者 `/clear` 後再用 `task-next` 接著做。
