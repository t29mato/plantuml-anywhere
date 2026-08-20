import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "node_modules/**",
      ".vscode-test-web/**",
      "spikes/**",
      "dist/**",
    ],
  },
});
