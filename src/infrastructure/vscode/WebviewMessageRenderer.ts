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
        const m = message as {
          type?: string;
          ok?: boolean;
          svg?: string;
          note?: string;
          syntaxErrorLine?: number;
          error?: string;
        };
        if (m?.type !== "render-result") {
          return;
        }
        resultSub.dispose();
        readySub.dispose();
        if (m.ok) {
          resolve(new RenderedSvg(m.svg ?? "", m.note, m.syntaxErrorLine));
        } else {
          resolve(new RenderError(m.error ?? "unknown render error"));
        }
      });

      const readySub = panel.webview.onDidReceiveMessage((message: unknown) => {
        const m = message as { type?: string };
        if (m?.type !== "ready") {
          return;
        }
        void panel.webview.postMessage({
          type: "render",
          lines: Array.from(source.lines),
          originLines: source.originLines ? Array.from(source.originLines) : undefined,
        });
      });

      panel.webview.html = this.buildBootstrapHtml(panel.webview);
    });
  }

  private buildBootstrapHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(this.rendererScriptUri);
    // WASM実行(WebAssembly.instantiate)のために 'wasm-unsafe-eval' が、
    // 下記の「レンダリング中…」表示のために 'unsafe-inline' なstyle-srcが必要
    // (docs/design/spike-report.mdの申し送り事項どおり)。
    const csp = [
      "default-src 'none'",
      `script-src ${webview.cspSource} 'wasm-unsafe-eval'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
    ].join("; ");

    // @plantuml/core のレンダリング(renderToString)は同期的にメインスレッドを
    // ブロックする(数秒〜巨大な図では数十秒)ため、スクリプト読み込み・実行前に
    // 静的なプレースホルダーを表示しておく。無応答検知自体は解消しないが、
    // 利用者が「フリーズした」ではなく「処理中」と理解できるようにするための対応
    // (docs/design/large-diagram-fallback.md「巨大図レンダリング中の無応答調査」参照)。
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body { padding: 8px; }
    /* --vscode-descriptionForeground が未定義な環境向けにフォールバック色を明示 */
    .rendering-placeholder { color: var(--vscode-descriptionForeground, #888888); font-size: 0.9em; }
  </style>
</head>
<body>
  <p class="rendering-placeholder">図をレンダリング中です。図が大きい場合、数秒〜数十秒かかることがあります…</p>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
