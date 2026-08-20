import * as vscode from "vscode";

/**
 * @vscode/test-web の extensionTestsPath から実行される。
 * VS Code拡張ホスト(Web版 = ブラウザ内Web Worker)の中で本物の拡張を動かし、
 * .pumlファイルを開いたときにWebview側(実DOM)でWASMレンダリングが成功するかを
 * 実機確認する(docs/design/step2-vscode-extension-design.md 参照)。
 *
 * 拡張ホスト自体には window が無く @plantuml/core を直接呼べないことが判明したため
 * (このファイルの旧バージョンで発覚)、レンダリングはWebview側で行う設計に変更済み。
 * このテストでは実際のコマンド実行結果(WebviewPreviewPresenterがExtensionMode.Testの
 * ときだけ書き出すtest-preview-outcome.json)を読んで判定する。
 */
export async function run(): Promise<void> {
  const result: Record<string, unknown> = {};
  const t0 = performance.now();

  try {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      throw new Error("no workspace folder");
    }
    const fileUri = vscode.Uri.joinPath(folders[0].uri, "sample.puml");
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc);

    result.languageId = doc.languageId;
    const ext = vscode.extensions.getExtension("plantuml-web-poc.plantuml-web");
    result.extensionFound = !!ext;
    result.extensionActiveBeforeCommand = ext?.isActive;

    // 自動プレビュー(onDidOpenTextDocument)を待つが、念のためコマンドも明示実行して
    // 「言語ID自動検出の問題」と「コマンド自体の問題」を切り分ける。
    await vscode.commands.executeCommand("plantuml-web.preview");
    result.extensionActiveAfterCommand = ext?.isActive;

    // onDidOpenTextDocument → ShowPreviewUseCase → WebviewへのpostMessage往復 →
    // WebviewPreviewPresenter.showSuccess/showError の完了を待つ。
    const outcomeUri = vscode.Uri.joinPath(folders[0].uri, "test-preview-outcome.json");
    const outcome = await waitForFile(outcomeUri, 15000);
    result.outcome = outcome ? JSON.parse(new TextDecoder().decode(outcome)) : null;
    // コマンド実行(≒プレビュー要求)から、Webview側のpostMessage往復を経て
    // showSuccess/showErrorが呼ばれるまでの所要時間(ミリ秒)。
    // WASM(webview-runtime.js, 約7.5MB)の初回読み込み+レンダリング時間を含む。
    result.previewLatencyMs = Math.round(performance.now() - t0);

    result.webviewOpened = vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .some((tab) => tab.input instanceof vscode.TabInputWebview);
  } catch (e) {
    result.exception = e instanceof Error ? e.message + "\n" + e.stack : String(e);
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    const outUri = vscode.Uri.joinPath(folders[0].uri, "test-web-result.json");
    await vscode.workspace.fs.writeFile(
      outUri,
      new TextEncoder().encode(JSON.stringify(result, null, 2))
    );
  }

  console.log("[test-web] result:", JSON.stringify(result));
}

async function waitForFile(uri: vscode.Uri, timeoutMs: number): Promise<Uint8Array | undefined> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      return await vscode.workspace.fs.readFile(uri);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  return undefined;
}
