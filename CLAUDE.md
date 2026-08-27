# CLAUDE.md — plantuml-anywhere

このドキュメントは、このリポジトリで開発する際の設計・品質方針とプロジェクト固有のルールをまとめたものです。コントリビュータ・自動化エージェントを問わず、このリポジトリで作業する際は以下に従ってください。

## プロジェクトの目的

「インストールするだけ。Java不要・Graphviz不要・サーバー不要。github.dev でも動く」PlantUMLプレビューを提供する、VS Code **Web Extension**(`package.json` の `browser` エントリ)。

- **狙い**: 既存最大手の `jebbs.plantuml`(360万インストール)は Local(Java+Graphviz必須)と Server(ネットワーク必須)の二択しかなく、Web Extension は**子プロセスを起動できないため原理的に移植不可能**。JS/WASM版のPlantUMLエンジンだけがこの席に座れる。機能数で戦わず、この1点に絞る。
- **フォークではない**: `jebbs.plantuml` のフォークは機能パリティの重力に引きずられるため、小さな新規拡張として作る。
- **ライセンス**: 依存する `@plantuml/core` は v1.2026.6 以降が MIT(それ以前は GPL-3.0)。**必ず MIT のバージョンを使うこと**。依存にGPLが混入していないか確認し、結果を記録する。
- **PoCのスコープ**: `.puml` を開くとプレビューが出る、それだけ。エクスポート・スニペット・多言語・マルチページ図は**やらない**。
- リポジトリの公開範囲変更(private→public)やMarketplace公開は人間の承認が必要。勝手に実行しない。

## 設計・品質方針(必須)

### クリーンアーキテクチャ

- ドメイン層はフレームワーク・DB・UIに依存しない。依存の向きは常に内側へ。
- レイヤー構成とレイヤー間の許可依存は `docs/design/architecture.md` に定義し、そこから逸脱しない。

### 設計ファースト

- **実装着手前に** `docs/design/` にクラス図レベルの設計(Mermaid classDiagram)と依存方向の説明を書く。
- 設計はPRでレビューを受けてから実装に進む。
- 実装中に設計と乖離が生じたら、実装を止めて設計を更新し再レビューを受ける。

### TDD

- テストを先に書く。Red → Green → Refactor。
- ドメイン層の単体テストカバレッジ目標: **PoC段階では対象外(スパイク検証を優先)**
- カバレッジはCIで計測し、目標未達ならCIを落とす。

### 依存方向の機械的強制

- TypeScriptプロジェクトのため `dependency-cruiser` または `eslint-boundaries` をCIに組み込む。
- レイヤー違反はCIで**必ず落とす**。設定を緩めてはならない。

## 定型作業の自動化への委譲

以下の定型作業は、可能であれば軽量なサブエージェント/自動化タスクに委譲することを推奨します(コアの設計判断・実装は人間またはメインの開発者が行う):

- lint修正
- テスト実行とログ要約
- README更新
- Issueトリアージ
- リリースノート下書き

## ブランチ・PR・タグ運用

- **mainへの直接pushは禁止。** すべてfeatureブランチ → PR経由でマージする(リポジトリ初期化時の最初のコミットのみ例外)。
- PRはCI(テスト・lint・依存方向チェック)が全て通ってからマージする。
- タグ作成・GitHub Release発行を行う場合:
  - **Semantic Versioning厳守**(破壊的変更 = major、機能追加 = minor、修正 = patch)。
  - **破壊的変更を含むメジャーバージョンアップは、事前に人間の承認**を得る。
- PyPI/npmへの公開はタグをトリガーとするGitHub Actionsで行う。公開ジョブは GitHub Environment(例: `release`)の required reviewers による**人間の承認**で保護する。このworkflowとEnvironment設定手順の雛形を用意すること。
- SNS投稿・Show HN等の下書きは作成してよいが、**投稿は人間が行う**。

## 進捗の伝え方

- タスクの完了・質問・レビュー依頼は、GitHub Issue/PRのコメントで明確に伝える。
- 判断に迷ったら勝手に進めず、Issueにコメントして人間の判断を待つ。
- 設計レビューが必要な場合は、対象の `docs/design/` 配下のファイルパスを明記してPRまたはIssueコメントで依頼する。

## 既知の技術リスク(PoCで潰す順)

1. **Graphviz非依存の成否(最重要・スパイクで解消済み)**: PlantUMLのクラス図・コンポーネント図は通常Graphvizが座標計算を行う。ブラウザ環境ではGraphvizバイナリを起動できないため、レイアウト計算をどう賄うかが成否を分ける。検証の結果、`@plantuml/core`(v1.2026.6以降)はGraphviz本体をWASMにコンパイルしたレイアウトエンジンを同梱しており、バイナリ起動なしでクラス図を含むレンダリングが可能なことを確認済み(`docs/design/spike-report.md` 参照)。シーケンス図は元々Graphviz不要なので通って当然であり、判定は必ずクラス図で行うこと。
2. **バンドルサイズ**: `@plantuml/core` は約10MB(TeaVM/WASMビルドを含む)。VS Code Marketplaceの実用上限とWeb Extensionの起動時間に耐えるかを計測する。
3. **Webview の CSP と WASM 読み込み**: WASM実行(`WebAssembly.instantiate`)にはWebviewのCSPで `wasm-unsafe-eval` 等の追加許可が必要になる可能性がある。レンダリングを拡張ホスト側で行うかWebview内で行うかを設計判断し、理由を `docs/design/` に記録すること(`docs/design/step2-vscode-extension-design.md` 参照)。
4. **ローカル `!include`**: ブラウザ環境ではファイルシステムを直接読めないため、`vscode.workspace.fs` を使った自前のincludeプロセッサが必要(`jebbs.plantuml` が独自実装しているのと同じ理由)。**VS Code版は実装済み**(相対パスのローカルファイルのみ。`docs/design/include-directive-support.md` 参照)。Chrome/Brave拡張版は`file://`間の`fetch()`の確実性に欠けるため未対応のまま(同ドキュメント参照)。
5. **スプライトライブラリ**: npmパッケージはAWS/material/tupadr3等の重いスプライトを同梱していない。PoCスコープ外、制約として記録のみ。

## 関連ドキュメント

- `docs/design/architecture.md` — レイヤー構成と依存方向
- `docs/design/spike-report.md` — Graphviz非依存レンダリングのスパイク検証結果
- `docs/design/step2-vscode-extension-design.md` — VS Code拡張機能(Web版/デスクトップ版)の設計
- `docs/design/browser-extension-design.md` / `browser-extension-spike-report.md` — 単体Chrome拡張機能(別スコープの成果物)の設計・検証結果
