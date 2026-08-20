#!/usr/bin/env bash
# ローカルCIスクリプト。型チェック・依存方向チェック(lint)・単体テスト・E2Eを順に実行する。
# CSP/Webview/WASM読み込みという壊れやすい組み合わせの上に成り立っているため、
# 将来の変更で静かに壊れないよう、ここで一気通貫に確認する。
# 使い方: npm run ci  (= bash scripts/ci.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

step() {
  echo ""
  echo "==> $1"
}

step "1/4 typecheck (tsc --noEmit)"
npm run typecheck

step "2/4 lint (dependency-cruiser: レイヤー間の依存方向チェック)"
npm run lint

step "3/4 test:unit (vitest)"
npm run test:unit

step "4/4 test:e2e (@vscode/test-web: 拡張の有効化・Webview表示・SVG生成・エラー0件を検証)"
npm run pretest:e2e
npm run test:e2e

echo ""
echo "✔ すべてのチェックが通過しました"
