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
  showSuccess(svg: RenderedSvg): void;
  showError(error: RenderError): void;
}
