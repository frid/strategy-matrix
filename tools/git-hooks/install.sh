#!/bin/sh
# 把 tools/git-hooks/* 安裝到本 repo 的共用 hooks 目錄（.git/hooks，所有 worktree 共用）。
set -e
here="$(cd "$(dirname "$0")" && pwd)"
hooks="$(git rev-parse --git-common-dir)/hooks"
mkdir -p "$hooks"
for f in pre-push; do cp "$here/$f" "$hooks/$f"; chmod +x "$hooks/$f" 2>/dev/null || true; done
echo "已安裝：$hooks/pre-push"
