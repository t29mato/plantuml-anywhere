import "@plantuml/core/viz-global.js";
import { renderToString } from "@plantuml/core";
import { DiagramSource } from "../../domain/DiagramSource.js";
import { RenderedSvg } from "../../domain/RenderedSvg.js";
import { RenderError } from "../../domain/RenderError.js";
import type { DiagramRenderPort } from "../../domain/ports.js";

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
 */
export class PlantUmlCoreRenderer implements DiagramRenderPort {
  render(source: DiagramSource): Promise<RenderedSvg | RenderError> {
    return new Promise((resolve) => {
      renderToString(
        Array.from(source.lines),
        (svg: string) => resolve(new RenderedSvg(svg)),
        (message: string) => resolve(new RenderError(message))
      );
    });
  }
}
