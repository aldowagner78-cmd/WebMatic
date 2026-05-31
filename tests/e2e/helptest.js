"use strict";
const { chromium } = require("playwright");
const path = require("path");
const os = require("os");
const fs = require("fs");
const http = require("http");

const ROOT    = path.resolve(__dirname, "../..");
const PROFILE = path.join(os.tmpdir(), "webmatic-helptest");
const EDGE    = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const testDir = path.join(ROOT, "test-page");

if (fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });

const srv = http.createServer((req, res) => {
  const f = path.join(testDir, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  try { const d = fs.readFileSync(f); res.writeHead(200, {"Content-Type":"text/html"}); res.end(d); }
  catch (e2) { if (!res.headersSent) { res.writeHead(404); res.end(); } }
});

(async () => {
  await new Promise((ok, fail) => { srv.on("error", fail); srv.listen(18082, ok); });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, executablePath: EDGE,
    args: ["--disable-extensions-except=" + ROOT, "--load-extension=" + ROOT, "--no-first-run"],
    viewport: { width: 1280, height: 800 }
  });

  ctx.backgroundPages().forEach(bg => {
    bg.on("console", msg => console.log("[BG-" + msg.type() + "]", msg.text().slice(0, 150)));
  });
  ctx.on("backgroundpage", bg => {
    console.log("BG connected:", bg.url());
    bg.on("console", msg => console.log("[BG-" + msg.type() + "]", msg.text().slice(0, 150)));
  });

  const page = await ctx.newPage();
  page.on("console", msg => console.log("[PAGE-" + msg.type() + "]", msg.text().slice(0, 150)));
  await page.goto("http://localhost:18082/", { waitUntil: "load", timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));

  // Get extension ID
  const extId = await page.evaluate(() => {
    const link = document.getElementById("webmatic-style-link");
    if (!link) return null;
    const m = link.href.match(/chrome-extension:\/\/([^\/]+)\//);
    return m ? m[1] : null;
  });
  console.log("ExtID:", extId);

  if (!extId) {
    console.log("ERROR: panel no inyectado!");
    await ctx.close(); srv.close(); process.exit(1);
  }

  // 1. Try opening help.html directly
  const helpUrl = "chrome-extension://" + extId + "/src/help/help.html";
  console.log("Help URL:", helpUrl);
  const helpPage = await ctx.newPage();
  helpPage.on("console", msg => console.log("[HELP-" + msg.type() + "]", msg.text().slice(0, 150)));
  const navResult = await helpPage.goto(helpUrl, { waitUntil: "load", timeout: 10000 }).catch(e => e.message);
  console.log("Help direct nav result:", typeof navResult === "string" ? navResult : helpPage.url());
  const helpTitle = await helpPage.title().catch(() => "err");
  console.log("Help page title:", helpTitle);
  await new Promise(r => setTimeout(r, 1500));
  await helpPage.close();

  // 2. Click the ? button
  const btnFound = await page.evaluate(() => {
    const btn = document.querySelector('[data-action="help"]');
    console.log("Help btn HTML:", btn ? btn.outerHTML.slice(0, 80) : "NOT FOUND");
    return !!btn;
  });
  console.log("Help button found:", btnFound);

  const tabsBefore = ctx.pages().length;
  console.log("Tabs before click:", tabsBefore);

  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="help"]');
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 3000));
  console.log("Tabs after click:", ctx.pages().length);
  ctx.pages().forEach((p, i) => console.log("  tab[" + i + "]:", p.url()));

  await ctx.close();
  srv.close();
  console.log("DONE");
})().catch(e => { console.error("FATAL:", e.message); srv.close(); process.exit(1); });
