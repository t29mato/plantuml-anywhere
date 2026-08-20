#!/usr/bin/env bash
# Chrome/Brave拡張機能(browser-extension/)をビルドし、配布用zipを作る。
# 生成物: plantuml-web-browser-extension-<version>.zip (リポジトリ直下)
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build:browser-extension

VERSION=$(node -e "console.log(require('./browser-extension/manifest.json').version)")
OUT="plantuml-web-browser-extension-${VERSION}.zip"

rm -f "$OUT"
rm -f browser-extension/dist/renderer.js.map

# zipの中身はブラウザが読み込むファイルのみ(sourcemap等の開発用ファイルは含めない)
(cd browser-extension && zip -r "../$OUT" \
  manifest.json \
  content-loader.js \
  background.js \
  onboarding.html \
  icon.png \
  dist/renderer.js \
  -x '*.map')

echo "packaged: $OUT"
unzip -l "$OUT"
