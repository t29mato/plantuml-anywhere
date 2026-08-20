import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const common = {
  bundle: true,
  sourcemap: true,
  minify: !watch,
  format: "cjs",
  // "url" は @plantuml/core の viz-global.js がNode向けフォールバック分岐で参照するが、
  // document/locationが定義されている環境(webview-runtime.jsが実際に動くWebview)では
  // 呼ばれない(docs/design/spike-report.md参照)。ビルド時に解決できないだけなのでexternal指定。
  external: ["url"],
  platform: "browser",
  target: "es2022",
};

// 拡張ホスト本体。Web版(vscode.dev/github.dev)はWeb Worker、デスクトップ版はNodeで動く。
// @plantuml/coreは含まない(拡張ホストにはwindow/DOMが無く動かせないため、レンダリングは
// webview-runtime.js側で行う。docs/design/step2-vscode-extension-design.md参照)。
const extensionBuild = esbuild.build({
  ...common,
  entryPoints: ["src/extension.ts"],
  external: [...common.external, "vscode"],
  outfile: "dist/extension.js",
});

// Webview内で動くレンダリング専用スクリプト。@plantuml/core(WASM込み)をここに閉じ込める。
const webviewRuntimeBuild = esbuild.build({
  ...common,
  entryPoints: ["src/webview-runtime/index.ts"],
  outfile: "dist/webview-runtime.js",
});

await Promise.all([extensionBuild, webviewRuntimeBuild]);
console.log("build done: dist/extension.js, dist/webview-runtime.js");
