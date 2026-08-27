# 構文エラーの行番号表示(VS Code診断)

- 実施日: 2026-08-27〜28
- 経緯: HQから「VS Code側のエラーメッセージ改善(構文エラー位置の表示)」を指示された(全力稼働3本柱の1つ)。

## 調査: PlantUMLは構文エラーをどう返すか

実ブラウザ(Chromium, Playwright)で、様々な壊れたソースを`renderToString`に
直接渡して挙動を確認した。

| 入力 | 結果 |
|---|---|
| `totallyBogusKeyword Foo Bar` | **成功**(`RenderedSvg`)。エラー内容を書き込んだSVG画像が返る |
| `A ->>> B : weird arrow!?`(不正な矢印) | **成功**。同上 |
| `class Foo {`(閉じ括弧なし) | **成功**。同上 |
| `class Foo`(`@enduml`なし) | **失敗**(`RenderError`)。`java.lang.IndexOutOfBoundsException`(行番号なし) |
| 空配列 | **失敗**。同上 |
| `skinparam totallyNotARealParam 123`(存在しないskinparam) | **成功**。エラー扱いにすらならず、単に無視されて通常レンダリング |

**最も重要な発見**: 典型的な構文エラーの大半は、`renderToString`を失敗させない。
PlantUML自身が「エラー内容を書き込んだSVG画像」を生成し、それを**成功として**
返す(`docs/design/known-gaps-verification.md`で確認済みの`!include`失敗時と
同じパターン)。そのSVGの`<text>`要素には、次のような情報が埋め込まれている:

```
[From textarea (line 2) ]

@startuml
totallyBogusKeyword Foo Bar
 Syntax Error? (Assumed diagram type: sequence)
```

**`[From textarea (line N) ]` という形で、1始まりの行番号が含まれている。**
これはこれまで画像の中に埋もれたまま利用者に見過ごされがちだった情報であり、
構造化して取り出せば、VS Codeの診断(Problems パネル・該当行への波線)として
きちんと提示できる。

一方、`RenderError`として失敗する側(EOF系のJavaの生例外)には行番号は一切
含まれない。この2系統は挙動が根本的に異なるため、対応も分けている(後述)。

### 副次的な発見: 複数の`renderToString`呼び出しを並行実行するとハングする

上記の調査中、7種類の壊れたソースを**同一ページ上で並行に**`renderToString`
呼び出しすると、最初の1件を除いて**すべて無期限にハングする**ことを発見した
(1件ずつ順番に呼べば全て1〜2秒で完了する)。これは`@plantuml/core`公式PoCの
コメントにある「エンジンは共有状態を持つため、レンダリングは直列化する必要が
ある」という制約の裏付けであり、既存の危険域として記録しておく。**本番コード
(`PlantUmlCoreRenderer.render()`)は元々1回のレンダリング完了を`await`して
から次を呼ぶ設計になっているため、この問題の影響は受けない。** 将来、複数の
`renderToString`呼び出しを並行実行するような変更(例: 複数タブ/複数プレビュー
の同時レンダリング)を検討する際は、必ずこの制約を踏まえること。

## 実装

### 検出: `src/infrastructure/rendering/syntaxErrorDetection.ts`

`[From textarea \(line (\d+)\)` という正規表現でSVG文字列から行番号を抽出する
純粋関数。DOM・vscodeいずれにも依存せず、単体テストで完結する。

### 行番号の変換: `DiagramSource.originLines` / `originalLineNumber()`

`!include`展開(hq#35の並行タスク、`docs/design/include-directive-support.md`
参照)が行われた場合、PlantUMLに渡す行と元ファイルの行が一致しなくなる。
`DiagramSource`に任意の`originLines`(展開後の行番号→元ファイルの行番号の対応
表)を持たせ、`originalLineNumber(expandedLine)`で変換できるようにした。
展開されていない通常のケースでは`originLines`が`undefined`のままなので、
入力をそのまま返す(恒等変換)。

### 共有ロジック: `PlantUmlCoreRenderer`

1回目の`renderToString`が成功した場合、`detectSyntaxErrorLine(svg)`で検査し、
検出できたら`source.originalLineNumber(...)`で元ファイルの行番号に変換した上で
`RenderedSvg.syntaxErrorLine`に載せる。VS Code版・Chrome拡張版共通のロジック
(`docs/design/architecture.md`のレイヤー構成どおり、`infrastructure/rendering`
は両ターゲットで共有)。

縮小フォールバック(`docs/design/large-diagram-fallback.md`)のリトライ成功パス
には検出を追加していない。「too large」で失敗する図と構文エラー画像は別経路
(構文エラー画像は最初から成功として返るため、too large分岐に入らない)であり、
両方が同時に起きるケースは実用上ないと判断した。

### VS Code版: `WebviewPreviewPresenter` + `vscode.DiagnosticCollection`

`syntaxErrorLine`が設定されている場合、`vscode.Diagnostic`を作り
`DiagnosticCollection.set(uri, [...])`する。これによりProblems パネルへの表示と
該当行への波線が(拡張機能の実装を追加することなく)VS Code標準の仕組みで
提示される。行全体を波線の範囲にしている(何桁目が悪いかまではPlantUMLの出力
から特定できないため)。

`DiagnosticCollection`は拡張全体で1つ共有し(`extension.ts`の`activate()`で
1回だけ生成、`context.subscriptions`で破棄)、`WebviewPreviewPresenter`は
**ファイルごとに1つ生成する**設計に変更した(`VsCodeWorkspaceFsSourceReader`が
既にファイルごとに生成される設計だったのと揃えた)。これにより「どのuriに
診断を出すか」を正しく特定できる。構文エラーが解消されて再レンダリングが
成功した場合は`diagnostics.delete(uri)`で波線を消す。

Webview内にも「⚠ 構文エラーを検出しました(N行目付近)。詳細は Problems パネル、
またはエディタの波線を確認してください。」という控えめな注記を出す(画像内の
小さい文字だけに頼らないようにするため)。

### Chrome/Brave拡張版: `PageDomPresenter`

Problems パネルに相当するものが無いブラウザページでは、代わりにページ上部に
分かりやすい注記(「⚠ 構文エラーを検出しました(N行目付近)。下の図に埋め込まれた
詳細を確認してください。」)を表示する。`!include`展開はVS Code版のみの対応
(後述のドキュメント参照)のため、こちらは常に`originLines`が`undefined`
(恒等変換)で、報告される行番号はそのまま正しい。

## 検証

`test-web/index.ts`に統合テストを追加し、実ブラウザ(`@vscode/test-web`)で
以下を確認した:

1. `test-fixtures/syntax-error.puml`(`totallyBogusKeyword Foo Bar`を2行目に
   持つ)を開いてプレビューを実行
2. `test-preview-outcome.json`に`syntaxErrorLine: 2`が書き込まれることを確認
3. `vscode.languages.getDiagnostics(uri)`で、2行目(0始まりで1)に診断が
   実際に登録されていることを確認

```
[e2e] PASS (syntax-error diagnostics) {"syntaxErrorLine":2}
```

Chrome/Brave拡張版も実バイナリ(Playwright, `--load-extension`)で確認:

```
note: ⚠ 構文エラーを検出しました(2行目付近)。下の図に埋め込まれた詳細を確認してください。
```

`test/infrastructure/rendering/syntaxErrorDetection.test.ts`・
`test/domain/DiagramSource.test.ts`で行番号抽出・変換ロジックを単体テストで
カバーしている。

## 既知の制約

- 行番号は分かるが、桁位置(column)までは分からない。PlantUML自身の出力に
  含まれていないため。
- `java.lang.IndexOutOfBoundsException`のような真の`RenderError`(EOF系)には
  行番号情報が一切無く、今回の対応の対象外。メッセージ自体の改善(生の
  Java例外を隠す等)は`large-diagram-fallback.md`の「too large」ケースで
  既に実施済みのパターンを踏襲できるが、今回のスコープでは未着手。
