#!/usr/bin/env bash
# Render og.html to ../public/og.png at 1200x630 with headless Chrome.
set -euo pipefail
cd "$(dirname "$0")"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --window-size=1200,630 --force-device-scale-factor=1 \
  --screenshot="$PWD/../public/og.png" "file://$PWD/og.html"
