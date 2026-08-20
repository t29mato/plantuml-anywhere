# アーキテクチャ設計(レイヤー構成と依存方向)

## 目的

このドキュメントは plantuml-web のレイヤー構成と、レイヤー間で許可される依存方向を定義する。
実装はここから逸脱しない。逸脱が必要になった場合は実装を止めて本ドキュメントを更新し、
司令塔の再レビューを受ける。

## 配布ターゲット(2026-08-20 司令塔確認により確定)

当初のPoCスコープ(VS Code Web Extensionのみ)から、以下2系統に拡張することが
司令塔により確認された:

1. **VS Code拡張機能**: Web版(vscode.dev/github.dev等、ブラウザ上で動くVS Code)と
   デスクトップ版VS Codeの**両対応**。`package.json` に `browser` と `main` の両エントリを持つ。
   `.puml` を開くとWebviewにプレビューが出る、という挙動そのものは両ターゲットで共通。
2. **Chrome拡張機能**(単体、VS Code非依存): ローカルの `.puml` ファイルを `file://` で
   直接ブラウザで開いたときに、その場でプレビュー表示する。**この系統は成立可否が
   技術的に未検証**であり、Graphvizスパイクと同様に専用スパイクで確認してから設計する
   (`docs/design/browser-extension-spike-plan.md` 参照、未作成の場合は着手前に作成する)。

この2系統は `domain/` `application/`(純粋ロジック)を共有し、`infrastructure/` 以下と
エントリポイントのみターゲットごとに分ける。詳細は下記「配布ターゲット別のレイヤー構成」参照。

## レイヤー構成(VS Code拡張機能ターゲット)

```
src/
  domain/         ← 最も内側。フレームワーク・vscode API・DOM に一切依存しない
  application/     ← ユースケース。domain のポート(interface)にのみ依存する
  infrastructure/  ← domain/application が定義したポートの実装。vscode API・@plantuml/core に依存してよい
  extension.ts     ← 構成ルート(Composition Root)。activate() でポートの実装を組み立てて
                     application に注入する。VS Code拡張機能(Web版・デスクトップ版共通)の
                     エントリポイント。
```

依存の向きは常に内側へ: `extension.ts → infrastructure → application → domain`。
domain は他のどのレイヤーからも import されない側であり、他のレイヤーを import しない。

`extension.ts` はWeb版・デスクトップ版で**同一のソースファイル**を使う(コード内でNode固有API
を使わないため)。`package.json` の `browser`/`main` はビルド後の異なるバンドル(target:
`webworker` / `node`)を指すが、ビルド設定の話であり、ソースコードのレイヤー構成には影響しない。

## 配布ターゲット別のレイヤー構成(概要)

```
src/
  domain/                    ← 共有。ターゲット非依存の純粋ロジック
  application/                ← 共有。domainのポートのみに依存するユースケース(ShowPreviewUseCase)
  infrastructure/
    rendering/                 ← 共有。@plantuml/core を呼ぶ DiagramRenderPort 実装
                                  (PlantUmlCoreRenderer。vscode APIにもDOMにも依存しない。
                                  ターゲットごとにesbuildで別バンドルされるだけでソースは同一)
    vscode/                     ← VS Code拡張機能ターゲット専用アダプタ(vscode API依存)
    browser-extension/           ← Chrome拡張機能ターゲット専用アダプタ(DOM依存)
  entrypoints/
    vscode-extension.ts         ← VS Code拡張機能の Composition Root(Web版/デスクトップ版共通)
    browser-extension/
      content.ts                 ← Chrome拡張機能 content script の Composition Root
      background.ts               ← 初回インストール時のオンボーディング案内(任意)
```

`domain/` `application/` `infrastructure/rendering/` はどちらのターゲットからも共有される。
ターゲット固有なのは `infrastructure/vscode/` `infrastructure/browser-extension/` と
`entrypoints/` のみ。`DiagramSourceReaderPort.read()` `PreviewPresenterPort` は引数の取り方を
ターゲット非依存に設計してあるため(詳細は各ターゲットの設計ドキュメント参照)、
`application/ShowPreviewUseCase` はコード変更なしで両ターゲットから利用できる。

## Mermaid: レイヤーと依存方向

```mermaid
graph TD
    ext["extension.ts<br/>(Composition Root)"]
    infra["infrastructure/<br/>(vscode adapters, @plantuml/core adapter)"]
    app["application/<br/>(use cases)"]
    dom["domain/<br/>(entities, value objects, ports)"]

    ext --> infra
    ext --> app
    infra --> app
    infra --> dom
    app --> dom

    style dom fill:#F1F1F1,stroke:#181818
```

- `domain` は他のどの矢印の先にもならない(誰にも依存しない)。
- `infrastructure` は `domain` が定義したポート(interface)を実装する形で `domain` に依存する。
  これは「実装が抽象に依存する」通常の依存性逆転であり、依存の向きとしては内側(domain)へ
  向かっている点に注意(infrastructureがdomainの詳細を知っているのではなく、domainが宣言した
  契約をinfrastructureが満たしている)。
- `application` は `infrastructure` の具象クラスを一切importしない。ポート(interface)越しにのみ
  外界とやり取りする。

## 各レイヤーの責務

### domain/

- PlantUMLソース・レンダリング結果を表す値オブジェクト
- 外界とやり取りするためのポート(interface)定義
  - 例: 「ソースをレンダリングする」ポート、「ソースを読み込む」ポート、「結果を提示する」ポート
- vscode / DOM / WASM / fetch など一切のI/O・フレームワークAPIをimportしない
- 純粋なTypeScriptのみで構成し、Node環境・ブラウザ環境どちらでも(あるいはテスト環境でも)
  同じ挙動で動くことを保証する

### application/

- domain のポートを組み合わせたユースケース(1ユースケース = 1クラス/関数)
- 「.pumlファイルを開いたときにプレビューを表示する」という一連の流れを記述する
- domain 以外のレイヤーを直接importしない(infrastructureの具象実装を知らない)

### infrastructure/

- domain/applicationが定義したポートの実装
- vscode API(`vscode.workspace.fs`、`vscode.window.createWebviewPanel` 等)への依存はここに閉じ込める
- `@plantuml/core` への依存(WASMレンダラのラッピング)もここに閉じ込める
- Node の `fs` は使用しない(Web Extensionでは実行不可能なため)。ファイル読み込みは必ず
  `vscode.workspace.fs` 経由。

### extension.ts(Composition Root)

- Web Extensionのエントリポイント。`package.json` の `browser` フィールドが指すファイル。
- `activate(context)` の中で infrastructure の具象クラスを new し、application のユースケースに
  注入し、vscodeのコマンド/イベントに結びつける。
- ロジックを持たない(配線のみ)。

## 依存方向の機械的強制

- TypeScriptプロジェクトのため `dependency-cruiser` をCIに組み込む(実装フェーズで追加)。
- ルール(予定):
  - `domain/` から `application/`・`infrastructure/`・`vscode`・`@plantuml/core` への依存を禁止
  - `application/` から `infrastructure/`・`vscode`・`@plantuml/core` への依存を禁止
  - `infrastructure/` から `extension.ts` への依存を禁止(逆方向のみ許可)
- レイヤー違反はCIで必ず落とす。設定を緩めない。

## PoCフェーズでのテスト方針

- ドメイン層の単体テストカバレッジ目標: PoC段階では対象外(CLAUDE.md記載どおり)。
  ただしユースケース層のふるまい(正常系・レンダリング失敗時の異常系)はTDDで先にテストを書く。
- infrastructure層(vscode依存部分)は `@vscode/test-web` によるブラウザ環境起動確認でカバーする
  (ユニットテストではなく起動確認レベル)。
