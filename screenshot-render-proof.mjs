import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
await page.goto("file://" + process.cwd() + "/test-fixtures/vscode-web-render-proof.html");
await page.waitForTimeout(300);
await page.screenshot({ path: "test-fixtures/vscode-web-preview.png" });
await browser.close();
console.log("done");
