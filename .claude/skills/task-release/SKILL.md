---
name: task-release
description: >-
  任務做完並驗證後的收尾流程：勾選 TODO.md、更新 index.html 頁尾「最後更新日期」、
  只 stage 本任務的檔、commit、push 分支。當 task-next 走到收尾、或使用者說
  「收尾」「commit」「/task-release」時使用。不會自動合併——使用者說「merge」才併入 dev、說「release」才上 main。
metadata:
  version: "1.1.0"
---

# Task Release — 任務收尾

一任務一 commit。只提交本任務的改動，不夾帶無關變更。全程用繁體中文回報。

---

## 步驟 0 — 預檢

```bash
git branch --show-current
git status --short
git diff --stat
```

- 在 `main` 上 → 停下，不 commit（CLAUDE.md：修改一律在 branch／worktree 上做）。
- 有不屬於本任務的改動 → 不 stage，有疑問就問使用者。

---

## 步驟 1 — 更新 TODO.md

用 Edit 工具改，改前先重讀最新版。

- 狀態：`[ ]` 未開始 → `[~]` 進行中 → `[x]` 完成。
- 完成項在行尾加完成日：`（完成 YYYY-MM-DD）`。
- 父項還沒全做完：只勾完成的子項，父項維持 `[~]`。
- 做的過程中冒出新待辦 → 照 TODO.md「# 規則」編號後加進去。

---

## 步驟 2 — 更新網頁「最後更新日期」

`index.html` 頁尾有一行：

```
最後更新日期：YYYY/MM/DD
```

```bash
grep -n "最後更新日期" index.html
```

改成今天日期（格式 `YYYY/MM/DD`）。只有真的改了 `index.html` 才更新；只動 TODO／文件就不改。

---

## 步驟 3 — Stage 與 Commit

- 只 `git add` 本任務的檔：通常是 `index.html`、`TODO.md`，任務用到的新圖片（`assets/`）一起加。
- commit 訊息寫到暫存檔再 `git commit -F`（背景 job 用 `$CLAUDE_JOB_DIR/tmp/commit_msg.txt`，不要用共用 `/tmp`）。
- 格式：第一行 `<代號> <一句摘要>`，例 `ST-01 新增價值鏈編輯功能`；內文條列做了什麼、怎麼驗證的。
- 結尾加當前 session system-reminder 給的 Co-Authored-By 行（不要寫死舊模型名）。

```bash
git commit -F "$CLAUDE_JOB_DIR/tmp/commit_msg.txt"
git log --oneline -1
```

---

## 步驟 4 — Push 分支

```bash
git push -u origin "$(git branch --show-current)"
```

- **只 push 分支，絕不 push `main`、不 force push。**
- push 失敗（沒權限、沒網路）→ 據實回報，不要硬試別的方法。

---

## 步驟 5 — 回報

- commit hash、分支名、納入哪些檔
- 驗證摘要
- 下一步：「要併入開發分支請說『merge』；要上線請說『release』」

---

## 合併到 dev（只有使用者說「merge」才做）

1. 先讓使用者確認要合併的 commit 清單：`git log --oneline dev..<branch>`。
2. `git checkout dev && git pull && git merge --no-ff <branch> && git push origin dev`（在主 checkout 做，不在 worktree 裡做）。
3. 合併後可刪 worktree branch。`dev` 不會部署。

## Release 到 main（只有使用者說「release」才做）

1. 確認版號：使用者指定，或提議上一個 tag 的 patch +1（`git tag --sort=-v:refname | head -1`）。
2. `git log --oneline main..dev` 給使用者看要上線的內容。
3. `git checkout main && git pull && git merge --no-ff dev && git tag -a vX.Y.Z -m "..." && git push origin main --tags`。
4. 合併後 `main` 會自動部署到 https://jack0630.github.io/strategy-matrix/ ，提醒使用者過幾分鐘去看。

---

## 版本紀錄

| 版號 | 日期 | 變更 |
|---|---|---|
| 1.0.0 | 2026-09-28 | 建立：參考 QMSWeb `qms-release`，拿掉版號／burndown／DB 閘門，改成單檔網頁專案版 |
| 1.1.0 | 2026-10-25 | 三層分支：merge→dev、release→main＋tag |
