import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 300, height: 500 } });
await page.goto("http://localhost:8933/browser-class.html", { waitUntil: "load" });
await page.waitForFunction(() => window.__SPIKE_RESULT__ !== undefined, { timeout: 30000 });
await page.locator("#out svg").screenshot({ path: "class-diagram.png" });
await browser.close();
