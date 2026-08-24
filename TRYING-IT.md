# 試してみる (TRYING IT)

このドキュメントは、この拡張機能を**あなたの手元で今すぐ試す**ための手順です。
デスクトップ版VS Codeとブラウザ版VS Codeの2通りを説明します。

## 事前準備(共通)

```sh
git clone https://github.com/t29mato/plantuml-anywhere.git
cd plantuml-anywhere
npm install
```

---

## A. デスクトップ版VS Codeで試す

### 1. `.vsix` を用意する

このリポジトリには、すぐ試せるように `.vsix` ファイル(`plantuml-anywhere-0.2.0.vsix`)を
同梱しています。**ビルドせずそのまま次のステップに進んで構いません。**

自分でビルドし直したい場合は:

```sh
npm run package
```

### 2. インストールする

```sh
code --install-extension plantuml-anywhere-0.2.0.vsix
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
code --uninstall-extension plantuml-anywhere-poc.plantuml-anywhere
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

## C. Chrome / Brave 拡張機能で試す

ローカルの `.puml` / `.plantuml` ファイルを `file://` で直接開いたときに、その場で
プレビューする単体のブラウザ拡張機能です(VS Code不要)。Chrome Web Storeには公開して
いないため、「パッケージ化されていない拡張機能」として手動で読み込みます。

### 1. 拡張機能を用意する

このリポジトリの [Releases](https://github.com/t29mato/plantuml-anywhere/releases) から
`plantuml-anywhere-browser-extension-<version>.zip` をダウンロードし、任意の場所に**解凍**
してください(zipファイルのままでは読み込めません)。

privateリポジトリのため、他マシンからは `gh` (GitHub CLI) で認証済みの状態で取得できます:

```sh
gh release download --repo t29mato/plantuml-anywhere --pattern "plantuml-anywhere-browser-extension-*.zip"
unzip plantuml-anywhere-browser-extension-*.zip -d plantuml-anywhere-browser-extension
```

自分でビルドする場合:

```sh
npm run package:browser-extension
```
(`plantuml-anywhere-browser-extension-<version>.zip` がリポジトリ直下に生成されます。
拡張機能フォルダそのものは `browser-extension/` です)

### 2. ブラウザに読み込む

1. `chrome://extensions`(Braveの場合は `brave://extensions`)を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリックし、解凍したフォルダ
   (または `browser-extension/` フォルダ)を選択する

### 3. **重要: ファイルのURLへのアクセスを許可する**

初回インストール時、案内ページが自動的に開きます。**この手順を飛ばすとプレビューが
一切表示されません**(ブラウザの仕様上、拡張機能はデフォルトで `file://` ページに
アクセスできないため、手動で許可する必要があります):

1. `chrome://extensions`(または `brave://extensions`)を開く
2. この拡張機能(PlantUML Anywhere)の「詳細」を開く
3. 「ファイルのURLへのアクセスを許可する」のトグルをONにする

### 4. `.puml` ファイルを開く

`test-fixtures/sample.puml` をブラウザにドラッグ&ドロップするか、`Ctrl/Cmd+O` で開いて
ください。その場でクラス図がプレビュー表示されます。

> **無関係なファイルは重くならない**: この拡張機能は `.puml`/`.plantuml` 以外の
> ローカルファイル(HTML・PDF・画像等)には一切介入しません
> (`docs/design/browser-extension-v2-lazy-loading.md` 参照)。

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
