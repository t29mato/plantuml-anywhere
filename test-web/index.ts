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
const EXTENSION_ID = "plantuml-anywhere-poc.plantuml-anywhere";
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

  await vscode.commands.executeCommand("plantuml-anywhere.preview");
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

  await runSyntaxErrorDiagnosticsCheck(folder);
  await runIncludeExpansionCheck(folder);
}

/**
 * 構文エラー検出→VS Code診断(Problems パネル・波線)の統合確認。
 * docs/design/syntax-error-diagnostics.md参照。
 */
async function runSyntaxErrorDiagnosticsCheck(folder: vscode.WorkspaceFolder): Promise<void> {
  const fileUri = vscode.Uri.joinPath(folder.uri, "syntax-error.puml");
  const doc = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand("plantuml-anywhere.preview");

  const outcomeUri = vscode.Uri.joinPath(folder.uri, "test-preview-outcome.json");
  // 1つ目のsample.pumlのレンダリング結果が既に同じファイルに書き込まれているため、
  // 単なる存在確認ではなく「syntaxErrorLineを含む新しい内容になった」ことを待つ。
  const outcome = await waitForOutcomeWithSyntaxErrorLine(outcomeUri, 15000);
  assert(!!outcome, "timed out waiting for syntax-error outcome");
  assert(outcome.ok === true, `syntax-error preview did not succeed: ${JSON.stringify(outcome)}`);
  assert(
    outcome.syntaxErrorLine === 2,
    `expected syntaxErrorLine=2 (test-fixtures/syntax-error.puml line 2), got ${outcome.syntaxErrorLine}`
  );

  const diagnostics = vscode.languages.getDiagnostics(fileUri);
  assert(diagnostics.length > 0, "expected at least one diagnostic on syntax-error.puml");
  assert(
    diagnostics.some((d) => d.range.start.line === 1), // 0始まり = ソースの2行目
    `expected a diagnostic on line 2 (0-indexed 1), got ranges: ${JSON.stringify(diagnostics.map((d) => d.range.start.line))}`
  );

  console.log("[e2e] PASS (syntax-error diagnostics)", JSON.stringify({ syntaxErrorLine: outcome.syntaxErrorLine }));
}

async function waitForOutcomeWithSyntaxErrorLine(uri: vscode.Uri, timeoutMs: number) {
  return waitForOutcomeWhere(uri, (o) => o.syntaxErrorLine !== undefined, timeoutMs);
}

/**
 * `!include` 展開の統合確認。docs/design/include-directive-support.md参照。
 * include-main.puml → include-sub/shared.puml → include-sub/nested.puml と
 * 2段階ネストした実ファイルを、実際に `vscode.workspace.fs` 経由で読み込んで
 * 展開できることを確認する。
 */
async function runIncludeExpansionCheck(folder: vscode.WorkspaceFolder): Promise<void> {
  const fileUri = vscode.Uri.joinPath(folder.uri, "include-main.puml");
  const doc = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand("plantuml-anywhere.preview");

  const outcomeUri = vscode.Uri.joinPath(folder.uri, "test-preview-outcome.json");
  const outcome = await waitForOutcomeWhere(
    outcomeUri,
    (o) => typeof o.svg === "string" && o.svg.includes("Shared2"),
    15000
  );
  assert(!!outcome, "timed out waiting for include-expansion outcome");
  assert(outcome.ok === true, `include-expansion preview did not succeed: ${JSON.stringify(outcome)}`);
  assert(outcome.syntaxErrorLine === undefined, "include expansion unexpectedly triggered a syntax error");
  for (const marker of ["Main", "Shared1", "Shared2"]) {
    assert(outcome.svg.includes(marker), `svg missing expected marker '${marker}' from included files`);
  }

  console.log("[e2e] PASS (include expansion)", JSON.stringify({ svgLength: outcome.svg.length }));
}

// outcomeはJSON.parseの戻り値(暗黙any)をそのまま使う既存の書き方に揃えている。
async function waitForOutcomeWhere(
  uri: vscode.Uri,
  predicate: (outcome: any) => boolean,
  timeoutMs: number
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const outcome = JSON.parse(new TextDecoder().decode(bytes));
      if (predicate(outcome)) {
        return outcome;
      }
    } catch {
      // ファイル未生成、次のポーリングへ
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return undefined;
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
