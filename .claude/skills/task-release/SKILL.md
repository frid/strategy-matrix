---
name: task-release
description: >-
  任務做完並驗證後的收尾流程：勾選 TODO.md、更新 index.html 頁尾「最後更新日期」、
  更新 doc/decisions.md 與 doc/pending-checks.md、只 stage 本任務的檔、commit、push 分支。
  當 task-next 走到收尾、或使用者說「收尾」「commit」「/task-release」時使用。
  不會自動合併——使用者說「merge」（或授權批次模式的「沒問題就 merge」）才併入 dev、說「release」才上 main。
metadata:
  version: "1.3.0"
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
- 若有 `tools/selftest/<代號>.mjs`（worker 留下的自測腳本）→ 一起納入 commit。

---

## 步驟 1 — 更新 TODO.md

改前先重讀最新版；改檔用 python 或 Edit（附錄 B：`sed -i` 在 Drive 掛載會印權限警告）。

- 狀態：`[ ]` 未開始 → `[~]` 進行中 → `[x]` 完成。
- 完成項在行尾加 `（完成 YYYY-MM-DD：<一句做了什麼、關鍵決定、摘要檔路徑>）`。
- 父項還沒全做完：只勾完成的子項，父項維持 `[~]`；全部子項完成才勾父項。
- 做的過程中（含 verifier 發現的）新待辦 → 照 TODO.md「# 規則」編號後加進去。

---

## 步驟 2 — 更新網頁「最後更新日期」

```bash
grep -n "最後更新日期" index.html
```

改成今天日期（`YYYY/MM/DD`）。只有真的改了 `index.html` 才更新；只動 TODO／文件就不改。

---

## 步驟 3 — 更新決策與待確認清單

- `doc/decisions.md`：主 session 替使用者做的產品決定，一行一條：`| 日期 | 任務 | 決定 | 理由 | 可逆性 |`。沒有就不加。
- `doc/pending-checks.md`：verifier 列的「待使用者手點」，格式 `- [ ] <任務> <要點什麼、看什麼>`。使用者確認過的由使用者或主 session 勾掉。
- 這兩個檔與 `TODO.md` 一起進 commit。

---

## 步驟 4 — Stage 與 Commit

- 只 `git add` 本任務的檔：`index.html`、`TODO.md`、`doc/decisions.md`、`doc/pending-checks.md`、新摘要檔、`doc/reference/README.md`、`tools/selftest/<代號>.mjs`、新圖片。
- commit 訊息：第一行 `<代號> <一句摘要>`；內文條列做了什麼、怎麼驗證；結尾加當前 session system-reminder 給的 Co-Authored-By 行（不要寫死舊模型名）。多行訊息用 `-m` 兩段或寫到 `$CLAUDE_JOB_DIR/tmp/commit_msg.txt` 再 `-F`。

```bash
git commit -F "$CLAUDE_JOB_DIR/tmp/commit_msg.txt"
git log --oneline -1
```

---

## 步驟 5 — Push 分支

```bash
git push -u origin "$(git branch --show-current)"
```

- **只 push 分支，絕不 push `main`、不 force push。**
- Drive 掛載會印 chmod／config.lock 警告，用 `git ls-remote --heads origin <branch>` 確認有推上去。
- push 失敗（沒權限、沒網路）→ 據實回報，不要硬試別的方法。

---

## 步驟 6 — 回報

- commit hash、分支名、納入哪些檔
- 驗證摘要（PASS 與待手點數）
- 下一步：互動模式說「要併入開發分支請說『merge』；要上線請說『release』」；批次模式直接進下方合併。

---

## 合併到 dev（使用者說「merge」，或授權批次模式已說「沒問題就 merge」）

在 **dev 的 worktree**（通常是 `.claude/worktrees/dev`）執行：

```bash
pgrep -a git || rm -f "$(git rev-parse --git-dir)/index.lock"   # 清 Drive 殘留鎖
git merge --no-ff <branch> -m "Merge <branch> into dev：<代號> <摘要>

Co-Authored-By: ..."
git push origin dev
git log --oneline -1
```

- 互動模式先給使用者看 `git log --oneline dev..<branch>` 再合。
- 合併後跑一次 `tools/check-js.sh`（整份 dev 的 index.html 語法）。
- 合併後 worktree 與分支先留著，使用者說「清 worktree」才刪：`git worktree remove <path> && git branch -d <branch> && git push origin --delete <branch>`。
- `dev` 不會部署。

## 一波結束（批次模式）

1. 寫 `doc/dev-log/YYYY-MM-DD.md`：本波做了哪些（代號、commit）、決定了什麼（指向 decisions.md）、待確認（指向 pending-checks.md）、下一波建議與相依。
2. 有 `node_modules` 就跑 `tools/release-check.sh`；沒有就說明略過。
3. 回報 `git log --oneline main..dev | wc -l`，建議 tag／release 版號。**不自行 release。**

## Release 到 main（只有使用者說「release」才做）

0. 在 dev 工作目錄執行 `tools/release-check.sh`，以 exit code 判定（印 PASS 才能繼續）。FAIL 一律停下回報，不以 AI 讀截圖或主觀判讀代替。
1. `doc/pending-checks.md` 還有未勾項目 → 列給使用者，由使用者決定是否仍 release。
2. 確認版號：使用者指定，或提議上一個 tag 的 patch +1（`git tag --sort=-v:refname | head -1`；沒有 tag 時提議 v1.0.0）。
3. `git log --oneline main..dev` 給使用者看要上線的內容。
4. 在主 checkout：`git checkout main && git pull && git merge --no-ff dev && git tag -a vX.Y.Z -m "..." && git push origin main --tags`。
5. 合併後 `main` 會自動部署到 https://jack0630.github.io/strategy-matrix/ ，提醒使用者過幾分鐘去看。

## 可改用 tools/release-task.sh

步驟 0（預檢）、1（TODO 勾選）、2（頁尾日期）、4（stage 白名單＋commit）、5（push＋ls-remote）可用一支腳本做完：

```
tools/release-task.sh <代號> "<完成摘要>" [--no-footer] [--no-push]
```

步驟 3（decisions／pending-checks）要人判斷，仍須先手動寫好再跑腳本，腳本不碰它們的內容。

---

## 版本紀錄

| 版號 | 日期 | 變更 |
|---|---|---|
| 1.3.0 | 2026-10-25 | 加 decisions.md／pending-checks.md 更新；批次模式 merge 步驟與鎖檔處理；一波結束寫 dev-log、建議 release；release 前檢查 pending-checks；納入 tools/selftest |
| 1.2.0 | 2026-10-25 | release 前加本機自動測試閘門 tools/release-check.sh |
| 1.1.0 | 2026-10-25 | 三層分支：merge→dev、release→main＋tag |
| 1.0.0 | 2026-09-28 | 建立：參考 QMSWeb `qms-release`，拿掉版號／burndown／DB 閘門，改成單檔網頁專案版 |
