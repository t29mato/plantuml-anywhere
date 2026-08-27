import { PlantUmlCoreRenderer } from "../infrastructure/rendering/PlantUmlCoreRenderer.js";
import { DiagramSource } from "../domain/DiagramSource.js";
import { RenderedSvg } from "../domain/RenderedSvg.js";

/**
 * Webview内(実DOMを持つiframe)で動く、レンダリング専用のブートストラップスクリプト。
 * WebviewMessageRenderer(拡張ホスト側)からpostMessageでソースを受け取り、
 * @plantuml/core でレンダリングして結果をpostMessageで返す。
 * このファイルは拡張本体(extension.js)とは別にバンドルされ、Webviewが開かれたときだけ
 * 遅延読み込みされる(拡張ホスト側のバンドルサイズを増やさないため)。
 */
declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscodeApi = acquireVsCodeApi();
const renderer = new PlantUmlCoreRenderer();

window.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as { type?: string; lines?: string[]; originLines?: number[] };
  if (message?.type !== "render") {
    return;
  }
  const source = new DiagramSource(message.lines ?? [], message.originLines);
  renderer.render(source).then((result) => {
    if (result instanceof RenderedSvg) {
      vscodeApi.postMessage({
        type: "render-result",
        ok: true,
        svg: result.svg,
        note: result.note,
        syntaxErrorLine: result.syntaxErrorLine,
      });
    } else {
      vscodeApi.postMessage({ type: "render-result", ok: false, error: result.message });
    }
  });
});

vscodeApi.postMessage({ type: "ready" });
