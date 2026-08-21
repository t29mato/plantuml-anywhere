import "@plantuml/core/viz-global.js";
import { renderToString } from "@plantuml/core";
import { DiagramSource } from "../../domain/DiagramSource.js";
import { RenderedSvg } from "../../domain/RenderedSvg.js";
import { RenderError } from "../../domain/RenderError.js";
import type { DiagramRenderPort } from "../../domain/ports.js";
import {
  parseTooLargeError,
  computeFallbackFontSize,
  injectSkinparam,
  DEFAULT_PLANTUML_FONT_SIZE,
} from "./tooLargeFallback.js";

/** "too large"エラー時の縮小再試行の最大回数。無限ループ防止。 */
const MAX_SHRINK_ATTEMPTS = 3;

/**
 * @plantuml/core (Graphviz WASM版, MIT, v1.2026.6以降) を使ったレンダラ。
 * vscode APIにもDOMグローバル(document等)にも依存しない共有infrastructure。
 * VS Code拡張機能(Web版/デスクトップ版)・Chrome拡張機能のいずれからも同一コードで利用する
 * (docs/design/architecture.md「配布ターゲット別のレイヤー構成」参照)。
 *
 * `@plantuml/core` の内部実装(viz-global.js)は `document`/`location` が未定義の場合に
 * Node の `require` を使うフォールバック分岐へ入るため、ESM Nodeそのままの実行環境では動かない
 * (docs/design/spike-report.md参照)。本クラスは Web Worker・CommonJSバンドル済み拡張ホスト・
 * ブラウザページの分離ワールドいずれかで実行されることを前提とする。
 *
 * `@plantuml/core` には `MAX_SVG_SIZE = 4096`px というハードコードされた上限があり、
 * 超えると "Diagram too large for browser rendering" で失敗する。回避策として、
 * `skinparam defaultFontSize` を使った自動縮小フォールバックを実装している
 * (docs/design/large-diagram-fallback.md参照)。
 */
export class PlantUmlCoreRenderer implements DiagramRenderPort {
  async render(source: DiagramSource): Promise<RenderedSvg | RenderError> {
    const originalLines = Array.from(source.lines);

    // 1回目: 元のソースのまま試す
    const firstAttempt = await this.renderOnce(originalLines);
    if (firstAttempt instanceof RenderedSvg) {
      return firstAttempt;
    }

    let dims = parseTooLargeError(firstAttempt.message);
    if (!dims) {
      // サイズ超過以外のエラーはフォールバック対象外
      return firstAttempt;
    }

    // 2回目以降: フォントサイズを縮小して再試行する
    let lastMessage = firstAttempt.message;
    for (let attempt = 0; attempt < MAX_SHRINK_ATTEMPTS; attempt++) {
      const fontSize = computeFallbackFontSize(dims, attempt);
      const shrunkLines = injectSkinparam(originalLines, fontSize);
      const result = await this.renderOnce(shrunkLines);

      if (result instanceof RenderedSvg) {
        const percent = Math.round((fontSize / DEFAULT_PLANTUML_FONT_SIZE) * 100);
        return new RenderedSvg(
          result.svg,
          `図が大きいため縮小して表示しています(目安 ${percent}%、文字サイズ ${fontSize}px)`
        );
      }

      lastMessage = result.message;
      const nextDims = parseTooLargeError(result.message);
      if (!nextDims) {
        // 縮小によって別種のエラーに変わった場合はそのまま返す
        return result;
      }
      dims = nextDims;
    }

    // 縮小を繰り返しても収まらなかった場合、利用者が次の行動を取れる
    // 分かりやすいメッセージに書き換える(Javaの例外文字列をそのまま見せない)。
    return new RenderError(
      "この図は大きすぎてプレビューできませんでした(自動縮小を試みましたが収まりませんでした)。" +
        `図を複数に分割するか、要素数を減らしてください。 (詳細: ${lastMessage})`
    );
  }

  private renderOnce(lines: string[]): Promise<RenderedSvg | RenderError> {
    return new Promise((resolve) => {
      renderToString(
        lines,
        (svg: string) => resolve(new RenderedSvg(svg)),
        (message: string) => resolve(new RenderError(message))
      );
    });
  }
}
