import * as vscode from "vscode";
import { ShowPreviewUseCase } from "./application/ShowPreviewUseCase.js";
import { VsCodeWorkspaceFsSourceReader } from "./infrastructure/vscode/VsCodeWorkspaceFsSourceReader.js";
import { WebviewMessageRenderer } from "./infrastructure/vscode/WebviewMessageRenderer.js";
import { WebviewPreviewPresenter } from "./infrastructure/vscode/WebviewPreviewPresenter.js";
import { WebviewPanelProvider } from "./infrastructure/vscode/WebviewPanelProvider.js";

/**
 * VS Code拡張機能の Composition Root。Web版(browser)・デスクトップ版共通で
 * 使われる同一ソース(docs/design/step2-vscode-extension-design.md参照)。
 * ロジックは持たず、具象クラスを組み立てて配線するだけ。
 *
 * レンダリング(WASM実行)はWebview側で行う設計に変更済み
 * (拡張ホスト=Web Workerには window が存在せず @plantuml/core が動かないことが
 * 実機検証で判明したため。docs/design/step2-vscode-extension-design.md参照)。
 *
 * `package.json` の `browser` エントリのみ(`main` は持たない)。デスクトップ版VS Codeでも
 * 自動的にWeb Worker拡張ホスト(LocalWebWorker)が作られてこのまま動作することを
 * .vsixの実インストール検証(通常環境・クリーンルーム環境の両方)で確認済み
 * (docs/design/vsix-install-verification.md参照)。
 */
export function activate(context: vscode.ExtensionContext): void {
  const panels = new WebviewPanelProvider(context);
  const rendererScriptUri = vscode.Uri.joinPath(context.extensionUri, "dist", "webview-runtime.js");
  const renderer = new WebviewMessageRenderer(panels, rendererScriptUri);
  // 構文エラー行の診断(Problems パネル・波線)をファイルごとに正しく出すため、
  // DiagnosticCollection自体は拡張全体で1つ共有する(docs/design/syntax-error-diagnostics.md参照)。
  const diagnostics = vscode.languages.createDiagnosticCollection("plantuml-anywhere");
  context.subscriptions.push(diagnostics);

  const showPreview = async (uri: vscode.Uri) => {
    // reader・presenterはどちらも「どのファイルを対象にするか」を持つため、
    // showPreview呼び出しごとに生成する(rendererはWebviewを共有する側なので使い回す)。
    const reader = new VsCodeWorkspaceFsSourceReader(uri);
    const presenter = new WebviewPreviewPresenter(panels, context, uri, diagnostics);
    const useCase = new ShowPreviewUseCase(reader, renderer, presenter);
    await useCase.execute();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("plantuml-anywhere.preview", async () => {
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
