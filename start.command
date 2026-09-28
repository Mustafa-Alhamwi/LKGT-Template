#!/bin/bash
# LKGT Studio — تشغيل على macOS / Linux
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required: https://nodejs.org  (LTS)"
  read -r
  exit 1
fi
[ -d node_modules ] || npm install
npm run dev
