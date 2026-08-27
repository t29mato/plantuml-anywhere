import * as vscode from "vscode";
import { RenderedSvg } from "../../domain/RenderedSvg.js";
import { RenderError } from "../../domain/RenderError.js";
import type { PreviewPresenterPort } from "../../domain/ports.js";
import type { WebviewPanelProvider } from "./WebviewPanelProvider.js";

/**
 * レンダリング結果(SVG文字列 or エラーメッセージ)をWebviewに最終表示する。
 * この時点ではもうWASMは実行しない(WebviewMessageRendererが既に計算済み)ので、
 * ここのCSPはscript-srcを含めない最小構成でよい。
 *
 * `uri`・`diagnostics` は構文エラー検出結果(`RenderedSvg.syntaxErrorLine`)を
 * VS Codeの診断(Problems パネル・該当行への波線)として表示するために使う
 * (docs/design/syntax-error-diagnostics.md参照)。プレビュー対象のファイルごとに
 * 正しい行へ波線を出すため、このクラスは(readerと同様に)ファイルごとに1つ生成する
 * 前提の設計にしている。`diagnostics` 自体は拡張全体で1つ共有し、`context.subscriptions`
 * で破棄する。
 */
export class WebviewPreviewPresenter implements PreviewPresenterPort {
  constructor(
    private readonly panels: WebviewPanelProvider,
    private readonly context: vscode.ExtensionContext,
    private readonly uri: vscode.Uri,
    private readonly diagnostics: vscode.DiagnosticCollection
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
    if (svg.syntaxErrorLine !== undefined) {
      this.diagnostics.set(this.uri, [this.buildSyntaxErrorDiagnostic(svg.syntaxErrorLine)]);
      const note = `⚠ 構文エラーを検出しました(${svg.syntaxErrorLine}行目付近)。詳細は Problems パネル、またはエディタの波線を確認してください。`;
      this.render(svg.svg, false, note);
    } else {
      this.diagnostics.delete(this.uri);
      this.render(svg.svg, false, svg.note);
    }
    this.writeTestOutcomeIfInTestMode({
      ok: true,
      svgLength: svg.svg.length,
      svg: svg.svg,
      note: svg.note,
      syntaxErrorLine: svg.syntaxErrorLine,
    });
  }

  showError(error: RenderError): void {
    this.diagnostics.delete(this.uri);
    this.render(error.message, true);
    this.writeTestOutcomeIfInTestMode({ ok: false, message: error.message });
  }

  private buildSyntaxErrorDiagnostic(line: number): vscode.Diagnostic {
    // 行番号は1始まり(PlantUMLソースの数え方)。vscode.Positionは0始まりなので変換する。
    // 波線を出す範囲は行全体(何桁目が悪いかまではPlantUMLの出力から特定できないため)。
    const zeroBasedLine = Math.max(0, line - 1);
    const range = new vscode.Range(zeroBasedLine, 0, zeroBasedLine, Number.MAX_SAFE_INTEGER);
    return new vscode.Diagnostic(
      range,
      "PlantUMLがこの行を構文エラーとして検出しました。",
      vscode.DiagnosticSeverity.Warning
    );
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
    // PlantUMLのSVGは黒線・黒文字/透明背景が既定のため、VS Codeのダークテーマでは
    // Webviewの背景色(--vscode-editor-background相当)に線や文字が沈んで見えなく
    // なる(docs/design/dark-theme-fix.md参照)。図の下に常に白いカードを敷いて
    // 保証する(図自身が skinparam backgroundColor を指定していれば、その色が
    // SVG内部の矩形として描画されるため、このカードの白は隠れて問題ない)。
    const body = isError
      ? `<pre class="error">${escapeHtml(content)}</pre>`
      : `${noteHtml}<div class="svg-container">${content}</div>`;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body { padding: 8px; }
    .error { color: var(--vscode-errorForeground); white-space: pre-wrap; }
    .note { color: var(--vscode-descriptionForeground); font-size: 0.85em; margin: 0 0 8px; }
    .svg-container {
      display: inline-block;
      background: #ffffff;
      padding: 8px;
      border-radius: 4px;
    }
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
