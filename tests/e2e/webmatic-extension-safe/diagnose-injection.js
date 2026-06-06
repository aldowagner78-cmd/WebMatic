"use strict";

const { chromium } = require("playwright");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_FILE = path.join(ROOT, "tests", "fixtures", "iapos-safe-page.html");
const PROFILE_DIR = path.join(os.tmpdir(), "webmatic-e2e-extension-diagnose-profile");
const PORT = 18085;

function startFixtureServer() {
  const fixtureDir = path.dirname(FIXTURE_FILE);
  const server = http.createServer((req, res) => {
    const rel = (req.url || "/").split("?")[0];
    const target = rel === "/" ? "iapos-safe-page.html" : rel.slice(1);
    const file = path.join(fixtureDir, target);
    try {
      const data = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, () => resolve(server));
  });
}

async function inspectPage(page, label, url) {
  const consoleErrors = [];
  const consoleAll = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`;
    consoleAll.push(line);
    if (msg.type() === "error") consoleErrors.push(line);
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  let navError = null;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
  } catch (e) {
    navError = String(e && e.message ? e.message : e);
  }

  await page.waitForTimeout(1500);

  const markers = await page.evaluate(() => {
    const panel = document.getElementById("webmatic-panel-root");
    const styleLink = document.getElementById("webmatic-style-link");
    return {
      panelExists: !!panel,
      panelDisplay: panel ? panel.style.display || "" : null,
      styleLinkExists: !!styleLink,
      styleLinkHref: styleLink ? styleLink.getAttribute("href") : null,
      hasFloatingRecorder: !!document.getElementById("webmatic-floating-recorder-global"),
      bodyLength: document.body ? document.body.innerHTML.length : 0
    };
  }).catch((e) => ({ evalError: String(e && e.message ? e.message : e) }));

  const extId = markers && markers.styleLinkHref
    ? ((markers.styleLinkHref.match(/chrome-extension:\/\/([^/]+)\//) || [])[1] || null)
    : null;

  return {
    label,
    url,
    navError,
    markers,
    extId,
    consoleErrors,
    pageErrors,
    consoleSample: consoleAll.slice(0, 15)
  };
}

async function main() {
  const out = {
    environment: {
      cwd: process.cwd(),
      root: ROOT,
      manifestPath: path.join(ROOT, "manifest.json"),
      iaposRealEnabled: process.env.IAPOS_E2E_REAL === "1"
    },
    extensionRuntime: {},
    runs: []
  };

  const server = await startFixtureServer();
  let ctx;

  try {
    if (fs.existsSync(PROFILE_DIR)) fs.rmSync(PROFILE_DIR, { recursive: true, force: true });

    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: "chromium",
      headless: false,
      args: [
        `--disable-extensions-except=${ROOT}`,
        `--load-extension=${ROOT}`,
        "--no-first-run",
        "--no-default-browser-check"
      ],
      viewport: { width: 1280, height: 860 }
    });

    await ctx.waitForEvent("page").catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));

    out.extensionRuntime = {
      pagesAtStartup: ctx.pages().map((p) => p.url()),
      backgroundPagesAtStartup: ctx.backgroundPages().map((p) => p.url()),
      serviceWorkersAtStartup: ctx.serviceWorkers().map((w) => w.url())
    };

    const page1 = await ctx.newPage();
    out.runs.push(await inspectPage(page1, "http-localhost", `http://localhost:${PORT}/iapos-safe-page.html`));

    const page2 = await ctx.newPage();
    out.runs.push(await inspectPage(page2, "http-127001", `http://127.0.0.1:${PORT}/iapos-safe-page.html`));

    const page3 = await ctx.newPage();
    out.runs.push(await inspectPage(page3, "file-protocol", `file://${FIXTURE_FILE}`));

    out.extensionRuntime = {
      ...out.extensionRuntime,
      pagesAfterRuns: ctx.pages().map((p) => p.url()),
      backgroundPagesAfterRuns: ctx.backgroundPages().map((p) => p.url()),
      serviceWorkersAfterRuns: ctx.serviceWorkers().map((w) => w.url())
    };
  } catch (e) {
    out.fatal = String(e && e.stack ? e.stack : e);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("diagnose-injection fatal", e && e.stack ? e.stack : e);
  process.exit(1);
});
