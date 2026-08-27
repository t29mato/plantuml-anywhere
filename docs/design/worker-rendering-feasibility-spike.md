# スパイク: 大型図の`renderToString`同期ブロック対策(Web Worker化)

- 実施日: 2026-08-27〜28
- 経緯: HQから「大型図のrenderToString同期ブロック対策(Web Worker化の実現可能性
  スパイク)」を指示された(全力稼働3本柱の1つ)。既存の対策
  (`docs/design/large-diagram-fallback.md`)は「処理中である旨を先に表示する」
  という緩和策に留まっており、根本原因(メインスレッドが実際にブロックされる
  こと)は解消されていなかった。今回はこれをWeb Workerで解決できるかを検証した。

## これまでの結論との違い

`docs/design/step2-vscode-extension-design.md`では、VS Code拡張ホスト
(Web Worker)で`@plantuml/core`を直接呼んだところ
`ReferenceError: window is not defined`で失敗し、「レンダリングは実DOMを持つ
Webview側で行う」設計に倒した経緯がある。今回のスパイクは、**この失敗を
再現した上で、最小限のDOMシムを足すことでどこまで動くようになるかを
実際に手を動かして検証した**、という点がこれまでと異なる。

## 検証方法

素の(VS Code非依存の)`new Worker()`に`@plantuml/core`のバンドルを読み込ませ、
発生するエラーを1つずつ潰しながら、どこまで実際のレンダリングに近づけるかを
実機(Playwright, 実Chromium)で確認した。

### ステップ1: 素のWorkerでは`window is not defined`(既知の結果を再現)

```
java.lang.RuntimeException: (JavaScript) ReferenceError: window is not defined
```

### ステップ2: `self.window = self` を足すと `document is not defined`

Workerの`self`自体を`window`として渡すのは無害(`@plantuml/core`は
`typeof window`の分岐にしか使っていない)。次に`document`が必要になった。

### ステップ3: 最小限の`document`スタブ(createElement/createElementNS/
   getElementById等をダミーのオブジェクトとして実装)を足すと
   `window._measureCanvas.getContext is not a function`

**重要な発見**: `@plantuml/core`はテキスト幅計測に**`<canvas>`要素の
2D コンテキスト(`measureText`)を使っている**。これはDOM全体を必要とする
話ではなく、局所的な計測手段だった。

### ステップ4: `document.createElement('canvas')`が呼ばれたときだけ本物の
   `OffscreenCanvas`を返すようにすると `XMLSerializer is not defined`

**核心的な発見**: **`OffscreenCanvas`はWorker内でネイティブに使え、
`getContext('2d').measureText()`は実ブラウザと同じ本物のテキスト計測を行う。**
これにより、レイアウト計算に必要な実測値をWorker内で正確に得られる。

最後に、生成したSVG DOM(スタブ要素のツリー)を文字列化する
`XMLSerializer.serializeToString()`が必要になった。これは自作の
シリアライザ(スタブ要素の`tagName`/属性/子要素/テキストを再帰的にXML文字列へ
組み立てるだけ)で代替できた。

### ステップ5: 成功

上記の外部依存(`document`の主要メソッド・`XMLSerializer`)をスタブ実装した
ところ、**エラーなくSVGが生成された。**

## 検証結果

| 項目 | 結果 |
|---|---|
| シンプルな図(2クラス+矢印)が正常にSVG生成できるか | ✅ 成功。**通常経路(実DOM)と完全に同一バイト列のSVGが得られた** |
| クラス図(Animal/Dog/Engine、属性・メソッド付き) | ✅ 成功するが、通常経路とサイズが微妙に異なる(4205バイト→4137〜4212バイト、後述) |
| シーケンス図 | ✅ 成功するが、同様に高さが微妙に異なる(230→248、後述) |
| 巨大図(`test-fixtures/huge.puml`、6449x1732)での「too large」検出 | ✅ **通常経路と同じ`java.lang.RuntimeException: Diagram too large for browser rendering: 6449x1732 (max 4096)`が得られた**。既存の縮小フォールバック(`large-diagram-fallback.md`)のロジックはWorker経由でもそのまま使えることを確認 |
| **メインスレッドが実際にブロックされないか(今回の本題)** | ✅ **実証済み**。下記参照 |

### メインスレッド非ブロッキングの実証

上記の巨大図(4.6秒かかる)をWorkerでレンダリングしている間、メインスレッド側で
50ms間隔の`setInterval`を回し続け、実際に50ms間隔どおり(4.5秒間で約90回)
刻み続けることを確認した:

```
tick samples: t=11ms(0回) → t=515ms(10回) → t=1020ms(20回) → ... → t=4548ms(91回)
worker result: "too large" エラーを4572msで返す
```

**この間、メインスレッドの刻みは一切乱れなかった。** これは現在の本番実装
(Webview内で同期的に`renderToString`を呼ぶ)では絶対に得られない結果であり、
`docs/design/large-diagram-fallback.md`で導入した「レンダリング中…」の
プレースホルダー表示という**緩和策**を、Worker化によって**根本的に解消**
できる可能性を強く示している。

### 副次的なメリット: ハングからの回復可能性

`docs/design/syntax-error-diagnostics.md`で記録した「`renderToString`を
並行実行するとハングする」問題についても、Worker化には利点がある。
メインスレッドで直接ハングした場合は復旧手段が無い(ページ全体のリロードが
必要)のに対し、Worker内でハングした場合は`worker.terminate()`で
強制終了・再生成でき、利用者への影響を「フリーズ」から「タイムアウトして
親切なエラーメッセージ」に格下げできる可能性がある(未検証、follow-upの
候補)。

## 未解決の精度差(本番移行前に詰める必要がある点)

クラス図・シーケンス図で、通常経路と数%程度サイズが異なる結果になった
(例: シーケンス図の高さが230→248)。原因を切り分けたところ、
**`Element.getBBox()`の代替実装の精度不足**であることが分かった。

- 単純な図(高さ・幅の計算にcanvas計測だけで済むもの)は完全一致した
- クラス図の属性行などは、SVG `<text>` 要素の`getBBox()`を直接呼んでいる
  箇所があり、そこを固定値のダミー実装にすると数十バイトのズレが生じた
- `getBBox()`をcanvas計測ベースの実装に置き換えて再挑戦したが、
  今度は逆に元よりズレが増えた(Worker内の`OffscreenCanvas`が使う
  フォントスタックが、メインスレッドの実DOM環境と完全には一致していない
  可能性が高い)

**結論: 「動く」ことと「ピクセル単位で一致する」ことの間にはまだ差があり、
本番投入前にはこのフォント計測の精度を、実際のブラウザ環境(VS Code Webview・
Chrome拡張のcontent script)ごとに詰める作業が必要。**

## 総合結論と推奨

**Web Worker化は技術的に実現可能である。** 単なる「動くか動かないか」の
二択ではなく、実際に動くコードで実証できた。特に「メインスレッドを
ブロックしない」という本来の目的については、疑いの余地なく実証済み。

一方で、以下の理由から、**今回のスパイクの範囲では本番実装への切り替えは
行わず、feasibility spikeとして留める**判断をした:

1. レイアウト精度(フォント計測)をチューニングする作業が残っている
2. `@plantuml/core`が対応する図の種類(アクティビティ図・状態遷移図・
   タイミング図等)はまだ検証していない。クラス図・シーケンス図以外でも
   同じDOMシムで動くかは未確認
3. このレンダリングパイプラインはVS Code版・Chrome拡張版で共有されている
   共通infrastructureであり(`docs/design/architecture.md`)、影響範囲が
   大きい。今回の3本柱の他2つ(構文エラー診断・`!include`対応)のように
   1回のセッションで安全に検証しきれる規模ではなく、専用のPR・レビュー
   サイクルに値する

## 実装の見取り図(follow-up用)

再現に使ったコードの要点(スパイクコードそのものはリポジトリに含めていない。
一時ディレクトリで検証し、再現手順として本ドキュメントに残す):

1. Worker内で `self.window = self`
2. `document.createElement` / `createElementNS` / `getElementById` を、
   `tagName`・属性オブジェクト・子要素配列・`textContent`を持つ単純な
   スタブオブジェクトを返す実装に差し替える
3. `document.createElement('canvas')` の呼び出しだけは特別扱いし、
   本物の `new OffscreenCanvas(w, h)` を返す(`getContext('2d').measureText()`
   が本物のテキスト計測を提供してくれる)
4. `XMLSerializer` を自作し、スタブ要素ツリーを再帰的にXML文字列化する
5. `getBBox()` の精度を上げるには、要素の蓄積テキスト内容と
   `font-size`/`font-family` 属性からcanvas計測する実装に寄せる
   (今回試したが、フォントスタックの差により完全一致には至らなかった。
   要追加チューニング)

本番実装するとしたら、`src/infrastructure/rendering/` に
`WorkerPlantUmlCoreRenderer`(仮)のような新しい`DiagramRenderPort`実装を
追加し、`WebviewMessageRenderer`/`browser-extension-renderer`側で
Web Worker生成・`postMessage`のやり取りを追加する形になる見込み
(既存の`DiagramRenderPort`インターフェースは変更不要なため、既存の
構文エラー診断・`!include`展開・too largeフォールバックのロジックは
そのまま使い回せる設計になっている)。
