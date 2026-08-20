# 試してみる (TRYING IT)

このドキュメントは、この拡張機能を**あなたの手元で今すぐ試す**ための手順です。
デスクトップ版VS Codeとブラウザ版VS Codeの2通りを説明します。

## 事前準備(共通)

```sh
git clone https://github.com/t29mato/plantuml-web.git
cd plantuml-web
npm install
```

---

## A. デスクトップ版VS Codeで試す

### 1. `.vsix` を用意する

このリポジトリには、すぐ試せるように `.vsix` ファイル(`plantuml-web-0.1.0.vsix`)を
同梱しています。**ビルドせずそのまま次のステップに進んで構いません。**

自分でビルドし直したい場合は:

```sh
npm run package
```

### 2. インストールする

```sh
code --install-extension plantuml-web-0.1.0.vsix
```

### 3. `.puml` ファイルを開く

サンプルファイルが `test-fixtures/sample.puml` にあります。

```sh
code test-fixtures/sample.puml
```

### 4. プレビューを表示する

コマンドパレット(`Cmd+Shift+P` / `Ctrl+Shift+P`)を開き、`PlantUML: Preview` を実行してください。
右側にWebviewが開き、クラス図が表示されます。

> **補足**: VS Codeを起動した直後(拡張機能がまだ有効化される前)に `.puml` を開いた場合、
> 自動プレビューが発火しないことがあります(拡張の有効化タイミングによる既知の挙動。
> 詳細は `docs/design/step2-vscode-extension-design.md` 参照)。**確実に試すには、
> 上記のとおりコマンドパレットから `PlantUML: Preview` を明示的に実行してください。**

### アンインストールする場合

```sh
code --uninstall-extension plantuml-web-poc.plantuml-web
```

---

## B. ブラウザ版VS Code(vscode.dev / github.dev相当)をローカルで試す

VS Code Web Extensionはローカルの `.vsix` を直接読み込む(sideloadする)ことができない
仕組みのため、実際の github.dev / vscode.dev で試すには一度Marketplaceへの公開が必要です
(現時点では未公開)。ただし、**同じ「ブラウザ版VS Code」の挙動をローカルで再現して試す**
ことができます。

```sh
npm run try:web
```

実行するとブラウザが自動的に開き、`test-fixtures` フォルダを開いた状態のVS Code Web
(ブラウザ版)が起動します。エクスプローラーから `sample.puml` を開き、コマンドパレット
(`Cmd+Shift+P` / `Ctrl+Shift+P`)から `PlantUML: Preview` を実行してください。

---

## うまく動かないとき

- 既知の制約(ローカル `!include` 非対応、スプライトライブラリ非同梱等)は
  [README](README.md#既知の制約poc限定) を参照してください。
- ブラウザ版でワークベンチの見た目が崩れる(CSSが読み込まれない)場合があります。
  これは `@vscode/test-web` のESMモードに関する既知の環境依存の事象で、拡張機能自体の
  不具合ではありません。詳細は
  [`docs/design/step2-vscode-extension-design.md`](docs/design/step2-vscode-extension-design.md)
  を参照してください。
- その他の検証結果・既知の落とし穴は
  [`docs/design/vsix-install-verification.md`](docs/design/vsix-install-verification.md)
  にまとまっています。
