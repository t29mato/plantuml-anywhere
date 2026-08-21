# 巨大な図の自動縮小フォールバック

- 実施日: 2026-08-21
- 経緯: オーナーが実機で試した最初の図で失敗した。

```
PlantUML render error: java.lang.RuntimeException:
Diagram too large for browser rendering: 6388x1573 (max 4096)
```

「インストールするだけで見える」という売り文句の根幹に関わる、実務で普通に描く規模の
図が表示できない不具合として、最優先で調査・修正した。

## 調査結果: 制約の正体

### なぜSVG出力なのにピクセル上限があるのか

`@plantuml/core`(TeaVMビルド)専用に追加された、**ハードコードされたコンパイル時定数**
であることが判明した。実際のソース(GitHub `plantuml/plantuml`
`src/main/java/net/sourceforge/plantuml/teavm/browser/PlantUMLBrowser.java`):

```java
/** Maximum width or height (in pixels) before refusing to render. */
private static final int MAX_SVG_SIZE = 4096;
...
final XDimension2D dim = tb.calculateDimension(STRING_BOUNDER);

if (dim.getWidth() > MAX_SVG_SIZE || dim.getHeight() > MAX_SVG_SIZE)
    throw new RuntimeException("Diagram too large for browser rendering: " + ...);

final double scaleFactor = scale == null ? 1.0 : scale.getScale(dim.getWidth(), dim.getHeight());
svg.updateSvgSize(dim.getWidth(), dim.getHeight(), scaleFactor);
```

- **ラスタ(PNG)経路にのみ効く制限ではなく、SVG出力にも一律に効く。** このクラスは
  SVG専用のレンダリングパスであり、フォーマット分岐は存在しない。
- 通常のJava版PlantUML(通常のjarファイル)には `PLANTUML_LIMIT_SIZE` という環境変数
  (`-DPLANTUML_LIMIT_SIZE=8192` 等)で上限を変更する仕組みがあるが、**このTeaVMブラウザ
  ビルドには実装されていない**(バンドル内を`PLANTUML_LIMIT_SIZE`という文字列で検索して
  も見つからないことを確認済み)。`@plantuml/core` のJS公開APIにも、この上限を変更する
  オプションは一切存在しない(`render`/`renderToString` は `{dark: boolean}` のみ受け付ける)。
  **上限を引き上げる設定は存在しない。**

### `scale` ディレクティブが効かない理由

上記コードをよく見ると、`dim`(サイズ判定に使う値)の計算 → **サイズ判定** → その後で
`scaleFactor`(`scale`ディレクティブの値)を使って`svg.updateSvgSize(...)`を呼ぶ、という
順序になっている。つまり**サイズ判定は `scale` 適用前の生のレイアウト座標に対して
行われる**。`scale` は判定通過後の表示上の拡大縮小(SVGの`width`/`height`属性や
`viewBox`)にしか影響しない。

実機検証でこれを確認した: `scale 0.5`, `scale 0.7`, `scale 1/2`, `scale 800 width`,
`scale max 4000 width` のいずれを付けても、エラーメッセージの`WxH`は変化しなかった
(全て `5778x96` のまま)。**HQから提案のあった「scale指定を先頭に付けて再試行する」
方針は機能しないことを実機検証で確認済み。**

## 採用した対応: `skinparam defaultFontSize` による自動縮小

`calculateDimension` はテキストの実測フォントメトリクスに基づいてレイアウトサイズを
計算するため、**フォントサイズを縮小すれば `dim` 自体(判定対象の生座標)を縮小できる**。
実機検証で `skinparam defaultFontSize` を挿入すると `dim` が実際に縮小することを確認済み。

### アルゴリズム(`src/infrastructure/rendering/PlantUmlCoreRenderer.ts` + `tooLargeFallback.ts`)

1. まず元のソースのまま `renderToString` を試す
2. `"Diagram too large for browser rendering: WxH (max M)"` のエラーが返った場合のみ
   フォールバックに入る(それ以外のエラーはそのまま返す)
3. 必要な縮小率を `(M / max(W,H)) * 0.85`(安全マージン15%)で計算し、
   `defaultFontSize = round(14 * 縮小率)`(最小5pxでクランプ)を算出
4. `@startuml` の直後に `skinparam defaultFontSize <N>` を挿入して再試行
5. まだ超過する場合、直前のエラーの新しい `WxH` を使って同じ計算を最大3回まで繰り返す
   (安全マージンをリトライごとにさらに強める)
6. 3回リトライしても収まらない場合は、利用者が次の行動を取れる分かりやすい
   エラーメッセージに書き換える(Javaの例外文字列をそのまま見せない):
   > この図は大きすぎてプレビューできませんでした(自動縮小を試みましたが収まりません
   > でした)。図を複数に分割するか、要素数を減らしてください。 (詳細: ...)

### 縮小時の表示

縮小が発動した場合、`RenderedSvg.note` に控えめな注記を設定し、VS Code版
(`WebviewPreviewPresenter`)・Chrome拡張版(`PageDomPresenter`)の両方で、SVGの上に
小さいグレーの注記として表示する:

> 図が大きいため縮小して表示しています(目安 50%、文字サイズ 7px)

## 追加調査: フォントサイズ縮小だけでは足りないケース(nodesep/ranksep)

初回リリース(0.1.1)後、HQから「オーナーが実際に踏んだ `6388x1573` と同等以上の図で
実ブラウザ表示を証明せよ」という指示を受け、42列×12行(504クラス、913リンク、
素の座標 `6449x1637`)のグリッド状クラス図(`test-fixtures/huge.puml`)で検証したところ、
**3回リトライしてもなお `4096` を超過し続ける**(最終 `4390x1420`、約17.4秒)ことが
判明した。

原因は、この図の形状(多数の小さいノードが横に並ぶグリッド)では、幅の主要因が
テキスト幅ではなく **Graphvizのノード間隔(`nodesep`)・階層間隔(`ranksep`)という
固定要素**である点にあった。`defaultFontSize`はテキスト幅・ノードの内側サイズは
縮小するが、ノード間の余白(デフォルト約10pt相当)は縮小しないため、ノード数が
多い図では余白の総和が支配的になり、フォントをいくら縮めても収束しなかった。

### 修正

`computeFallbackSpacing()` を追加し、フォントサイズの縮小比率に比例して
`skinparam nodesep` / `skinparam ranksep` も一緒に注入するよう
`injectSkinparam()` を拡張した(`src/infrastructure/rendering/tooLargeFallback.ts`)。
`PlantUmlCoreRenderer.ts` 側のリトライループ自体は変更不要で、`injectSkinparam`の
出力が変わるだけで自動的に恩恵を受ける。

修正後、同じ504クラスの図が **1回目のリトライ(フォントサイズ8px)で成功**するように
なった(後述の実機検証を参照)。

### 調査メモ(更新): 540クラス図でのハングについて

検証の途中、さらに大きい45列×12行(540クラス、1023リンク、素の座標
`6911x1637`)の図でBrave拡張が `page.waitForSelector('svg')` で60秒以上
応答しなくなる事象に遭遇した。プロセス状態は `UN`(uninterruptible sleep)で
CPU使用率もほぼ0%と、単なる処理の遅さではなく本物のハング/デッドロックに見える
挙動だった。一方、同じ図を素の Node/Playwright ハーネス(`trace-*.mjs`、拡張の
パイプラインを経由せず `PlantUmlCoreRenderer` を直接1回だけ呼ぶ)で単発実行すると
8〜14秒で正常に完了した。

時間の制約上、この個体は深追いせず、目標(オーナー報告値以上)を満たすやや小さい
504クラスの図に切り替えて検証を完了させていた。

**追記(HQ指示による無応答調査後):** 後続の調査(下記「巨大図レンダリング中の
無応答調査」参照)で、nodesep/ranksep対応後は540クラス相当の図も1回のリトライ
(2回目の試行)で収束し、合計所要時間は約9.5秒に収まることを確認した。以前の
「完全ハング」は、nodesep/ranksep対応前のビルドで3回のリトライすべてが必要になり、
連続ブロッキング時間が30秒を超えていたことが直接の原因だった可能性が高い。
ただし、Brave拡張のcontent script経由のパイプライン特有の挙動が完全に無関係とは
言い切れず(VS Code版の`test:e2e`では、90×14グリッド/1260クラスの極端なケース
[合計約70秒のブロッキング]でも「戻ってこない完全ハング」は再現していない)、
Brave拡張だけがより深刻に固まる要因が別途あるかどうかは未検証のまま残っている。
将来、この規模を超える図でBrave拡張が固まる報告があれば、まずこの記録を参照し、
VS Code版との挙動差を切り分けること。

## 実機検証結果

検証用の横長クラス図(40クラス、素の座標 `5778x96`)を使用。

| ケース | VS Code版 | Chrome/Brave版 |
|---|---|---|
| 通常サイズ(既存E2E, `sample.puml`) | ✅ `svgLength=4205`(変化なし、リグレッションなし) | ✅ |
| 大きい図(縮小して収まる) | ✅ `viewBox="0 0 3981 78"`, note付き | ✅ 実際のBrave Browserバイナリでスクリーンショット取得 (`docs/evidence/large-diagram-fallback-brave.png`) |
| 極端に大きい図(300クラス、素の座標 `45389x80`、3回縮小しても収まらない) | (VS Code側は未実施、共有ロジックのため省略) | ✅ 親切なエラーメッセージを確認(実測、下記) |

極端なケースの実測結果:

```json
{
  "ok": false,
  "ms": 13590,
  "error": "この図は大きすぎてプレビューできませんでした(自動縮小を試みましたが収まりませんでした)。図を複数に分割するか、要素数を減らしてください。 (詳細: java.lang.RuntimeException: Diagram too large for browser rendering: 26748x66 (max 4096))"
}
```

3回の縮小リトライで `45389x80` → `26748x66` まで縮小できたが、それでも上限4096を
超えるため、最終的に親切なメッセージへ書き換えられている。

## 最終検証: オーナー報告値(`6388x1573`)以上での実機確認

HQからの最終指示に基づき、オーナーが実際に踏んだ `6388x1573` を**幅・高さとも
上回る**図(`test-fixtures/huge.puml`、42列×12行、504クラス、913リンク、
素の座標 `6449x1637`)を用意し、nodesep/ranksep対応後のビルドで、VS Code版・
Brave拡張版の両方について、実バイナリを使った実ブラウザ検証(Playwright CDP)で
「縮小注記が表示され、SVGが収まって描画される」ことをスクリーンショットで確認した。

| 対象 | 結果 | 証跡 |
|---|---|---|
| Brave拡張(実際のBrave Browserバイナリ + `--load-extension`) | ✅ `note: 図が大きいため縮小して表示しています(目安 57%、文字サイズ 8px)` / `viewBox: 0 0 3455 848` | `docs/evidence/brave-huge-diagram.png` |
| VS Code Desktop(実際のCode.appバイナリ + `--remote-debugging-port`でCDP接続、コマンドパレットから`PlantUML: Preview`を実行) | ✅ 同一の注記・同一のviewBoxで描画(共有ロジックのため同一結果) | `docs/evidence/vscode-huge-diagram.png` |

両方とも、合成ではなく実際のアプリケーション(VS Code Desktop本体 / Brave Browser本体)
をPlaywrightのCDP経由で操作して撮影した、正真正銘のスクリーンショットである。

## 巨大図レンダリング中の無応答調査

上記の最終検証後、HQ(司令塔)自身が `npm run test:e2e` の対象を `huge.puml`
(504クラス)に差し替えて実行したところ、以下のログを観測したと報告があった。

```
Extension host (LocalWebWorker) is unresponsive.
Extension host (LocalWebWorker) is responsive.
```

これを受け、原因調査と対策を行った。

### 調査方法

`@vscode/test-web` の headless実行結果は決定論的に再現しないため(後述)、
`PlantUmlCoreRenderer.render()` に一時的な計測コード(`performance.now()`で
各 `renderOnce` 呼び出しの所要時間を記録し、`test-preview-outcome.json` 経由で
取得する)を仕込んで実測した。調査終了後、この計測コードは全て取り除いてある。

### 事実1: レンダリングは`@plantuml/core`自身の設計により同期的にメインスレッドをブロックする

`node_modules/@plantuml/core/github-integration-web-worker-poc.html` に同梱されている
公式PoCのコメントに、次の記述がある(該当ファイルより引用):

> The basic version runs the engine directly in the page and must serialize
> renders (one at a time) because the engine uses shared state.

つまり、TeaVMコンパイル済みのレンダリングエンジンは共有状態を持ち、1回の
`renderToString` 呼び出しは同期的に呼び出し元のスレッドを占有する。これは
アプリケーション側のコードでは回避できない、エンジン自体の設計上の制約である。
(公式PoCは "hidden iframe" を使いエンジンを別のブラウジングコンテキストへ隔離する
ことで緩和しているが、Webview内にさらにiframeを作る大掛かりな構造変更が必要で、
今回はPoCスコープを超えるため見送った。将来の改善候補として記録する。)

### 事実2: 1回あたりの実測ブロッキング時間

`test-fixtures/huge.puml` をベースに条件を変えて計測した(全てVS Code Web版、
`@vscode/test-web` headless実行、同一マシン):

| ケース | 試行回数 | 各試行の所要時間(ms) | 合計 |
|---|---|---|---|
| 504クラス(6449x1637、1回のリトライで収束) | 2回 | [3890〜4108], [4993〜5508] | 約9.0〜9.5秒 |
| 540クラス相当(45×12グリッド、nodesep/ranksep対応後は1回のリトライで収束) | 2回 | [4019], [5508] | 約9.5秒 |
| 極端なケース(90×14グリッド、1260クラス、3回リトライしても収束しない) | 4回(1回目+リトライ3回) | [11187〜12214], [19335〜20603], [18275〜19911], [18489〜19994] | 約69〜73秒 |

**540クラス図は、nodesep/ranksep対応(前セクション参照)によって、既に1回の
リトライで収束するようになっている。** 以前観測された「Brave拡張が
`page.waitForSelector('svg')` で60秒以上応答しない」完全ハングは、
nodesep/ranksep対応前のビルドで3回リトライしても収まらず、合計30秒以上の
連続ブロッキングが発生していたことが直接の原因だった可能性が高い。

### 事実3: 「Extension host is unresponsive」ログの実体

タイムスタンプ付きで複数回計測した結果、"unresponsive"→"responsive" の
ログ間隔は**常に20〜30ミリ秒**だった(例: `1787307170.502 unresponsive` →
`1787307170.525 responsive`)。これは実行のたびに同じ傾向で、レンダリングの
方式や試行回数に関わらず一定だった。また、通常サイズの図(`sample.puml`、
14行)では3回連続で実行しても一度も発生しなかった。

対照実験として、以下2つの条件を比較したが、**どちらも無応答ログの発生・
持続時間に有意な差は見られなかった**:

- 各 `renderOnce` 呼び出しの合間に `setTimeout(0)` でイベントループへ制御を
  返す実装 vs 何もしない実装(同一の1260クラス図で3回ずつ比較)

これらから次のように結論づけた: **「Extension host is unresponsive」ログは
一過性(20〜30ms)の軽微な検知イベントであり、それ自体が長時間の機能不全を
意味するものではない。**巨大な図でのみ発生することから、Webview側の重い
処理(メインスレッドの占有)が拡張ホストとの通信タイミングにわずかな遅延を
与えていることは間違いないが、拡張ホスト自体が数十秒単位でフリーズしている
わけではなかった。実際、90×14グリッド(1260クラス、合計約70秒のブロッキング)
のケースでも、`test:e2e`のファイル待機(`waitForFile`)は最終的に正常な
エラーメッセージを受け取れており、**VS Code版では「戻ってこない完全ハング」
は再現しなかった**。

一方で、**Webview内では実際に処理時間分(504クラスで約9秒、極端なケースで
約70秒)、SVGの表示が更新されず、利用者からは「プレビューパネルが固まった」
ように見える。**これが体感上の問題の実体であり、拡張ホストの無応答ログとは
別の課題として扱う必要がある。

### 対応

1. **調査した`setTimeout(0)`による制御返却は、効果を統計的に確認できなかった
   ため不採用**とした(コードの複雑化を避ける、CLAUDE.mdのシンプルさの原則にも
   合致)。
2. 代わりに、**レンダリング開始前に「処理中である」ことを明示するプレースホルダー
   表示を追加した**(`PreviewPresenterPort.showLoading()`を新設し、
   `ShowPreviewUseCase.execute()`の先頭で呼び出す設計)。
   - VS Code版: `WebviewMessageRenderer.buildBootstrapHtml`が、レンダラー
     スクリプトの読み込み前に「図をレンダリング中です。図が大きい場合、
     数秒〜数十秒かかることがあります…」を表示する。実機(VS Code Desktop、
     CDP経由)で表示を確認済み(`docs/evidence/vscode-loading-placeholder.png`)。
   - Brave拡張版: `PageDomPresenter.showLoading()`が同様のプレースホルダーを
     `document.body`に追加する。実機(Brave Browser、Playwright)で表示を
     確認済み(表示開始まで762ms)。
   - この表示は、技術的な無応答自体を解消するものではないが、利用者が
     「フリーズした」ではなく「処理中」と理解できるようにするための対応である。
3. フォールバックの再試行回数(`MAX_SHRINK_ATTEMPTS = 3`)は、通常の巨大図
   (504〜540クラス相当)では実際には1回のリトライ(2回目の試行)で収束して
   おり、3回に到達するのは極端なケースに限られる。上限を減らしても典型的な
   ケースの時間短縮にはつながらないため、さらに大きい図への安全弁として
   現状維持とした。「1回目の元サイズでの試行」自体は、事前にサイズを予測する
   手段が存在しないため省略できない(必ず一度試して"too large"エラーの
   `WxH`を得る必要がある)。

## 単体テスト

`test/infrastructure/rendering/tooLargeFallback.test.ts` で、エラーメッセージの
パース・フォントサイズ計算・`skinparam`挿入ロジックを純粋関数として単体テストしている
(実際のWASMレンダリングを伴う統合的な動作確認は、既存の方針どおり実ブラウザ
(`@vscode/test-web`・Playwright)での検証に委ねている。jsdomは`Element.getBBox()`を
実装していないため、レイアウト計算を要するクラス図の統合テストはjsdomでは実行できない
制約があるため。`docs/design/spike-report.md`参照)。
