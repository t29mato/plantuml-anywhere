# スパイクレポート: Graphviz非依存でのクラス図レンダリング検証

- 実施日: 2026-08-20
- 対象: `@plantuml/core` v1.2026.6
- 検証コード: `spikes/`(本レポートと合わせて参照)

## 結論(要約)

**成立する見込みが高い。** `@plantuml/core` 1.2026.6 はレイアウトエンジンとして
**Graphviz本体をWASMにコンパイルしたもの(Viz.js系, Graphviz 14.1.1)** を同梱しており、
Graphvizバイナリのインストールなしにクラス図(継承・コンポジション含む)を
ブラウザ相当環境でSVGレンダリングできることを実機(Chromiumヘッドレス)で確認した。
WASMバイナリはファイルとして分離配布されておらず `viz-global.js` 内に
Base64データURIとしてインライン埋め込みされているため、レンダリング時に
追加の外部ファイルfetchは発生しない。ライセンスもv1.2026.6以降でMITに
変わっていることを確認した。

当初の想定(Smetana = GraphvizのJava移植レイアウトエンジン)とは異なり、
実体は「Graphviz本体をWASM化したもの」だった。ただし「バイナリを起動できない
Web Extension環境で子プロセスなしにレイアウト計算が完結する」という
本質的な要件は満たしており、勝ち筋の前提は崩れていない。

## 検証方法

1. Node上での直接実行を最初に試みたが、`viz-global.js` (UMD)が
   `document`/`location` 未定義時に `require("url")` へフォールバックする分岐に入り、
   ESMコンテキスト(`"type": "module"`)では `ReferenceError: require is not defined` で失敗した。
   これはNode特有の分岐であり、`location` が定義されているブラウザ/Web Worker環境
   (VS Code Web ExtensionのWebview/Workerもこれに該当)では発生しない。
2. そのため検証環境をNodeからヘッドレスブラウザ(Playwright + Chromium)に切り替え、
   本番相当の条件で再検証した。
   - `spikes/browser-class.html` を簡易HTTPサーバー(`http-server`, `localhost:8933`)で配信
   - `spikes/playwright-check.mjs` で `chromium.launch()` → ページ読み込み → `renderToString()` の
     成功可否・SVG・発生したネットワークリクエストを記録
   - `spikes/playwright-timed.mjs` / `browser-class-timed.html` で処理段階ごとの所要時間を計測
3. 入力PlantUMLソース(判定基準どおりクラス3つ+継承+コンポジション):

   ```
   @startuml
   class Animal { +name: String \n +makeSound() }
   class Dog { +bark() }
   class Engine { +horsepower: int }
   Animal <|-- Dog
   Dog *-- Engine
   @enduml
   ```

## 判定結果: 合格

- レンダリング成功(`renderToString` が SVG文字列を返した)
- 生成SVG: `spikes/class-diagram.svg`(4,205 bytes)
- 目視確認用スクリーンショット: `spikes/class-diagram.png`

  ![class-diagram](../../spikes/class-diagram.png)

- SVG座標を確認したところ、3クラスのrectが重ならず縦に配置されている:
  - Animal: y = 7〜87
  - Dog: y = 147〜211
  - Engine: y = 271〜335
  (各クラス間に約60ptの余白があり重なりなし)
- リンクは2本とも `path` + `polygon` で描画されている:
  - Animal→Dog: 空白三角ポリゴン(継承 `extension`)
  - Dog→Engine: 黒塗りひし形ポリゴン(コンポジション `composition`)
- スクリーンショットを目視しても図として完全に成立している(ノード重なりなし、矢印・菱形とも正しい向き)。

**pragma指定は不要だった。** `render`/`renderToString` をデフォルト設定のまま呼ぶだけで
Graphviz(WASM版)によるレイアウトが適用された。

## レイアウトエンジンの実体(訂正)

- `viz-global.js` を `A.graphvizVersion` として調べたところ `"14.1.1"` と判明。
  これは **Graphviz本体(実物)をEmscripten/WASMコンパイルしたもの**(Viz.js系)であり、
  SmetanaではないClass。CLAUDE.md記載の「Smetana使用の有無を確認する」というタスクは
  対象が実在しなかったため未実施(HQ指示により当初の検証方針を変更、以後追跡不要とした)。
- `plantuml.js`(6.8MB)はPlantUML本体のロジック(パーサ・モデル構築)をTeaVMで
  **純粋なJavaScript**にコンパイルしたもので、WebAssemblyは使用していない
  (`grep -c "WebAssembly" plantuml.js` → 0件)。
- WASMを使うのはレイアウト計算を担う `viz-global.js` のみ。

## WASMの読み込み方式(CSPへの影響・実装上の要注意点)

- `viz-global.js`(1.4MB)の中に、約1,398,054文字のBase64データURI
  (`data:application/octet-stream;base64,...`)が1個埋め込まれている。
  デコード後は約1.05MBのWASMバイナリになる計算。
- 実際にPlaywrightでネットワークリクエストを記録したところ、発生したのは
  以下の3件のみで、**別ファイルとしての `.wasm` fetchは発生しなかった**:
  ```
  document  http://localhost:8933/browser-class.html
  script    http://localhost:8933/node_modules/@plantuml/core/viz-global.js
  script    http://localhost:8933/node_modules/@plantuml/core/plantuml.js
  ```
- これは、VS Code WebviewのCSP(`connect-src`/`img-src`等での外部オリジン制限)の観点では
  有利に働く。WASMバイナリを別途fetchできる場所に置く必要がなく、
  同梱JSファイル自体をWebview内に読み込めれば完結する。
- **一方で注意が必要な点**: `WebAssembly.instantiate`(コード中は `atob` でデコード後
  `WebAssembly` API を呼んでいると推定)を実行するには、VS Code Webviewの
  デフォルトCSPに `script-src` の `'wasm-unsafe-eval'`(または広めの `'unsafe-eval'`)を
  追加する必要がある可能性が高い。Web Extension実装フェーズで
  Webview生成時の `Content-Security-Policy` メタタグに明示的な許可が必要になる見込み。
  ここはステップ2で実機確認すべき項目としてメモしておく。
- `viz-global.js` 内には `fetch(` 呼び出しが1箇所存在するが、これはBase64データURIでない
  URLが渡された場合のフォールバック分岐であり、今回の検証(パッケージ同梱のまま使用)では
  到達しなかった。

## パフォーマンス計測(ローカルhttp-server、コールドスタート)

`spikes/playwright-timed.mjs` による内訳(1回計測、目安値):

| 区間 | 所要時間 |
|---|---|
| `viz-global.js` の同期読込・実行完了まで | 約376 ms |
| ESM `plantuml.js` のimport完了まで | 約0 ms(即時) |
| `renderToString()` 呼び出し完了(WASM初期化+レイアウト計算) | 約381 ms |
| **合計(スクリプト読込〜SVG完成)** | **約757 ms** |

別途、Playwrightのブラウザプロセス起動を含めたEnd-to-Endでは約1,378 msだった
(こちらはブラウザ起動オーバーヘッドを含むため、Web Extension内での体感時間としては
上表の「約757ms」の方が参考値として近い)。

これはローカル静的ファイルサーバーからの1回限りの計測であり、VS Code Web Extension
(Webview内、拡張機能パッケージからの読み込み)での実測ではない。ステップ2で
実環境での起動時間を再計測する必要がある。

## バンドルサイズとライセンス

### サイズ

- npm tarball(配布サイズ): 10,620,275 bytes(約10.1MB)
- インストール後の実サイズ(`node_modules/@plantuml/core`): 10MB
- 内訳:
  | ファイル | サイズ | 用途 |
  |---|---|---|
  | `plantuml.js` | 6.8MB | PlantUML本体ロジック(TeaVM→JS、WASM不使用) |
  | `viz-global.js` | 1.4MB | Graphviz(WASM、Base64インライン埋め込み) |
  | `emoji.js` | 1.8MB | 絵文字レンダリング(**PoCで必須か要確認、未使用なら除外候補**) |
  | `openiconic.js` | 52KB | アイコンフォント(同上、除外候補) |
  | その他 | 数十KB | デモHTML/CSS/README/LICENSE等(配布物には不要) |

  PoCで実際に必要なのは `plantuml.js` + `viz-global.js` の**合計約8.2MB**のみと推定される
  (`emoji.js`・`openiconic.js`・デモページ類は未検証だが、`render`/`renderToString` の
  呼び出しに必須ではなさそうに見える。ステップ2で実際に外して動くか確認する)。

- VS Code Marketplaceの拡張機能サイズは、実用上は数MB〜数十MB程度に収まっているものが
  多く、10MB前後は極端に大きいわけではないが軽くもない。Web Extension特有の
  「初回ロード時にWebview内へこのJSを読み込む」コストとして、ステップ2で
  実際の起動体感を計測すべき。

### ライセンス

- `@plantuml/core@1.2026.6`: **MIT**(`npm view` で確認)
- `@plantuml/core@1.2026.5`(1つ前): **GPL-3.0-or-later**(README記載の切り替え時期と一致)
- 依存パッケージ: なし(`npm view @plantuml/core@1.2026.6 dependencies` は空)
- `npm install` 時の直接依存は `@plantuml/core` 1件のみで、追加のGPL混入は確認されなかった。
- パッケージ内 `LICENSE` ファイルも同梱されており、MIT表記を確認済み。

## 残る懸念・ステップ2への申し送り事項

1. **WASM実行に必要なCSPディレクティブ(`'wasm-unsafe-eval'` 等)** を
   VS Code WebviewのCSPに追加できるか、実機で確認する必要がある。
2. **`emoji.js`/`openiconic.js` を除外してバンドルサイズを削減できるか**を確認する。
3. 今回の計測はローカル静的サーバー上のNode Playwrightであり、**VS Code Web Extension
   (Webview内、拡張パッケージからの読み込み)での起動時間の実測がまだ**。
   ステップ2で `@vscode/test-web` を使い実測すること。
4. 本検証はクラス図のみ。シーケンス図(Graphviz不要で通って当然)の再確認は不要と判断し実施していない。

## 添付ファイル(`spikes/` 配下)

- `class-diagram.svg` — 生成されたSVG本体
- `class-diagram.png` — 目視確認用スクリーンショット
- `browser-class.html` / `browser-class-timed.html` — ブラウザ実行用テストページ
- `playwright-check.mjs` — レンダリング成否・ネットワークリクエスト記録用スクリプト
- `playwright-timed.mjs` — 処理段階別の所要時間計測スクリプト
- `screenshot.mjs` — SVG→PNGスクリーンショット取得スクリプト
- `test-class.mjs` / `test-class.cjs` — Node直接実行を試みた際の失敗記録(参考用に残置。
  本番相当環境では発生しない `ReferenceError` の原因究明に使った)
- `package.json` — `@plantuml/core@1.2026.6` を固定した検証用プロジェクト
