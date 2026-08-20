# PlantUML Web Preview (PoC)

**インストールするだけでPlantUMLが見える。Java不要・Graphviz不要・サーバー不要。github.dev でも動く。**

`.puml` / `.plantuml` ファイルを開いてコマンドを実行すると、Webviewにクラス図・シーケンス図等のプレビューが表示されます。追加のランタイムインストールや外部サーバーへの通信は一切不要です。

![class-diagram-example](spikes/class-diagram.png)

*(上記は実際にレンダリングされたクラス図の例です)*

## なぜこれが可能か

既存の最大手拡張機能 `jebbs.plantuml`(360万インストール)は、レンダリングにJavaとGraphvizのインストールを必須とします(または外部のPlantUMLサーバーへのネットワーク送信が必要です)。VS Code **Web Extension**(vscode.dev / github.dev のようにブラウザ内で動くVS Code)は子プロセスを起動できないため、この方式は原理的に移植できません。

本拡張機能は `@plantuml/core`(PlantUMLエンジンをTeaVMでJavaScriptに、レイアウトエンジン(Graphviz)をWASMにコンパイルしたもの、MITライセンス)を使い、レンダリングをブラウザ内で完結させます。ファイルの内容がサーバーに送信されることはありません。

- **デスクトップ版VS Code・vscode.dev・github.dev すべてで同じ拡張機能がそのまま動作**します(`package.json` の `browser` エントリのみ。`main` エントリは不要。実機検証済み: [`docs/design/vsix-install-verification.md`](docs/design/vsix-install-verification.md))。
- パッケージサイズは圧縮後 **1.94MB** と軽量です。

## 使い方

1. `.puml` または `.plantuml` ファイルを開く
2. コマンドパレット(`Cmd/Ctrl+Shift+P`)から `PlantUML: Preview` を実行する
3. 右側にWebviewが開き、プレビューが表示される

## 開発者向け: ソースからビルド・実行する

```sh
npm install
npm run build
```

VS Code で本リポジトリを開き、F5(Run Extension)でデバッグ実行するか、`@vscode/test-web` でブラウザ版として起動できます:

```sh
npx @vscode/test-web --extensionDevelopmentPath=. --esm <対象フォルダ>
```

`.vsix` パッケージを作ってローカルインストールする場合:

```sh
npx @vscode/vsce package
code --install-extension plantuml-web-0.0.1.vsix
```

## 設計

クリーンアーキテクチャに基づき、ドメイン層(`src/domain`)・アプリケーション層(`src/application`)は VS Code API にも `@plantuml/core` にも依存しません。詳細は [`docs/design/architecture.md`](docs/design/architecture.md) を参照してください。

WASMレンダリングはWebview側(実DOMを持つ)で行い、拡張ホストとは `postMessage` でやり取りします。この設計に至った経緯(拡張ホストのWeb Workerには `window` が無く直接レンダリングできないことが実機検証で判明した経緯)は [`docs/design/step2-vscode-extension-design.md`](docs/design/step2-vscode-extension-design.md) に記録しています。

## 既知の制約(PoCスコープ)

- **ローカル `!include` 非対応**: ブラウザ環境ではファイルシステムを直接読めないため、複数ファイルにまたがる `!include` はサポートしていません。実際に存在しないファイルを `!include` すると、ハングや無反応にはならず、`cannot include <ファイル名>` という赤字のエラーメッセージが図として表示されます(実測結果は [`docs/design/known-gaps-verification.md`](docs/design/known-gaps-verification.md) 参照)。
- **スプライトライブラリ非同梱**: AWS/material/tupadr3等の重いアイコンセットは同梱していません。これらを使う `!include <awslib/...>` 等を書くと、同様にハングせず `Fatal parsing error` という赤字エラーが表示されます。
- **エクスポート・スニペット・多言語対応・マルチページ図は未実装**: 本PoCのスコープは「開いてプレビューが出る」ことに限定しています。
- **ライブ更新なし**: ファイル編集中の自動再レンダリングは行わず、コマンド実行時点の内容を1回レンダリングします。

## ライセンス

MIT. 依存する `@plantuml/core` は v1.2026.6 以降がMIT(それ以前のバージョンはGPL-3.0-or-later)。本リポジトリは `1.2026.6` に固定しています。ライセンス調査の詳細は [`docs/design/spike-report.md`](docs/design/spike-report.md) を参照してください。
