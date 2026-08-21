import * as vscode from "vscode";
import { RenderedSvg } from "../../domain/RenderedSvg.js";
import { RenderError } from "../../domain/RenderError.js";
import type { PreviewPresenterPort } from "../../domain/ports.js";
import type { WebviewPanelProvider } from "./WebviewPanelProvider.js";

/**
 * レンダリング結果(SVG文字列 or エラーメッセージ)をWebviewに最終表示する。
 * この時点ではもうWASMは実行しない(WebviewMessageRendererが既に計算済み)ので、
 * ここのCSPはscript-srcを含めない最小構成でよい。
 */
export class WebviewPreviewPresenter implements PreviewPresenterPort {
  constructor(
    private readonly panels: WebviewPanelProvider,
    private readonly context: vscode.ExtensionContext
  ) {}

  /**
   * no-op。VS Code版では「レンダリング中…」の表示は
   * WebviewMessageRenderer.buildBootstrapHtml が担当する(Webviewを開いて
   * レンダラースクリプトを読み込む処理そのものがRenderer側の責務であり、
   * そのHTMLに静的なプレースホルダーを含めている)。
   * ここで別途Webviewを開き直すと、Rendererが開くWebviewと二重に競合するため
   * 何もしない(docs/design/large-diagram-fallback.md参照)。
   */
  showLoading(): void {
    // no-op
  }

  showSuccess(svg: RenderedSvg): void {
    this.render(svg.svg, false, svg.note);
    this.writeTestOutcomeIfInTestMode({ ok: true, svgLength: svg.svg.length, svg: svg.svg, note: svg.note });
  }

  showError(error: RenderError): void {
    this.render(error.message, true);
    this.writeTestOutcomeIfInTestMode({ ok: false, message: error.message });
  }

  private render(content: string, isError: boolean, note?: string): void {
    const panel = this.panels.getOrCreate();
    panel.webview.html = this.buildHtml(panel.webview, content, isError, note);
  }

  private buildHtml(webview: vscode.Webview, content: string, isError: boolean, note?: string): string {
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      "img-src data:",
    ].join("; ");

    const noteHtml = note ? `<p class="note">${escapeHtml(note)}</p>` : "";
    const body = isError ? `<pre class="error">${escapeHtml(content)}</pre>` : `${noteHtml}${content}`;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body { padding: 8px; }
    .error { color: var(--vscode-errorForeground); white-space: pre-wrap; }
    .note { color: var(--vscode-descriptionForeground); font-size: 0.85em; margin: 0 0 8px; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
  }

  /**
   * `vscode.ExtensionMode.Test`(@vscode/test-web の --extensionTestsPath実行時に
   * VS Codeが自動的に設定する公式のテストモードフラグ)のときだけ、
   * Webviewの内部DOMを外部から読めない制約を回避するため、結果をワークスペースの
   * 実ファイルとして書き出す。本番実行時は一切書き出さない。
   */
  private writeTestOutcomeIfInTestMode(outcome: Record<string, unknown>): void {
    if (this.context.extensionMode !== vscode.ExtensionMode.Test) {
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return;
    }
    const outUri = vscode.Uri.joinPath(folders[0].uri, "test-preview-outcome.json");
    void vscode.workspace.fs.writeFile(
      outUri,
      new TextEncoder().encode(JSON.stringify(outcome, null, 2))
    );
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
