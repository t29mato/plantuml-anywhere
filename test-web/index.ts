import * as vscode from "vscode";

/**
 * @vscode/test-web の extensionTestsPath から実行される回帰テスト。
 * VS Code拡張ホスト(Web版 = ブラウザ内Web Worker)の中で本物の拡張を動かし、
 * 完了条件(拡張が有効化される/Webviewが開く/SVGが生成される)をアサーションで検証する。
 * いずれかが満たされない場合は例外を投げ、@vscode/test-web のプロセスを非ゼロ終了させる
 * (CIで機械的にPASS/FAILを判定できるようにするため。npm run test:e2e / scripts/ci.sh 参照)。
 *
 * 拡張ホスト自体には window が無く @plantuml/core を直接呼べないため
 * (docs/design/step2-vscode-extension-design.md 参照)、レンダリングはWebview側で行い、
 * その結果は WebviewPreviewPresenter が ExtensionMode.Test のときだけ書き出す
 * test-preview-outcome.json を読んで検証する。
 */
const EXTENSION_ID = "plantuml-web-poc.plantuml-web";
const EXPECTED_SVG_MARKERS = ["<svg", "Animal", "Dog", "Engine"];

export async function run(): Promise<void> {
  const t0 = performance.now();
  const folders = vscode.workspace.workspaceFolders;
  assert(!!folders && folders.length > 0, "no workspace folder");
  const folder = folders![0];

  const fileUri = vscode.Uri.joinPath(folder.uri, "sample.puml");
  const doc = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(doc);
  assert(doc.languageId === "plantuml", `expected languageId 'plantuml', got '${doc.languageId}'`);

  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  assert(!!ext, `extension '${EXTENSION_ID}' not found`);

  await vscode.commands.executeCommand("plantuml-web.preview");
  assert(!!ext!.isActive, "extension did not activate after running the preview command");

  // onDidOpenTextDocument/コマンド → ShowPreviewUseCase → WebviewへのpostMessage往復 →
  // WebviewPreviewPresenter.showSuccess/showError の完了を待つ。
  const outcomeUri = vscode.Uri.joinPath(folder.uri, "test-preview-outcome.json");
  const outcomeBytes = await waitForFile(outcomeUri, 15000);
  assert(!!outcomeBytes, "timed out waiting for test-preview-outcome.json");
  const outcome = JSON.parse(new TextDecoder().decode(outcomeBytes));
  const previewLatencyMs = Math.round(performance.now() - t0);

  assert(outcome.ok === true, `preview did not succeed: ${JSON.stringify(outcome)}`);
  assert(typeof outcome.svg === "string" && outcome.svg.length > 0, "outcome.svg is empty");
  for (const marker of EXPECTED_SVG_MARKERS) {
    assert(outcome.svg.includes(marker), `svg missing expected marker '${marker}'`);
  }

  const webviewOpened = vscode.window.tabGroups.all
    .flatMap((g) => g.tabs)
    .some((tab) => tab.input instanceof vscode.TabInputWebview);
  assert(webviewOpened, "no webview tab found after running the preview command");

  console.log(
    "[e2e] PASS",
    JSON.stringify({ svgLength: outcome.svg.length, previewLatencyMs, webviewOpened })
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[e2e] FAIL: ${message}`);
  }
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
