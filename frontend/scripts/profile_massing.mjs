import { chromium } from "playwright";

const name = process.argv[2] || "Italian Family Villa";
const evening = process.argv[3] || "0";
const url =
  "http://127.0.0.1:3000/qa/massing?name=" +
  encodeURIComponent(name) +
  "&evening=" +
  evening +
  "&debug=1";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await page.addInitScript(() => {
  const wrap = (proto) => {
    if (!proto || proto.__wrapped) return;
    const drawElements = proto.drawElements;
    const drawArrays = proto.drawArrays;
    proto.drawElements = function (...args) {
      window.__draws = (window.__draws || 0) + 1;
      return drawElements.apply(this, args);
    };
    proto.drawArrays = function (...args) {
      window.__draws = (window.__draws || 0) + 1;
      return drawArrays.apply(this, args);
    };
    proto.__wrapped = true;
  };
  wrap(WebGL2RenderingContext.prototype);
  wrap(WebGLRenderingContext.prototype);
});
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("canvas");
await page.waitForTimeout(4000);
const result = await page.evaluate(async () => {
  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const samples = [];
  let last = performance.now();
  let lastDraws = window.__draws || 0;
  await new Promise((resolve) => {
    const started = performance.now();
    const tick = (now) => {
      const draws = window.__draws || 0;
      samples.push({
        dt: now - last,
        draws: draws - lastDraws,
      });
      last = now;
      lastDraws = draws;
      if (now - started >= 2000) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const dts = samples.map((s) => s.dt).sort((a, b) => a - b);
  const drawList = samples.map((s) => s.draws).sort((a, b) => a - b);
  const mid = Math.floor(dts.length / 2);
  return {
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "hidden",
    css: [canvas.clientWidth, canvas.clientHeight],
    buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    dpr: +(gl.drawingBufferWidth / canvas.clientWidth).toFixed(2),
    frames: samples.length,
    fps: Math.round((samples.length * 1000) / samples.reduce((s, x) => s + x.dt, 0)),
    medianMs: +dts[mid].toFixed(2),
    p95Ms: +dts[Math.floor(dts.length * 0.95)].toFixed(2),
    medianDraws: drawList[mid],
    maxDraws: drawList[drawList.length - 1],
    triangles: window.__plotlineStats?.triangles ?? null,
  };
});
console.log(JSON.stringify(result, null, 2));
if (evening === "0") {
  const hitch = await page.evaluate(async () => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Evening"));
    let worst = 0;
    let frames = 0;
    const started = performance.now();
    button?.click();
    await new Promise((resolve) => {
      const tick = (now) => {
        frames += 1;
        const dt = now - (tick.last || now);
        tick.last = now;
        if (dt > worst) worst = dt;
        if (now - started >= 1500) resolve();
        else requestAnimationFrame(tick);
      };
      tick.last = performance.now();
      requestAnimationFrame(tick);
    });
    return { worstMs: Math.round(worst), frames };
  });
  console.log("evening-toggle", JSON.stringify(hitch));
}
await browser.close();
