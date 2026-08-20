import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch();
const page = await browser.newPage();

const requests = [];
page.on("request", (req) => {
  requests.push({ url: req.url(), resourceType: req.resourceType() });
});

const t0 = Date.now();
await page.goto("http://localhost:8933/browser-class.html", { waitUntil: "load" });

// __SPIKE_RESULT__ がセットされるまで待つ(最大30秒)
await page.waitForFunction(() => window.__SPIKE_RESULT__ !== undefined, { timeout: 30000 });
const elapsedMs = Date.now() - t0;

const result = await page.evaluate(() => window.__SPIKE_RESULT__);

console.log("ELAPSED_MS:", elapsedMs);
console.log("OK:", result.ok);
if (!result.ok) {
  console.log("ERROR:", result.error);
} else {
  console.log("SVG_LENGTH:", result.svg.length);
  writeFileSync(new URL("./class-diagram.svg", import.meta.url), result.svg);
}

console.log("\n=== ネットワークリクエスト一覧 ===");
for (const r of requests) {
  console.log(r.resourceType, r.url);
}

await browser.close();
process.exit(result.ok ? 0 : 1);
