#!/usr/bin/env bash
# release 前本機測試閘門：以 exit code 判定，印 PASS 才能 release
set -e
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  npm install
  node node_modules/@playwright/test/cli.js install chromium
fi

if npm test; then
  echo "RELEASE CHECK: PASS"
else
  echo "RELEASE CHECK: FAIL"
  exit 1
fi
