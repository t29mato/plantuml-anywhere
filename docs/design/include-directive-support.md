# ローカル`!include`のサポート(VS Code版)

- 実施日: 2026-08-27〜28
- 経緯: HQから「!include等ディレクティブのサポート状況調査と対応可能範囲の実装」を
  指示された(全力稼働3本柱の1つ)。CLAUDE.mdには当初から
  「ブラウザ環境ではファイルシステムを直接読めないため、`vscode.workspace.fs` を
  使った自前のincludeプロセッサが必要。PoCではスコープ外だが、実現可能性のメモ
  だけ残す」と書かれていた既知の制約。今回はこれを実際に実装した。

## 調査: PlantUMLのディレクティブの種類と対応方針

| ディレクティブ | 対応 | 理由 |
|---|---|---|
| `!include path/to/file.puml`(相対パス) | ✅ 対応 | `vscode.workspace.fs`で読める |
| `!include <libname/Something>`(山括弧、標準ライブラリ/スプライト参照) | ❌ 非対応(既存どおりPlantUMLのネイティブ処理に委ねる) | ファイルではなく同梱されていないライブラリへの参照。そもそも同梱していない(CLAUDE.md既知の制約) |
| `!include http(s)://...`(URL) | ❌ 非対応(スコープ外) | ネットワークフェッチは今回のスコープに含めていない。技術的には`fetch()`で可能だが、別の検討が必要なため見送った |
| `!include /absolute/path`(絶対パス) | ❌ 非対応(既知の制約として記録) | 複数ワークスペースフォルダをまたぐ絶対パス解決の標準的な方法が無く、誤った場所を読みにいくリスクの方が大きいと判断 |
| `!include_once` / `!include_many` 等 | ❌ 非対応(スコープ外) | 使用頻度が低く、優先度を下げた |
| `!includesub path!ID`(部分include) | ❌ 非対応(スコープ外) | 複雑度が高く、優先度を下げた |

対応した「相対パスのローカルファイル`!include`」は、実務で最も多く使われる
パターンであり、実際にこれが使えないことがCLAUDE.mdの既知の制約の中でも
最も影響が大きいと判断していた項目である。

## 設計

### レイヤー分離

- `src/infrastructure/rendering/includeDirective.ts`(共有、vscode非依存):
  1行が対象となる`!include`かどうかを判定し、パスを取り出す純粋関数
  `findLocalIncludeDirectives()`。山括弧・URL・アンダースコア付き亜種は
  正規表現で自然に除外する。
- `src/infrastructure/rendering/includeExpansion.ts`(共有、vscode非依存):
  再帰展開のアルゴリズム本体。実際のファイル読み込み・パス解決は
  `IncludeFileResolver`インターフェースに委譲するため、vscode.Uriを一切
  知らない。循環参照はvisitedセット(現在展開中のファイルの集合)で検出し、
  見つけた時点でそれ以上展開せず`!include`行をそのまま残す(PlantUML自身の
  ネイティブな`cannot include`表示に委ねる。既存の
  `docs/design/known-gaps-verification.md`で確認済みの安全な挙動)。
  最大再帰深度(20)も保険として設定している。
- `src/infrastructure/vscode/IncludeResolvingSourceReader.ts`(VS Code専用):
  上記2つを使い、`vscode.Uri`・`vscode.workspace.fs`による実際のパス解決と
  ファイル読み込みを行う薄いアダプタ。既存の`DiagramSourceReaderPort`を
  実装する**デコレータ**として、既存の`VsCodeWorkspaceFsSourceReader`を
  ラップする形にした(単一責任: 「ファイルを読む」と「includeを展開する」を
  分離)。

### 行番号の追跡(構文エラー診断との連携)

`!include`展開によってPlantUMLに渡す行数が変わるため、
`docs/design/syntax-error-diagnostics.md`で実装した構文エラーの行番号検出が
そのままでは元ファイル上の正しい行を指せなくなる。これを解決するため、
展開後の各行について「元々どのトップレベル行に由来するか」を並行して追跡し
(`DiagramSource.originLines`)、構文エラー行が検出された際は
`DiagramSource.originalLineNumber()`で変換する。

含まれるファイル内の行は、簡略化のため**`!include`行そのものの行番号**に
帰着させている(例: `shared.puml`の中の`nested.puml`由来の行でエラーが
起きた場合、トップレベルファイルの`!include`行にVS Codeの波線が出る)。
別ファイルへジャンプする診断は本PoCのスコープ外とした。

## 実機検証

`test-fixtures/include-main.puml` → `test-fixtures/include-sub/shared.puml`
→ `test-fixtures/include-sub/nested.puml` という2段階ネストした実ファイルを
用意し、`@vscode/test-web`の実ブラウザ環境で、実際に`vscode.workspace.fs`
経由で読み込み・再帰展開できることを確認した:

```
[e2e] PASS (include expansion) {"svgLength":3011}
```

生成されたSVGに`Main`・`Shared1`・`Shared2`(それぞれトップレベル・1段目の
include・2段目のincludeが持つクラス名)がすべて含まれていることを確認済み。

単体テスト(`test/infrastructure/rendering/includeDirective.test.ts`・
`includeExpansion.test.ts`)で、山括弧/URL/亜種の除外、単純include、
ネストしたinclude、循環参照の検出、見つからないファイルのフォールバック、
兄弟includeの複数展開をカバーしている(インメモリの偽ファイルシステムで
vscode非依存にテストできる設計にしたため)。

## 対応しなかったもの(既知の制約として記録)

- Chrome/Brave拡張版: 対応していない。content scriptから他の`file://`
  リソースへの`fetch()`は、拡張のfile URLアクセス許可を得ていても
  ブラウザのCORS制約でうまくいかないことが多く、確実性に欠ける
  (このリポジトリの過去の実機検証でもfile URL関連の挙動がブラウザの
  バージョン・設定に左右されることが分かっている)。VS Code版のみの対応と
  し、Chrome拡張版は従来どおり(未同梱ファイルへの`!include`は
  `cannot include`という赤字表示になる、既存の安全なフォールバック)とした。
- 絶対パス(`/`始まり)・URL・標準ライブラリ参照・`!include_once`等の亜種・
  `!includesub`: 上記の対応方針表のとおり、いずれもスコープ外。
