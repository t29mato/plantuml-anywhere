# Marketplace公開チェックリスト(人間が実施すること・実行禁止)

> **このドキュメントは手順の記録のみを目的とする。ここに書かれた操作は
> 一切実行していない。実行するのは人間(オーナー)であり、承認と実施の両方を
> 人間が行うこと。** (CLAUDE.md「リポジトリの公開範囲変更(private→public)や
> Marketplace公開は人間の承認が必要。勝手に実行しない。」に基づく)

## 前提: 公開までに済ませておくべき技術的な準備(自動化ワーカー側で完了済み)

- [x] `.vsix` パッケージング・実インストール検証(`docs/design/vsix-install-verification.md`)
- [x] `package.json` メタデータ整備(displayName, description, categories, keywords,
      icon, repository, license)
- [x] README をMarketplace掲載ページとして読める構成に整備
- [x] 既知の制約の実測・明記(`docs/design/known-gaps-verification.md`)

## 人間が行う手順(未実施・このチェックリストどおりに進める)

### 1. リポジトリの公開範囲変更

- [ ] `t29mato/plantuml-anywhere` リポジトリを private → public に変更するか判断する
      (Marketplace公開にリポジトリのpublic化は必須ではないが、README内の画像リンク
      ([`docs/evidence/readme-hero-vscode-preview.png`](../evidence/readme-hero-vscode-preview.png)・
      [`docs/brand/icon-256.png`](../brand/icon-256.png) 等)がGitHub経由で
      正しく表示されるためにはpublicである必要がある)

### 2. Azure DevOps Personal Access Token (PAT) の取得

- [ ] [Azure DevOps](https://dev.azure.com/) にサインインする(Microsoftアカウント)
- [ ] Organization設定 → Personal Access Tokens → New Token
  - Name: 任意(例: `vsce-publish-plantuml-anywhere`)
  - Organization: `All accessible organizations`
  - Scopes: `Marketplace` → `Manage`
- [ ] 発行されたPATを安全な場所に保存する(再表示不可のため)

### 3. VS Code Marketplace Publisherの作成

- [ ] [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) にアクセス
- [ ] Publisher ID を作成する。**`package.json` の `publisher` フィールド
      (`plantuml-anywhere-poc`)と一致させる必要がある**。既にこの名前で作成済みでない場合、
      `plantuml-anywhere-poc` が空いているか確認し、空いていなければ `package.json` の
      `publisher` を実際に取得したIDに合わせて変更すること
- [ ] Publisher名・説明・アイコン等のプロフィールを整える(任意)

### 4. ローカルでのログイン確認

```sh
npx vsce login <publisher-id>
# PATの入力を求められる
```

### 5. `vsce publish` の実行(このコマンドは絶対にワーカー側で実行しない)

```sh
npx vsce publish
# または特定バージョンを明示する場合
npx vsce publish 0.1.0
```

- [ ] 実行前に、`package.json` の `version` がSemantic Versioningに沿っているか確認
      (CLAUDE.md「Semantic Versioning厳守」)
- [ ] 実行前に、`private: true` を `package.json` から外す必要がある
      (vsceは `private: true` のパッケージを公開できない仕様のため。これは
      **人間が公開作業の一環として明示的に外すこと**。ワーカー側では
      「うっかり公開できてしまう」事故を避けるため `private: true` を維持している)

### 6. 公開後の確認

- [ ] Marketplaceページ([https://marketplace.visualstudio.com/items?itemName=<publisher>.plantuml-anywhere](https://marketplace.visualstudio.com/items)) が正しく表示されるか確認
- [ ] README内の画像(`docs/evidence/readme-hero-vscode-preview.png`・`docs/brand/icon-256.png`)が正しく表示されるか確認
- [ ] 実際に `code --install-extension <publisher>.plantuml-anywhere` でインストールし、動作確認する
- [ ] **github.dev / vscode.dev 上で実際に拡張機能をインストールし、`.puml` を開いてプレビューが表示されるか確認する。**
      sideloadができないため、これがWeb Extensionとしての最初の実機確認になる
      (「Web Extensionとして構成しているので動く設計」と「実際にgithub.devで確認した」は
      異なるため。README「Status」セクション参照)。確認できたらREADMEのStatusセクションを更新する。

## Publisher差し替えについて(補足・再確認)

上記「3. VS Code Marketplace Publisherの作成」のとおり、現在の `package.json` の
`publisher: "plantuml-anywhere-poc"` は実在しないプレースホルダーである。実際のPublisher作成は
人間(オーナー)の作業であり、ワーカー側では作成しない。**Publisher作成後、
そのIDと `package.json` の `publisher` フィールドが一致していることを公開前に必ず確認し、
一致しない場合はここで `publisher` フィールドを実際に取得したIDへ差し替えること。**

## 参考: CLAUDE.mdの関連ルール(再掲)

- リポジトリの公開範囲変更(private→public)やMarketplace公開は人間の承認が必要。勝手に実行しない。
- Semantic Versioning厳守(破壊的変更 = major、機能追加 = minor、修正 = patch)。
- 破壊的変更を含むメジャーバージョンアップは、事前に人間の承認を得る。
