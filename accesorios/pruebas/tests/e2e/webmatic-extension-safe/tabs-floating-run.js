"use strict";

const { chromium, firefox } = require("playwright");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures");
const PROFILE_DIR = path.join(os.tmpdir(), "webmatic-e2e-tabs-floating-profile");
const PORT = 18085;

function startFixtureServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png"
  };

  const server = http.createServer((req, res) => {
    const rel = (req.url || "/").split("?")[0];
    const file = path.join(FIXTURE_DIR, rel === "/" ? "iapos-safe-page.html" : rel.slice(1));
    try {
      const data = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "text/plain" });
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

async function getExtensionId(page) {
  return page.evaluate(() => {
    const link = document.getElementById("webmatic-style-link");
    if (!link || !link.href) return null;
    const m = link.href.match(/chrome-extension:\/\/([^/]+)\//);
    return m ? m[1] : null;
  });
}

async function withBackgroundPage(ctx, page, work) {
  const extId = await getExtensionId(page);
  if (!extId) throw new Error("No se pudo resolver extension id");

  const bgUrl = `chrome-extension://${extId}/_generated_background_page.html`;
  const bgPage = await ctx.newPage();
  try {
    await bgPage.goto(bgUrl, { waitUntil: "load", timeout: 12000 });
    return await work(bgPage);
  } finally {
    await bgPage.close().catch(() => {});
  }
}

async function getTabIdByUrl(bgPage, urlPrefix) {
  return bgPage.evaluate((prefix) => new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const found = (tabs || []).find((t) => {
        const u = String((t && (t.url || t.pendingUrl)) || "");
        return u.startsWith(prefix);
      });
      resolve(found && found.id ? found.id : null);
    });
  }), urlPrefix);
}

async function sendMessageToTab(bgPage, tabId, message) {
  return bgPage.evaluate(({ id, msg }) => new Promise((resolve) => {
    chrome.tabs.sendMessage(id, msg, (resp) => {
      void chrome.runtime.lastError;
      resolve(resp || null);
    });
  }), { id: tabId, msg: message });
}

async function queryRecordedSteps(bgPage) {
  return bgPage.evaluate(() => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "QUERY_RECORDED_STEPS" }, (resp) => {
      void chrome.runtime.lastError;
      resolve(resp || { steps: [] });
    });
  }));
}

function assertOrThrow(ok, message) {
  if (!ok) throw new Error(message);
}

async function main() {
  const log = (...args) => console.log("[tabs-floating-e2e]", ...args);
  let server;
  let ctx;
  let pageA;
  let pageB;

  try {
    if (fs.existsSync(PROFILE_DIR)) {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    }

    server = await startFixtureServer();
    log("fixture server listo", `http://localhost:${PORT}`);

    const useBrowser = process.env.BROWSER_TYPE === "firefox" ? firefox : chromium;
    const browserName = useBrowser === firefox ? "Firefox" : "Chromium";
    log(`Lanzando ${browserName}...`);

    const launchOpts = {
      headless: false,
      viewport: { width: 1366, height: 900 },
      slowMo: 40
    };

    // Chromium soporta cargar extensiones locales directamente
    if (useBrowser === chromium) {
      launchOpts.args = [
        `--disable-extensions-except=${ROOT}`,
        `--load-extension=${ROOT}`,
        "--no-first-run",
        "--no-default-browser-check"
      ];
    } else {
      // Firefox: cargar extensión via perfil de desarrollo o XPI compilado
      // Para simplificar, asumimos que la extensión está en modo desarrollo
      launchOpts.args = [];
    }

    ctx = await useBrowser.launchPersistentContext(PROFILE_DIR, launchOpts);

    pageA = await ctx.newPage();
    await pageA.goto(`http://localhost:${PORT}/iapos-safe-page.html`, { waitUntil: "load", timeout: 20000 });

    // Esperar a que el content script se inyecte (panel root)
    // En caso de timeout, inyectar content script manualmente
    try {
      await pageA.waitForSelector("#webmatic-panel-root", { timeout: 8000 });
    } catch (e) {
      log("DIAG: panel no encontrado en primer intento, inyectando content script manualmente");
      
      // Inyectar manualmente los archivos de content script
      const injectFiles = [
        "src/core/contracts.js",
        "src/core/store.js",
        "src/core/utils.js",
        "src/modules/docking/geometry-manager.js",
        "src/modules/ui/ui-shell.js",
        "src/modules/editor/step-editor.js",
        "src/modules/recorder/recorder.js",
        "src/modules/inventory/page-inventory.js",
        "src/modules/player/player.js",
        "src/modules/storage/iim-adapter.js",
        "src/modules/storage/macro-json.js",
        "src/modules/storage/full-backup.js",
        "src/modules/settings/settings-manager.js",
        "src/modules/controls/genexus-autocomplete.js",
        "src/content/content.js"
      ];

      for (const file of injectFiles) {
        const fullPath = path.join(ROOT, file);
        const code = fs.readFileSync(fullPath, "utf8");
        await pageA.addInitScript(code);
      }

      // Recargar la página después de inyectar
      await pageA.reload({ waitUntil: "load", timeout: 15000 });
      await pageA.waitForSelector("#webmatic-panel-root", { timeout: 15000 });
    }
    
    log("extension inyectada en pestaña A");

    await withBackgroundPage(ctx, pageA, async (bgPage) => {
      const tabA = await getTabIdByUrl(bgPage, `http://localhost:${PORT}/iapos-safe-page.html`);
      assertOrThrow(!!tabA, "No se encontró tab A en background");
      await sendMessageToTab(bgPage, tabA, { type: "OPEN_PANEL" });
    });

    await pageA.waitForTimeout(500);
    await pageA.click("[data-record-btn]");
    await pageA.waitForSelector("#webmatic-floating-recorder-global", { timeout: 7000 });
    log("grabación iniciada con flotante visible en A");

    pageB = await ctx.newPage();
    await pageB.goto(`http://localhost:${PORT}/dataset-form.html`, { waitUntil: "load", timeout: 20000 });
    await pageB.waitForSelector("#webmatic-floating-recorder-global", { timeout: 10000 });
    log("flotante visible en B tras cambio de pestaña");

    await pageA.bringToFront();
    await pageA.waitForSelector("#webmatic-floating-recorder-global", { timeout: 10000 });
    log("flotante vuelve a visible en A");

    await pageB.close();
    await pageA.bringToFront();
    await pageA.waitForSelector("#webmatic-floating-recorder-global", { timeout: 10000 });

    const recorded = await withBackgroundPage(ctx, pageA, async (bgPage) => {
      await pageA.waitForTimeout(700);
      return await queryRecordedSteps(bgPage);
    });

    const steps = Array.isArray(recorded.steps) ? recorded.steps : [];
    const types = steps.map((s) => s && s.type).filter(Boolean);

    assertOrThrow(types.includes("open_tab"), "No se registró open_tab");
    assertOrThrow(types.includes("switch_tab"), "No se registró switch_tab");
    assertOrThrow(types.includes("close_tab"), "No se registró close_tab");

    await pageA.click("#webmatic-floating-recorder-global");
    await pageA.waitForSelector("[data-script-editor][style*='flex']", { timeout: 10000 });

    log("OK: multi-tab verificado", { totalSteps: steps.length, types });
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((e) => {
  console.error("[tabs-floating-e2e] FAIL", e && e.stack ? e.stack : e);
  process.exit(1);
});
