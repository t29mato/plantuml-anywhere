import { DiagramSource } from "./DiagramSource.js";
import { RenderedSvg } from "./RenderedSvg.js";
import { RenderError } from "./RenderError.js";

/**
 * PlantUMLソースをSVGにレンダリングするポート。
 * 実装は infrastructure/rendering に置く(vscode・DOMには依存しない)。
 */
export interface DiagramRenderPort {
  render(source: DiagramSource): Promise<RenderedSvg | RenderError>;
}

/**
 * レンダリング対象のソースを読み取るポート。
 * 「何を読むか」は実装のコンストラクタで解決する(引数を取らない)。
 * VS Code版・Chrome拡張機能版で共有できるようにするための設計。
 */
export interface DiagramSourceReaderPort {
  read(): Promise<DiagramSource>;
}

/**
 * レンダリング結果をユーザーに提示するポート。
 */
export interface PreviewPresenterPort {
  /**
   * レンダリング開始前(renderer.render呼び出し前)に呼ばれる。
   * @plantuml/core のレンダリングは同期的にメインスレッドをブロックし、巨大な図では
   * 数秒〜数十秒かかることが実機検証で判明している。その間「フリーズした」ように
   * 見えないよう、処理中であることを先に利用者へ伝えるためのフック
   * (docs/design/large-diagram-fallback.md「巨大図レンダリング中の無応答調査」参照)。
   */
  showLoading(): void;
  showSuccess(svg: RenderedSvg): void;
  showError(error: RenderError): void;
}
