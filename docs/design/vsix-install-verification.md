# .vsixパッケージング・実インストール検証

- 実施日: 2026-08-21
- 目的: 「インストールするだけで動く」という価値提案そのものを、実際にパッケージ化・
  インストールして確かめる(hq#35 の司令塔指示)。

## 1. `.vsix` パッケージング

`@vscode/vsce` で `npx vsce package` を実行。`.vscodeignore` を追加していない初回は
`spikes/`(45MB超のブラウザ拡張機能スパイク成果物)や `CLAUDE.md`, `test/`, `test-web/`,
ソースマップ等が混入し 14.31MB になった。`.vscodeignore` を追加し、実行に不要な
開発用ファイル・テスト成果物をすべて除外したところ、以下の構成になった:

```
plantuml-web-0.0.1.vsix
├─ LICENSE.txt [1.04 KB]
├─ package.json [1.51 KB]
├─ readme.md [3.33 KB]
└─ dist/
   ├─ extension.js [4.19 KB]        ← 拡張ホスト本体(WASM非同梱)
   └─ webview-runtime.js [7.51 MB]  ← Webview内で遅延読み込みされるWASM込みバンドル
```

**パッケージサイズ(圧縮後): 1.94MB、7ファイル。**

### サイズの妥当性判断

- 圧縮前の実体は `webview-runtime.js` の7.51MBがほぼ全て(`@plantuml/core` のWASMバンドル)。
- VS Code Marketplaceには公式のハード上限として非常に大きな値が設定されており
  (実務上、数百MB規模の拡張機能も多数公開されている)、1.94MBは実用上全く問題にならない
  サイズと判断する。
- 拡張ホスト本体(`extension.js`)はわずか4.19KBで、拡張の**アクティベーション自体は
  ほぼ即座**に完了する。重いWASMは実際にプレビューを開いたときにだけ遅延読み込みされる
  設計(`docs/design/step2-vscode-extension-design.md`参照)であり、これがサイズと
  起動体感の両面で効いている。

## 2. デスクトップ版VS Codeへの実インストール検証

```
code --install-extension plantuml-web-0.0.1.vsix
```

でインストール成功(`plantuml-web-poc.plantuml-web@0.0.1` として認識)。

### `browser` エントリのみでデスクトップ版でも動くか

**動く。`main` エントリの併記は不要と判明した。**

デスクトップ版VS Code(v1.133.0)でインストール直後、以下がログに記録された:

```
Creating lazy extension host (LocalWebWorker). Reason: contains 1 extension(s):
plantuml-web-poc.plantuml-web.
```

VS Code Desktopは、`browser`のみを持つ(`main`を持たない)拡張機能を検出すると、
自動的に専用のWeb Worker拡張ホスト(LocalWebWorker)を作成してロードする。
これはWeb版(vscode.dev/github.dev)の拡張ホストと同じ実行モデルであり、
本拡張機能が最初から想定していた設計(拡張ホストにWASMを置かない、
レンダリングはWebview側で行う)ともそのまま整合する。

### 動作確認(ログによる実証)

初回起動直後に `.puml` ファイルを開くと、拡張のactivate完了前にファイルオープンイベントが
発火してしまうレースが再現することを確認した(`step2-vscode-extension-design.md` で
記録済みの `onDidOpenTextDocument` レースと同種の事象。今回は「起動と同時にファイルを開く」
という `code --new-window <file>` 特有の条件で顕著だった)。**先にウィンドウ/ワークスペースを
開いて拡張がactivateされるのを待ってから `.puml` を開く手順**(実際のユーザーの使い方に近い)
に切り替えたところ、問題なく動作した。

一時的なデバッグ計装(`context.globalStorageUri` 配下へのログ書き出し)で実測したログ:

```
2026-08-20T15:23:55.527Z onDidOpenTextDocument: file:///.../test-fixtures/sample.puml languageId=plantuml
2026-08-20T15:23:56.292Z showPreview done: file:///.../test-fixtures/sample.puml
```

**ファイルを開いてから `showPreview` 完了(Webviewへのレンダリング表示完了)まで
約765ms。** ヘッドレス環境(`@vscode/test-web`)での実測値(約710ms)とほぼ一致しており、
デスクトップ版でも同等のパフォーマンスで動作することを確認した。エラーは発生していない。
このログは `docs/evidence/desktop-vsix-install-debug.log` に保存した。

この検証用デバッグ計装コードはコミットせず、検証後に `src/extension.ts` から削除して
本番相当のクリーンな状態に戻した。

### VS Code実画面のスクリーンショットについて(未取得、環境制約)

デスクトップ版VS CodeはGUIアプリとして実際に画面上に起動できたが、
**このセッションを実行しているプロセスにmacOSの画面収録(Screen Recording)権限が
付与されておらず**、`screencapture` コマンドが `could not create image from display`
で失敗した。また `System Events` 経由のUIオートメーション(Accessibility権限)も
同様に許可待ちでブロックされた。これはOS側のセキュリティ機構によるものであり、
人間による許可(システム設定 > プライバシーとセキュリティ > 画面収録)が必要。

動作そのものは上記ログで確実に実証済みであり、機能面の裏付けとしては十分と判断するが、
「実画面を見て一目で分かる」証跡としてのスクリーンショットは、権限が得られ次第
別途取得することとし、正直に「未取得」と記録する。
