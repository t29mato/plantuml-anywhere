import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.join(here, "ext");
const target = "file://" + path.join(here, "test.puml");
const userDataDir = path.join(here, "chrome-profile");

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    "--headless=new",
  ],
});

const page = await context.newPage();
await page.goto(target, { waitUntil: "load", timeout: 10000 });
await page.waitForTimeout(1000);

const markerText = await page.evaluate(() => {
  const el = document.getElementById("plantuml-spike-marker");
  return el ? el.textContent : null;
});

console.log("marker text:", markerText);
console.log("content script injected:", markerText === "INJECTED_OK");

await context.close();
