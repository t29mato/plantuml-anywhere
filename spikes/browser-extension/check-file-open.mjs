import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = "file://" + path.join(here, "test.puml");

const browser = await chromium.launch();
const page = await browser.newPage();

let downloadStarted = false;
page.on("download", (d) => {
  downloadStarted = true;
  console.log("DOWNLOAD_EVENT:", d.suggestedFilename());
});

try {
  const response = await page.goto(target, { waitUntil: "load", timeout: 10000 });
  console.log("NAVIGATION_OK");
  console.log("response headers:", response ? JSON.stringify(response.headers()) : "null response");
} catch (e) {
  console.log("NAVIGATION_ERROR:", e.message);
}

await page.waitForTimeout(1000);

console.log("downloadStarted:", downloadStarted);
console.log("current URL:", page.url());

let bodyText = null;
try {
  bodyText = await page.evaluate(() => document.body ? document.body.innerText : null);
} catch (e) {
  console.log("evaluate error:", e.message);
}
console.log("body innerText (先頭200文字):", bodyText ? bodyText.slice(0, 200) : bodyText);

await browser.close();
