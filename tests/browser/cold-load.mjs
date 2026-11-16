// 20 Mbps / 100 ms RTT / fresh context. Default: frozen local dist with gzip.
// --private-site reads {url,token,expectedMain} from stdin only and measures
// actual private HTTPS hosting. Credentials never enter logs or report files.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative, extname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { cpus, totalmem } from "node:os";

if (process.env.PERF_ISOLATED !== "1")
  throw new Error(
    "Wait for other browser/GPU work to finish, then set PERF_ISOLATED=1.",
  );
let privateSite = null;
if (process.argv.includes("--private-site")) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  privateSite = JSON.parse(input);
  input = "";
  if (
    !privateSite.token ||
    new URL(privateSite.url).protocol !== "https:" ||
    !/^index-[\w-]+\.js$/.test(privateSite.expectedMain)
  )
    throw new Error(
      "Expected private HTTPS origin, in-memory token and exact main bundle.",
    );
}
const artifactName = process.env.SITE_QA_ARTIFACT || (privateSite ? "cold-load-deployed" : "cold-load");
if (!/^[a-z0-9_-]{1,80}$/.test(artifactName)) throw new Error("Invalid QA artifact name.");
const root = resolve("dist"), output = resolve("tests/browser/artifacts", artifactName);
mkdirSync(output, { recursive: true });
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};
const served = [];
const server = privateSite
  ? null
  : createServer(async (req, res) => {
      try {
        const path = decodeURIComponent(
            new URL(req.url, "http://localhost").pathname,
          ),
          file = resolve(root, "." + (path === "/" ? "/index.html" : path)),
          rel = relative(root, file);
        if (
          rel.startsWith("..") ||
          rel.includes(":") ||
          !(await stat(file)).isFile()
        ) {
          res.writeHead(404);
          res.end();
          return;
        }
        const bytes = await readFile(file),
          extension = extname(file),
          gzip =
            /gzip/.test(req.headers["accept-encoding"] || "") &&
            [".html", ".js", ".css", ".json", ".svg", ".glb"].includes(
              extension,
            ),
          body = gzip ? gzipSync(bytes) : bytes;
        served.push({
          path,
          bodyBytes: body.byteLength,
          uncompressedBytes: bytes.byteLength,
          gzip,
        });
        res.writeHead(200, {
          "Content-Type": mime[extension] || "application/octet-stream",
          "Content-Length": body.byteLength,
          "Cache-Control": "no-store",
          ...(gzip
            ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" }
            : {}),
        });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
if (server)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = privateSite
  ? new URL(privateSite.url).origin
  : `http://127.0.0.1:${server.address().port}`;
const report = {
  date: new Date().toISOString(),
  url,
  transport: privateSite
    ? "Actual private HTTPS deployment, same-origin in-memory authorization"
    : "Local HTTP, actual gzip responses from frozen dist; HTTPS hosting not measured",
  network: {
    downloadMbps: 20,
    uploadMbps: 5,
    latencyMs: 100,
    cacheDisabled: true,
  },
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  cpu: cpus()[0]?.model,
  ramGiB: totalmem() / 2 ** 30,
  completed: false,
  errors: [],
  limits: [
    "This measures one cold context on the reference PC, not a population distribution.",
    "User think time is excluded; actual mission picker and assembly buttons are clicked immediately.",
    "GMAT and remote APIs are not used. The separately entered control room and M03 chunks are excluded from first-assembly critical bytes.",
    privateSite
      ? "The owner-authenticated session bypasses interactive sign-in; sign-in and platform access-control latency are not included. Network shaping is browser CDP emulation."
      : "Local HTTP with real gzip and CDP throttling is not evidence of deployed HTTPS authentication, CDN or TLS behavior.",
  ],
};
let browser;
const redact = (value) =>
  privateSite?.token
    ? String(value).split(privateSite.token).join("[redacted]")
    : String(value);
const persist = () =>
  writeFileSync(
    join(output, "report.json"),
    redact(JSON.stringify(report, null, 2)),
  );
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--disable-background-timer-throttling"],
  });
  report.browser = browser.version();
  const context = await browser.newContext({
      viewport: report.viewport,
      deviceScaleFactor: 1,
    }),
    page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  if (privateSite) {
    // CDP header overrides apply only to this request, not later redirect hops.
    // Unlike route.fetch(), this preserves the browser's network throttling.
    cdp.on("Fetch.requestPaused", (event) => {
      const headers = Object.entries(event.request.headers)
        .filter(([name]) => name.toLowerCase() !== "oai-sites-authorization")
        .map(([name, value]) => ({ name, value: String(value) }));
      if (new URL(event.request.url).origin === url)
        headers.push({
          name: "OAI-Sites-Authorization",
          value: "Bearer " + privateSite.token,
        });
      void cdp
        .send("Fetch.continueRequest", { requestId: event.requestId, headers })
        .catch(() =>
          report.errors.push("Private request interception failed."),
        );
    });
    await cdp.send("Fetch.enable", {
      patterns: [{ urlPattern: "*", requestStage: "Request" }],
    });
  }
  const responseJobs = [];
  context.on("response", (response) => {
    if (new URL(response.url()).origin !== url) return;
    responseJobs.push(
      (async () => {
        await response.finished();
        const sizes = await response.request().sizes();
        return {
          path: new URL(response.url()).pathname,
          status: response.status(),
          bodyBytes: sizes.responseBodySize,
          headerBytes: sizes.responseHeadersSize,
        };
      })(),
    );
  });
  page.on("pageerror", (e) => report.errors.push(e.stack || e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  const wire = new Map();
  cdp.on("Network.responseReceived", (e) => {
    wire.set(e.requestId, {
      url: e.response.url,
      status: e.response.status,
      fromDiskCache: e.response.fromDiskCache,
      headers: Object.fromEntries(
        Object.entries(e.response.headers).filter(([name]) =>
          [
            "content-type",
            "content-encoding",
            "content-length",
            "cache-control",
          ].includes(name.toLowerCase()),
        ),
      ),
      encodedBytes: 0,
    });
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = wire.get(e.requestId);
    if (r) r.encodedBytes = e.encodedDataLength;
  });
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 100,
    downloadThroughput: 20e6 / 8,
    uploadThroughput: 5e6 / 8,
  });
  const start = performance.now();
  await page.goto(url + "/?qa");
  await page.waitForFunction(
    () => window.__game?.getState().assetsReady,
    null,
    { timeout: 60000 },
  );
  report.campusAssetsReadyMs = performance.now() - start;
  await page.locator('[data-action="missions"]').click();
  await page.locator('[data-design-profile="hardware"]').click();
  await page.locator('[data-mission="earth"]').click();
  await page.waitForFunction(
    () => {
      const g = window.__game,
        s = g.getState();
      return (
        s.mode === "build" &&
        s.assetsReady &&
        !s.pending &&
        s.revision === s.acceptedRevision &&
        !g.scene.tween &&
        g.scene.renderer.info.render.calls > 0
      );
    },
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  report.firstAssemblyReadyMs = performance.now() - start;
  report.wireAtFirstAssembly = [...wire.values()].filter((r) =>
    r.url.startsWith(url),
  );
  const measuredResponses = await Promise.allSettled(responseJobs.slice());
  report.unmeasuredResponseCount = measuredResponses.filter(
    (r) => r.status === "rejected",
  ).length;
  report.responseSizesAtFirstAssembly = measuredResponses
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  report.serverResponsesAtFirstAssembly = served.slice();
  report.firstAssemblyEncodedMiB =
    Math.max(
      report.wireAtFirstAssembly.reduce((sum, r) => sum + r.encodedBytes, 0),
      report.responseSizesAtFirstAssembly.reduce(
        (sum, r) => sum + r.bodyBytes + r.headerBytes,
        0,
      ),
      served.reduce((sum, r) => sum + r.bodyBytes, 0),
    ) /
    2 ** 20;
  report.metadata = await page.evaluate(() => {
    const s = window.__game.scene,
      gl = s.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      gpu: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      quality: s.quality,
      bundles: Array.from(document.scripts)
        .filter((s) => s.src)
        .map((s) => s.src),
      state: window.__game.getState().mode,
      model: window.__game.getState().design.hardwareVersion,
      resources: performance
        .getEntriesByType("resource")
        .map((r) => ({
          name: r.name,
          transferBytes: r.transferSize,
          encodedBodyBytes: r.encodedBodySize,
          decodedBodyBytes: r.decodedBodySize,
          durationMs: r.duration,
        })),
    };
  });
  report.criteria = {
    firstAssemblyWithin15Seconds: report.firstAssemblyReadyMs <= 15000,
    essentialEncodedAtMost15MiB: report.firstAssemblyEncodedMiB <= 15,
    allResponseBytesMeasured: report.unmeasuredResponseCount === 0,
    zeroErrors: report.errors.length === 0,
    noFailedResponses:
      report.wireAtFirstAssembly.every((r) => r.status < 400) &&
      report.responseSizesAtFirstAssembly.every((r) => r.status < 400),
    emptyDiskCache: report.wireAtFirstAssembly.every((r) => !r.fromDiskCache),
  };
  if (privateSite) {
    report.expectedMain = privateSite.expectedMain;
    report.criteria.expectedRelease = report.metadata.bundles.some((name) =>
      name.endsWith("/assets/" + privateSite.expectedMain),
    );
    if (!report.criteria.expectedRelease)
      throw new Error("Cold load reached another release bundle.");
  }
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.screenshot({
    path: join(output, "first-hardware-assembly-1920x1080.png"),
  });
  report.completed = true;
  persist();
  console.log(
    JSON.stringify({
      completed: true,
      firstAssemblyReadyMs: report.firstAssemblyReadyMs,
      firstAssemblyEncodedMiB: report.firstAssemblyEncodedMiB,
      criteria: report.criteria,
      output,
    }),
  );
  if (report.errors.length || !report.criteria.noFailedResponses)
    throw new Error("Cold-load resource or application error; inspect report.");
} catch (error) {
  report.failure = redact(error.stack || String(error));
  persist();
  if (privateSite) throw new Error(redact(error.message || String(error)));
  throw error;
} finally {
  if (privateSite) privateSite.token = "";
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
