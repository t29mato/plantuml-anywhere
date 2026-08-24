import { RenderedSvg } from "../../domain/RenderedSvg.js";
import { RenderError } from "../../domain/RenderError.js";
import type { PreviewPresenterPort } from "../../domain/ports.js";

/**
 * レンダリング結果でページのDOMをその場で置き換える(VS Code版のような別Webview/
 * 別パネルは存在しない。file://で開いているページ自身がプレビューになる)。
 */
export class PageDomPresenter implements PreviewPresenterPort {
  /**
   * @plantuml/core のレンダリング(renderToString)は同期的にメインスレッドを
   * ブロックする(巨大な図では数秒〜数十秒)。この間ページが真っ白なままだと
   * 「フリーズした」ように見えるため、レンダリング開始前に処理中である旨を表示する
   * (docs/design/large-diagram-fallback.md「巨大図レンダリング中の無応答調査」参照)。
   */
  showLoading(): void {
    document.title = "PlantUML Preview (rendering...)";
    const placeholder = document.createElement("p");
    placeholder.id = "plantuml-anywhere-loading";
    placeholder.style.color = "#666";
    placeholder.style.font = "12px sans-serif";
    placeholder.textContent =
      "図をレンダリング中です。図が大きい場合、数秒〜数十秒かかることがあります…";
    document.body.appendChild(placeholder);
  }

  showSuccess(svg: RenderedSvg): void {
    document.title = "PlantUML Preview";
    document.body.innerHTML = "";
    if (svg.note) {
      const note = document.createElement("p");
      note.id = "plantuml-anywhere-note";
      note.style.color = "#666";
      note.style.font = "12px sans-serif";
      note.textContent = svg.note;
      document.body.appendChild(note);
    }
    const container = document.createElement("div");
    container.id = "plantuml-anywhere-result";
    // PlantUMLのSVGは黒線・黒文字/透明背景が既定のため、ブラウザがダークテーマの
    // 場合(file://ページの背景が暗色になる)、線や文字が背景に沈んで見えなくなる
    // (docs/design/dark-theme-fix.md参照)。図の下に常に白背景を敷いて保証する。
    // 図自身が skinparam backgroundColor で背景色を指定している場合は、その色が
    // SVG内部の矩形として描画されるため、このコンテナの白は上から隠れて問題ない。
    container.style.background = "#ffffff";
    container.style.display = "inline-block";
    container.style.padding = "8px";
    container.style.borderRadius = "4px";
    container.innerHTML = svg.svg;
    document.body.appendChild(container);
  }

  showError(error: RenderError): void {
    document.getElementById("plantuml-anywhere-loading")?.remove();
    const marker = document.createElement("pre");
    marker.id = "plantuml-anywhere-error";
    marker.style.color = "red";
    marker.style.whiteSpace = "pre-wrap";
    marker.textContent = "PlantUML render error: " + error.message;
    document.body.prepend(marker);
  }
}
