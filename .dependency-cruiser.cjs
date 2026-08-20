/**
 * レイヤー間の許可依存を機械的に強制する(CLAUDE.md「依存方向の機械的強制」)。
 * 依存の向きは常に内側へ: entrypoints/vscode → infrastructure → application → domain
 * (docs/design/architecture.md 参照)。
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-must-not-depend-on-outer-layers",
      comment:
        "domain/ はフレームワーク・vscode・@plantuml/core・application/infrastructureに依存してはならない",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/(application|infrastructure|extension\\.ts)" },
    },
    {
      name: "domain-must-not-depend-on-vscode-or-plantuml-core",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "node_modules/(@types/vscode|@plantuml/core)" },
    },
    {
      name: "application-must-not-depend-on-infrastructure",
      comment: "application/ は domain/ のポート(interface)のみに依存する",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "application-must-not-depend-on-vscode-or-plantuml-core",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "node_modules/(@types/vscode|@plantuml/core)" },
    },
    {
      name: "infrastructure-vscode-must-not-depend-on-plantuml-core",
      comment:
        "infrastructure/vscode/ は vscode APIにのみ依存する。@plantuml/coreは拡張ホストに" +
        " windowが無く動かないため、webview-runtime/ 側に置く(docs/design/step2-vscode-extension-design.md参照)",
      severity: "error",
      from: { path: "^src/infrastructure/vscode" },
      to: { path: "node_modules/@plantuml/core" },
    },
    {
      name: "infrastructure-browser-extension-must-not-depend-on-vscode-or-plantuml-core",
      comment:
        "infrastructure/browser-extension/ はDOM APIにのみ依存する。vscodeには依存しない" +
        "(Chrome拡張なので当然)。@plantuml/coreも直接importしない(共有のPlantUmlCoreRenderer" +
        "経由でbrowser-extension-renderer/が組み立てる。docs/design/browser-extension-design.md参照)",
      severity: "error",
      from: { path: "^src/infrastructure/browser-extension" },
      to: { path: "node_modules/(@types/vscode|@plantuml/core)" },
    },
    {
      name: "no-circular",
      comment: "循環依存を禁止する",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
