"use strict";
const { chromium } = require("playwright");
const path = require("path");
const os   = require("os");
const fs   = require("fs");
const http = require("http");

const ROOT     = path.resolve(__dirname, "../..");
const PROFILE  = path.join(os.tmpdir(), "webmatic-diag2");
const EDGE     = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT     = 18081;

if (fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });

const testPageDir = path.join(ROOT, "test-page");
const srv = http.createServer((req, res) => {
  const relPath = req.url.split("?")[0];
  const f = path.join(testPageDir, relPath === "/" ? "index.html" : relPath);
  try {
    const data = fs.readFileSync(f);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  } catch {
    if (!res.headersSent) { res.writeHead(404); res.end("not found"); }
  }
});

(async () => {
  await new Promise((ok, fail) => { srv.on("error", fail); srv.listen(PORT, ok); });
  console.log("Server on", PORT);

  // Listen for background pages BEFORE launch returns
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless      : false,
    executablePath: EDGE,
    args: [
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      "--no-first-run", "--disable-default-apps",
    ],
    viewport: { width: 1280, height: 800 },
  });

  ctx.on("backgroundpage", (bg) => console.log("BG EVENT fired:", bg.url()));

  console.log("Browser launched.");
  await new Promise((r) => setTimeout(r, 3000));
  console.log("Background pages (after 3s):", ctx.backgroundPages().length);
  ctx.backgroundPages().forEach((bg, i) => console.log(`  BG[${i}]:`, bg.url()));

  // Open a NEW page (not the initial blank tab)
  const page = await ctx.newPage();
  page.on("console", (msg) => {
    if (msg.type() !== "verbose") {
      console.log(`  [page:${msg.type()}]`, msg.text().slice(0, 150));
    }
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 3000));

  console.log("\nBackground pages (after page load):", ctx.backgroundPages().length);

  // Check DOM state
  const info = await page.evaluate(() => {
    const link  = document.getElementById("webmatic-style-link");
    const panel = document.getElementById("webmatic-panel-root");
    const extId = link
      ? (link.href.match(/chrome-extension:\/\/([^/]+)\//) || [])[1]
      : null;
    return {
      linkExists   : !!link,
      panelExists  : !!panel,
      panelDisplay : panel ? panel.style.display : "n/a",
      extId,
    };
  });
  console.log("\nDOM info:", JSON.stringify(info, null, 2));

  // ── Attempt: navigate to generated background page URL ──
  if (info.extId) {
    const bgUrl = `chrome-extension://${info.extId}/_generated_background_page.html`;
    console.log("\nOpening background page URL:", bgUrl);

    const bgPage = await ctx.newPage();
    const gotoErr = await bgPage.goto(bgUrl, { waitUntil: "load", timeout: 8000 }).catch((e) => e.message);
    console.log("BG goto result:", gotoErr || "OK");
    console.log("BG page url:", bgPage.url());

    // Check chrome.tabs is accessible
    const hasChromeAPI = await bgPage.evaluate(
      () => typeof chrome !== "undefined" && typeof chrome.tabs !== "undefined"
    ).catch(() => false);
    console.log("chrome.tabs available:", hasChromeAPI);

    if (hasChromeAPI) {
      const tabId = await bgPage.evaluate(
        (port) => new Promise((r) =>
          chrome.tabs.query({ url: `http://localhost:${port}/*` }, (tabs) =>
            r(tabs && tabs[0] ? tabs[0].id : null)
          )
        ),
        PORT
      ).catch((e) => { console.log("query err:", e.message); return null; });
      console.log("Target tab ID:", tabId);

      if (tabId) {
        const sendResult = await bgPage.evaluate(
          (id) => new Promise((r) =>
            chrome.tabs.sendMessage(id, { type: "OPEN_PANEL" }, () => {
              void chrome.runtime.lastError;
              r("sent");
            })
          ),
          tabId
        ).catch((e) => e.message);
        console.log("Send OPEN_PANEL:", sendResult);
        await new Promise((r) => setTimeout(r, 1000));

        const panelDisplay = await page.evaluate(
          () => document.getElementById("webmatic-panel-root")?.style.display ?? "gone"
        );
        console.log("Panel display after OPEN_PANEL:", panelDisplay);
      }
    }

    await bgPage.close();
  }

  await new Promise((r) => setTimeout(r, 3000));
  await ctx.close();
  srv.close();
  console.log("\nDone.");
})().catch((e) => {
  console.error("FATAL:", e.stack);
  srv.close();
  process.exit(1);
});
