import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

// content-loader.js から動的import()で読み込まれる重量級レンダラ。
// dynamic import() で読み込まれるモジュールは常にESMとして評価されるため format: "esm"。
// "url" は @plantuml/core の viz-global.js がNode向けフォールバック分岐で参照するが、
// document/locationが定義されているページ(このスクリプトが実際に動く場所)では
// 呼ばれない(docs/design/spike-report.md参照)。ビルド時に解決できないだけなのでexternal指定。
await esbuild.build({
  entryPoints: ["src/browser-extension-renderer/index.ts"],
  bundle: true,
  sourcemap: true,
  minify: !watch,
  format: "esm",
  external: ["url"],
  platform: "browser",
  target: "es2022",
  outfile: "browser-extension/dist/renderer.js",
});

console.log("build done: browser-extension/dist/renderer.js");
