import * as vscode from "vscode";
import { DiagramSource } from "../../domain/DiagramSource.js";
import { RenderedSvg } from "../../domain/RenderedSvg.js";
import { RenderError } from "../../domain/RenderError.js";
import type { DiagramRenderPort } from "../../domain/ports.js";
import type { WebviewPanelProvider } from "./WebviewPanelProvider.js";

/**
 * @plantuml/core によるレンダリングをWebview側(実DOMを持つiframe)で実行し、
 * postMessageで結果を受け取るアダプタ。
 *
 * 【設計変更の経緯】当初は拡張ホスト側(Web版はWeb Worker)でWASMレンダリングを行う設計だった
 * (Webview CSPのwasm-unsafe-eval問題を避けるため)。しかし @vscode/test-web
 * による実機検証で、Web Worker には `window` が存在せず、@plantuml/core が
 * SVGレイアウト計算に `window`/DOM(getBBox等)を要求するため
 * `ReferenceError: window is not defined` で失敗することが判明した
 * (docs/design/step2-vscode-extension-design.md 参照)。
 * そのためレンダリングは実DOMを持つWebview側で行う設計に修正した。
 * 引き換えにWebviewのCSPで `wasm-unsafe-eval` を許可する必要がある
 * (buildBootstrapHtmlのCSP参照)。
 */
export class WebviewMessageRenderer implements DiagramRenderPort {
  constructor(
    private readonly panels: WebviewPanelProvider,
    private readonly rendererScriptUri: vscode.Uri
  ) {}

  render(source: DiagramSource): Promise<RenderedSvg | RenderError> {
    const panel = this.panels.getOrCreate();

    return new Promise((resolve) => {
      const resultSub = panel.webview.onDidReceiveMessage((message: unknown) => {
        const m = message as { type?: string; ok?: boolean; svg?: string; note?: string; error?: string };
        if (m?.type !== "render-result") {
          return;
        }
        resultSub.dispose();
        readySub.dispose();
        if (m.ok) {
          resolve(new RenderedSvg(m.svg ?? "", m.note));
        } else {
          resolve(new RenderError(m.error ?? "unknown render error"));
        }
      });

      const readySub = panel.webview.onDidReceiveMessage((message: unknown) => {
        const m = message as { type?: string };
        if (m?.type !== "ready") {
          return;
        }
        void panel.webview.postMessage({ type: "render", lines: Array.from(source.lines) });
      });

      panel.webview.html = this.buildBootstrapHtml(panel.webview);
    });
  }

  private buildBootstrapHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(this.rendererScriptUri);
    // WASM実行(WebAssembly.instantiate)のために 'wasm-unsafe-eval' が必要
    // (docs/design/spike-report.mdの申し送り事項どおり)。
    const csp = [
      "default-src 'none'",
      `script-src ${webview.cspSource} 'wasm-unsafe-eval'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
</head>
<body>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
