import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.join(here, "ext");
const userDataDir = path.join(here, "chrome-profile4");

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    "--headless=new",
  ],
});

const page = await context.newPage();
await page.goto("chrome://extensions/", { waitUntil: "load" });
await page.waitForTimeout(1000);

// chrome://extensions はシャドウDOMで構成されているため、JS経由で辿る
const info = await page.evaluate(() => {
  function deepQueryAll(root, selector) {
    const results = [];
    const walk = (node) => {
      if (node.shadowRoot) {
        results.push(...node.shadowRoot.querySelectorAll(selector));
        node.shadowRoot.querySelectorAll("*").forEach(walk);
      }
      node.querySelectorAll ? node.querySelectorAll("*").forEach(walk) : null;
    };
    walk(root);
    return results;
  }
  const items = deepQueryAll(document, "extensions-item");
  return items.map((el) => el.outerHTML.slice(0, 300));
});

console.log("extensions-item count/preview:", JSON.stringify(info, null, 2));

await context.close();
