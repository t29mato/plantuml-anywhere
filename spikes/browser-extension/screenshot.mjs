import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.join(here, "ext");
const target = "file://" + path.join(here, "test.puml");
const userDataDir = path.join(here, "chrome-profile3");

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    "--headless=new",
  ],
  viewport: { width: 300, height: 500 },
});

const page = await context.newPage();
await page.goto(target, { waitUntil: "load", timeout: 15000 });
await page.waitForSelector("#plantuml-spike-result svg", { timeout: 10000 });
await page.locator("#plantuml-spike-result svg").screenshot({ path: path.join(here, "class-diagram-from-extension.png") });

await context.close();
