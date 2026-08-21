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

## 単体テスト

`test/infrastructure/rendering/tooLargeFallback.test.ts` で、エラーメッセージの
パース・フォントサイズ計算・`skinparam`挿入ロジックを純粋関数として単体テストしている
(実際のWASMレンダリングを伴う統合的な動作確認は、既存の方針どおり実ブラウザ
(`@vscode/test-web`・Playwright)での検証に委ねている。jsdomは`Element.getBBox()`を
実装していないため、レイアウト計算を要するクラス図の統合テストはjsdomでは実行できない
制約があるため。`docs/design/spike-report.md`参照)。
