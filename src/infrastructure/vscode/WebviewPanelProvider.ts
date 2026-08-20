import * as vscode from "vscode";

/**
 * PlantUMLプレビュー用の単一Webviewパネルを遅延生成・共有するためのヘルパー。
 * WebviewMessageRenderer(レンダリング実行用)とWebviewPreviewPresenter(最終表示用)が
 * 同じパネルを使い回す(2つのアダプタが同じ物理リソースを扱うため)。
 */
export class WebviewPanelProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  getOrCreate(): vscode.WebviewPanel {
    if (this.panel) {
      return this.panel;
    }
    this.panel = vscode.window.createWebviewPanel(
      "plantumlWebPreview",
      "PlantUML Preview",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
      }
    );
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    return this.panel;
  }
}
