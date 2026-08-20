import * as vscode from "vscode";
import { ShowPreviewUseCase } from "./application/ShowPreviewUseCase.js";
import { VsCodeWorkspaceFsSourceReader } from "./infrastructure/vscode/VsCodeWorkspaceFsSourceReader.js";
import { WebviewMessageRenderer } from "./infrastructure/vscode/WebviewMessageRenderer.js";
import { WebviewPreviewPresenter } from "./infrastructure/vscode/WebviewPreviewPresenter.js";
import { WebviewPanelProvider } from "./infrastructure/vscode/WebviewPanelProvider.js";

/**
 * VS Code拡張機能の Composition Root。Web版(browser)・デスクトップ版(main)共通で
 * 使われる同一ソース(docs/design/step2-vscode-extension-design.md参照)。
 * ロジックは持たず、具象クラスを組み立てて配線するだけ。
 *
 * レンダリング(WASM実行)はWebview側で行う設計に変更済み
 * (拡張ホスト=Web Workerには window が存在せず @plantuml/core が動かないことが
 * 実機検証で判明したため。docs/design/step2-vscode-extension-design.md参照)。
 */
export function activate(context: vscode.ExtensionContext): void {
  const panels = new WebviewPanelProvider(context);
  const rendererScriptUri = vscode.Uri.joinPath(context.extensionUri, "dist", "webview-runtime.js");
  const renderer = new WebviewMessageRenderer(panels, rendererScriptUri);
  const presenter = new WebviewPreviewPresenter(panels, context);

  const showPreview = async (uri: vscode.Uri) => {
    const reader = new VsCodeWorkspaceFsSourceReader(uri);
    const useCase = new ShowPreviewUseCase(reader, renderer, presenter);
    await useCase.execute();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("plantuml-web.preview", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await showPreview(editor.document.uri);
      }
    }),
    vscode.workspace.onDidOpenTextDocument(async (doc) => {
      if (doc.languageId === "plantuml") {
        await showPreview(doc.uri);
      }
    })
  );
}

export function deactivate(): void {
  // no-op
}
