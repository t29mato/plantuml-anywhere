import { RenderedSvg } from "../../domain/RenderedSvg.js";
import { RenderError } from "../../domain/RenderError.js";
import type { PreviewPresenterPort } from "../../domain/ports.js";

/**
 * レンダリング結果でページのDOMをその場で置き換える(VS Code版のような別Webview/
 * 別パネルは存在しない。file://で開いているページ自身がプレビューになる)。
 */
export class PageDomPresenter implements PreviewPresenterPort {
  showSuccess(svg: RenderedSvg): void {
    document.title = "PlantUML Preview";
    document.body.innerHTML = "";
    const container = document.createElement("div");
    container.id = "plantuml-web-result";
    container.innerHTML = svg.svg;
    document.body.appendChild(container);
  }

  showError(error: RenderError): void {
    const marker = document.createElement("pre");
    marker.id = "plantuml-web-error";
    marker.style.color = "red";
    marker.style.whiteSpace = "pre-wrap";
    marker.textContent = "PlantUML render error: " + error.message;
    document.body.prepend(marker);
  }
}
