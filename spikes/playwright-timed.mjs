import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:8933/browser-class-timed.html", { waitUntil: "load" });
await page.waitForFunction(() => window.__SPIKE_RESULT__ !== undefined, { timeout: 30000 });
const t = await page.evaluate(() => ({
  t0: window.__T0__,
  scriptsLoaded: window.__T_SCRIPTS_LOADED__,
  moduleImported: window.__T_MODULE_IMPORTED__,
  renderCall: window.__T_RENDER_CALL__,
  renderDone: window.__T_RENDER_DONE__,
}));
console.log("同期スクリプト(viz-global.js)読込完了まで:", (t.scriptsLoaded - t.t0).toFixed(1), "ms");
console.log("ESM(plantuml.js)import完了まで:", (t.moduleImported - t.scriptsLoaded).toFixed(1), "ms");
console.log("render呼び出しまで:", (t.renderCall - t.moduleImported).toFixed(1), "ms");
console.log("render完了まで(WASM初期化+レイアウト計算含む):", (t.renderDone - t.renderCall).toFixed(1), "ms");
console.log("合計(スクリプト読込〜SVG完成):", (t.renderDone - t.t0).toFixed(1), "ms");
await browser.close();
