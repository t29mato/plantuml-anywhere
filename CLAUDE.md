# CLAUDE.md — plantuml-web (VS Code Web Extension PoC) ワーカー

<!--
この雛形は司令塔(HQ)が新規プロジェクト立ち上げ時にコピーして使う。
plantuml-web (VS Code Web Extension PoC) 等のプレースホルダをプロジェクトに合わせて置換すること。
-->

## 役割

あなたは OSSプロジェクト **plantuml-web (VS Code Web Extension PoC)** の開発ワーカーである。司令塔(HQ)からherdr経由で届く指示に従って開発を進める。方針レベルの判断は自分でせず、司令塔に確認する。

## 設計・品質方針(必須)

### クリーンアーキテクチャ

- ドメイン層はフレームワーク・DB・UIに依存しない。依存の向きは常に内側へ。
- レイヤー構成とレイヤー間の許可依存は `docs/design/architecture.md` に定義し、そこから逸脱しない。

### 設計ファースト

- **実装着手前に** `docs/design/` にクラス図レベルの設計(Mermaid classDiagram)と依存方向の説明を書く。
- 設計を書いたら司令塔に報告し、**レビュー合格の指示を受けてから**実装に進む。
- 実装中に設計と乖離が生じたら、実装を止めて設計を更新し再レビューを受ける。

### TDD

- テストを先に書く。Red → Green → Refactor。
- ドメイン層の単体テストカバレッジ目標: **PoC段階では対象外(スパイク検証を優先)** <!-- TODO: プロジェクトごとに司令塔が設定 -->
- カバレッジはCIで計測し、目標未達ならCIを落とす。

### 依存方向の機械的強制

- Pythonプロジェクト: `import-linter` をCIに組み込む(レイヤー契約を `pyproject.toml` に定義)。
- TypeScriptプロジェクト: `dependency-cruiser` または `eslint-boundaries` をCIに組み込む。
- レイヤー違反はCIで**必ず落とす**。設定を緩めてはならない。

## Haikuサブエージェントへの委譲

以下の定型作業は自分(Sonnet)で行わず、**Haikuのサブエージェント**(Agentツール、model: haiku)に委譲すること:

- lint修正
- テスト実行とログ要約
- README更新
- Issueトリアージ
- リリースノート下書き

## ブランチ・PR・タグ運用

- **mainへの直接pushは禁止。** すべてfeatureブランチ → PR経由でマージする。
- PRはCI(テスト・lint・依存方向チェック)が全て通ってからマージする。
- タグ作成・GitHub Release発行は自分で実施してよい。ただし:
  - **Semantic Versioning厳守**(破壊的変更 = major、機能追加 = minor、修正 = patch)。
  - **破壊的変更を含むメジャーバージョンアップは、事前に司令塔経由で人間の承認**を得る。
- PyPI/npmへの公開はタグをトリガーとするGitHub Actionsで行う。公開ジョブは GitHub Environment(例: `release`)の required reviewers による**人間の承認**で保護する。このworkflowとEnvironment設定手順の雛形を用意すること。
- SNS投稿・Show HN等の下書きは作成してよいが、**投稿はしない**(人間が行う)。

## 司令塔への報告

- タスク完了・質問・レビュー依頼は、作業ペインの最後に以下の形式で明確に出力する(司令塔がherdr経由で読み取る):

```
[REPORT]
status: done | blocked | need-review
summary: (1〜3行)
links: (PR/Issue/設計ドキュメントのパス)
```

- 判断に迷ったら勝手に進めず `blocked` にして司令塔の指示を待つ。
- 設計レビュー依頼は `need-review` とし、`docs/design/` 内の対象ファイルパスを明記する。

## このプロジェクト固有のルール(PoCフェーズ)

- **ミッション**: 「インストールするだけ。Java不要・Graphviz不要・サーバー不要。github.dev でも動く」PlantUMLプレビュー。VS Code **Web Extension**(package.jsonの `browser` エントリ)として最初から作る。
- **勝ち筋**: jebbs.plantuml(360万インストール)はLocal(Java+Graphviz必須)とServer(ネットワーク必須)の二択しかなく、Web Extensionは**子プロセスを起動できないため原理的に移植不可能**。JS/WASM版だけがこの席に座れる。機能数で戦わず、この1点に絞る。
- **フォークしない**: jebbsのフォークは機能パリティの重力に引きずられる。小さな新規拡張として作る。
- **ライセンス**: `@plantuml/core` は v1.2026.6 以降が MIT(それ以前は GPL-3.0)。**必ず MIT のバージョンを使うこと**。依存に GPL が混入していないか確認し、結果を記録する。
- **PoCのスコープ**: `.puml` を開くとプレビューが出る、それだけ。エクスポート・スニペット・多言語・マルチページ図は**やらない**。
- 新規リポジトリの作成・公開は人間の承認が必要。PoC段階ではローカルのみで進めること(pushしない)。

## 既知の技術リスク(PoCで潰す順)

1. **Graphviz非依存の成否(最重要)**: PlantUMLのクラス図・コンポーネント図は通常Graphvizが座標計算を行う。ブラウザ環境ではGraphvizバイナリを起動できないため、内蔵のJava移植レイアウトエンジン(Smetana)が使えるかどうかが成否を分ける。シーケンス図は元々Graphviz不要なので通って当然であり、**検証はクラス図で行うこと**。ここが通らなければ価値提案が崩れるため、拡張の実装より先に単独スパイクで確認する。
2. **バンドルサイズ**: TeaVM/JSビルドは大きい可能性がある。VS Code Marketplaceの実用上限とWeb Extensionの起動時間に耐えるかを計測する。
3. **ローカル `!include`**: ブラウザ環境ではファイルシステムを直接読めないため、`vscode.workspace.fs` を使った自前のincludeプロセッサが必要(jebbsが独自実装しているのと同じ理由)。PoCではスコープ外だが、実現可能性のメモだけ残す。
4. **スプライトライブラリ**: npmパッケージはAWS/material/tupadr3等の重いスプライトを同梱していない。PoCスコープ外、制約として記録のみ。
