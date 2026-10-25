#!/usr/bin/env bash
# 任務收尾腳本：勾 TODO、（必要時）更新頁尾日期、stage 白名單、commit、push。不 merge，不碰 decisions／pending-checks。
# 環境變數 COAUTHOR 可覆寫 Co-Authored-By（預設 Claude Fable 5.1 <noreply@anthropic.com>）。
# 用法：tools/release-task.sh <代號> "<完成摘要>" [--no-footer] [--no-push]
set -e
CODE="$1"; SUMMARY="$2"
[ -n "$CODE" ] && [ -n "$SUMMARY" ] || { echo "用法：$0 <代號> \"<完成摘要>\" [--no-footer] [--no-push]"; exit 2; }
shift 2
NO_FOOTER=0; NO_PUSH=0
for a in "$@"; do case "$a" in --no-footer) NO_FOOTER=1;; --no-push) NO_PUSH=1;; *) echo "未知參數 $a"; exit 2;; esac; done

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" != "main" ] || { echo "目前在 main，不收尾"; exit 1; }
git status --short

TODAY=$(date +%F)
CODE="$CODE" SUMMARY="$SUMMARY" TODAY="$TODAY" python3 - <<'PY'
import os, re, sys
code, summary, today = os.environ['CODE'], os.environ['SUMMARY'], os.environ['TODAY']
lines = open('TODO.md', encoding='utf-8').read().split('\n')
hit = False
for i, l in enumerate(lines):
    if re.match(r'^\s*- \[[ ~]\] ' + re.escape(code) + r'(\s|$)', l):
        l = re.sub(r'\[[ ~]\]', '[x]', l, count=1)
        note = f'完成 {today}：{summary}'
        l = (l[:-1] + '；' + note + '）') if l.rstrip().endswith('）') else (l.rstrip() + f'（{note}）')
        lines[i] = l; hit = True; break
if not hit: sys.exit(f'TODO.md 找不到未完成項目 {code}')
open('TODO.md', 'w', encoding='utf-8').write('\n'.join(lines))
PY

if [ "$NO_FOOTER" = 0 ] && ! git diff --quiet HEAD -- index.html; then
  TODAY_SLASH=$(date +%Y/%m/%d) python3 - <<'PY'
import os, re
s = open('index.html', encoding='utf-8').read()
s2, n = re.subn(r'(最後更新日期：)\d{4}/\d{2}/\d{2}', r'\g<1>' + os.environ['TODAY_SLASH'], s, count=1)
if n: open('index.html', 'w', encoding='utf-8').write(s2)
PY
fi

for p in TODO.md index.html doc/ tools/ tests/ README.md manual.html manual/; do
  [ -e "$p" ] && git add -- "$p"
done
git status --short

TMPD="${CLAUDE_JOB_DIR:-/tmp}/tmp"; mkdir -p "$TMPD"
printf '%s %s\n\nCo-Authored-By: %s\n' "$CODE" "$SUMMARY" "${COAUTHOR:-Claude Fable 5.1 <noreply@anthropic.com>}" > "$TMPD/commit_msg.txt"
git commit -F "$TMPD/commit_msg.txt"

if [ "$NO_PUSH" = 0 ]; then
  git push -u origin "$BRANCH"
  git ls-remote --heads origin "$BRANCH"
fi
