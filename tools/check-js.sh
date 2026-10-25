#!/usr/bin/env bash
# 抽出 index.html 內嵌 <script>（排除有 src 的）接成一支 JS，跑 node --check。
# 用法：tools/check-js.sh [index.html 路徑]   印 "JS OK" 且 exit 0 才算過。
set -e
HTML="${1:-$(dirname "$0")/../index.html}"
OUT="${CLAUDE_JOB_DIR:-/tmp}/tmp/_check_js_$$.js"
mkdir -p "$(dirname "$OUT")"
python3 - "$HTML" "$OUT" <<'EOF'
import re, sys, pathlib
html = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
js = "\n;\n".join(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S))
pathlib.Path(sys.argv[2]).write_text(js, encoding="utf-8")
EOF
node --check "$OUT" && echo "JS OK"
rm -f "$OUT"
