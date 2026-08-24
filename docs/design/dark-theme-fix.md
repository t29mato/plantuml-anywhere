# ダークテーマで依存の線が見えないバグの修正

- 実施日: 2026-08-24
- 経緯: オーナーから「plantumlブラウザ拡張機能、ブラウザがdark themeだと、依存の線が見えません」という報告があった。

## 原因

PlantUMLのSVG出力は、既定では黒線・黒文字/透明背景である。ブラウザの
ダークテーマ設定時、`file://`ページの背景が暗色になる(強制ダークモード、
またはOSレベルの`prefers-color-scheme: dark`とブラウザの自動ダーク化が
組み合わさる)ため、透明背景のSVGをそのまま埋め込むと、黒い線(継承・依存の
矢印)や黒文字が暗い背景に沈んで見えなくなる。

修正前のコード(`PageDomPresenter.showSuccess`)は、SVGを挿入する`container`
要素に一切の背景色を指定しておらず、周囲のページの背景色(この場合は暗色)が
そのまま透けて見えていた。

## 検証(修正前)

実際のBrave Browserバイナリを`--force-dark-mode`付きで起動し、`file://`の
`.puml`ファイルを開いて確認したところ、継承の矢印(`Animal <|-- Dog`)が
ほぼ完全に見えなくなることを実機で確認した(`docs/evidence/dark-theme-before-brave.png`)。

一方、VS Code版(Webview)を`workbench.colorTheme: "Default Dark Modern"`で
確認したところ、**修正前でも問題は再現しなかった**
(`docs/evidence/dark-theme-before-vscode.png`)。これは、VS CodeのWebview
(`webview.html`に渡したHTML)がデフォルトでは通常のブラウザのUAスタイルシート
(背景:白)のまま描画され、拡張機能側が明示的に`--vscode-editor-background`等の
テーマ変数を使わない限り、テーマに合わせて自動的に暗くなるわけではないためと
考えられる。つまり、今回のバグは**Brave/Chrome拡張機能側に固有の問題**
だったことになる。

## 修正方針

1. **プレビューのSVGコンテナに明示的な白背景を敷く**(白のカード+余白+軽い
   角丸)。PlantUMLの図は白背景前提でデザインされているため、ページの
   テーマに関わらず図の下だけ白を保証するのが最も安全であり、図の配色の
   意味も壊さない。
2. 図が`skinparam backgroundColor`で自分の背景色を指定している場合は、
   その色がSVG内部の矩形として描画されるため、コンテナの白は隠れる形で
   自然に尊重される(上書きしない)。
3. VS Code版のWebviewは実機検証の結果、現状は問題が発生していなかったが、
   将来的にテーマ変数を使った背景色指定を追加した場合のリグレッション予防、
   および両ターゲットの一貫性のため、**同じ対策を予防的に適用した**。
4. 「ダークテーマ用にPlantUML自体のダークテーマ(`skinparam` によるダーク
   配色)を適用する」方向は今回は採用しない。図の意味色(継承/実現/依存の
   色分けなど)が変わってしまうため。将来のオプション候補としてのみ記録する。

## 実装

- `src/infrastructure/browser-extension/PageDomPresenter.ts`:
  `showSuccess`でSVGを挿入する`container`に
  `background: #ffffff; display: inline-block; padding: 8px; border-radius: 4px;`
  を設定。
- `src/infrastructure/vscode/WebviewPreviewPresenter.ts`:
  成功時のcontentを`.svg-container`というクラス名のdivでラップし、CSSで
  同様のスタイル(白背景・padding・角丸)を適用。エラー表示(`<pre class="error">`)
  はVS Codeのテーマカラーのまま変更していない(エラーメッセージはSVGではない
  ため、この問題の対象外)。

## 実機検証結果

| 対象 | 条件 | 結果 | 証跡 |
|---|---|---|---|
| Brave拡張 | ダークテーマ、修正前 | ❌ 矢印がほぼ見えない | `docs/evidence/dark-theme-before-brave.png` |
| Brave拡張 | ダークテーマ、修正後 | ✅ 白カードの上に矢印がはっきり見える | `docs/evidence/dark-theme-after-brave.png` |
| Brave拡張 | ライトテーマ、修正後(退行確認) | ✅ 見た目に変化なし、退行なし | `docs/evidence/dark-theme-light-regression-brave.png` |
| VS Code Desktop | ダークテーマ(Default Dark Modern)、修正前 | ✅ 元々問題なし(Webviewのデフォルト背景が白のため) | `docs/evidence/dark-theme-before-vscode.png` |
| VS Code Desktop | ダークテーマ、修正後 | ✅ 白カードの上に矢印がはっきり見える(予防的対応) | `docs/evidence/dark-theme-after-vscode.png` |

全て実際のBrave Browserバイナリ・VS Code Desktopバイナリを使い、
Playwright(Brave: `--load-extension`、VS Code: `--remote-debugging-port`
経由のCDP接続)で操作・撮影した、合成のない実物のスクリーンショットである。

## 既知のテスト方針

`PageDomPresenter`・`WebviewPreviewPresenter`はいずれもDOM/Webview APIに
依存するため、既存の方針(`docs/design/spike-report.md`参照)どおり単体
テストの対象外とし、実ブラウザでの検証に委ねている。
