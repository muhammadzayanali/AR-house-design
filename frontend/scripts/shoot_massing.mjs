import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const out = path.resolve("../docs/qa/massing");
await mkdir(out, { recursive: true });

const houses = [
  "Italian Compact Villa",
  "Italian Family Villa",
  "Modern Family",
  "Cottage Compact",
];
const sizes = [
  { w: 390, h: 844, tag: "390x844", phone: true },
  { w: 1440, h: 900, tag: "1440x900", phone: false },
];

const browser = await chromium.launch({ channel: "chrome" });
const report = [];
for (const size of sizes) {
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    userAgent: size.phone
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  for (const name of houses) {
    for (const evening of [0, 1]) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const light = evening ? "evening" : "day";
      const url = `http://127.0.0.1:3000/qa/massing?name=${encodeURIComponent(name)}&evening=${evening}`;
      const started = Date.now();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("canvas", { timeout: 20000 });
      await page.waitForTimeout(size.phone ? 1200 : 2200);
      const stats = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        return {
          fps: window.__plotlineStats?.fps ?? null,
          triangles: window.__plotlineStats?.triangles ?? null,
          loadMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
        };
      });
      const file = `${slug}-${light}-${size.tag}.png`;
      await page.screenshot({ path: path.join(out, file) });
      report.push({ name, light, size: size.tag, file, elapsedMs: Date.now() - started, ...stats });
      console.log(file, stats.fps, stats.triangles);
    }
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
