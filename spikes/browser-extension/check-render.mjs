import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.join(here, "ext");
const target = "file://" + path.join(here, "test.puml");
const userDataDir = path.join(here, "chrome-profile2");

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    "--headless=new",
  ],
});

const page = await context.newPage();
const consoleMsgs = [];
page.on("console", (m) => consoleMsgs.push(m.text()));
page.on("pageerror", (e) => consoleMsgs.push("PAGEERROR: " + e.message));

await page.goto(target, { waitUntil: "load", timeout: 15000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(() => {
  const ok = document.getElementById("plantuml-spike-result");
  const err = document.getElementById("plantuml-spike-error");
  return {
    hasResult: !!ok,
    resultHtmlLength: ok ? ok.innerHTML.length : 0,
    hasError: !!err,
    errorText: err ? err.textContent : null,
    title: document.title,
  };
});

console.log("result:", JSON.stringify(result, null, 2));
console.log("console messages:", consoleMsgs.slice(0, 20));

if (result.hasResult) {
  const svg = await page.evaluate(() => document.getElementById("plantuml-spike-result").innerHTML);
  const fs = await import("node:fs");
  fs.writeFileSync(path.join(here, "class-diagram-from-extension.svg"), svg);
  console.log("SVG saved.");
}

await context.close();
