"use strict";

const { chromium } = require("playwright");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { safeClick, safeFill, safeSelectOption } = require("../iapos-safe/safety-actions");
const { makeSafeLogger } = require("../iapos-safe/sanitize-log");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures");
const PROFILE_DIR = path.join(os.tmpdir(), "webmatic-e2e-extension-safe-profile");
const PORT = 18084;

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

async function openPanelViaBackground(ctx, page) {
  const extId = await getExtensionId(page);
  if (!extId) return false;

  const bgUrl = `chrome-extension://${extId}/_generated_background_page.html`;
  const bgPage = await ctx.newPage();

  try {
    await bgPage.goto(bgUrl, { waitUntil: "load", timeout: 10000 });

    const tabId = await bgPage.evaluate(
      (port) => new Promise((resolve) => {
        chrome.tabs.query({ url: `http://localhost:${port}/*` }, (tabs) => {
          resolve(tabs && tabs[0] ? tabs[0].id : null);
        });
      }),
      PORT
    );

    if (!tabId) return false;

    await bgPage.evaluate(
      (id) => new Promise((resolve) => {
        chrome.tabs.sendMessage(id, { type: "OPEN_PANEL" }, () => {
          void chrome.runtime.lastError;
          resolve();
        });
      }),
      tabId
    );

    return true;
  } catch {
    return false;
  } finally {
    await bgPage.close();
  }
}

function parseResults(okMap) {
  const failed = Object.entries(okMap).filter(([, ok]) => !ok).map(([k]) => k);
  return { failed, ok: failed.length === 0 };
}

async function main() {
  const log = makeSafeLogger({ secrets: [] });
  log("Inicio test:e2e:extension (diagnóstico Chromium, NO validación final Firefox)");

  const server = await startFixtureServer();
  let ctx;
  let page;
  const consoleErrors = [];
  const pageErrors = [];

  const checks = {
    fixtureLoaded: false,
    extensionInjected: false,
    panelOpened: false,
    recordingStarted: false,
    recordingStopped: false,
    chooseOptionRecorded: false,
    editorComboShown: false,
    editorComboChangedToA: false,
    macroSaved: false,
    iimContainsChooseOption: false,
    playbackCompleted: false,
    selectEndedAsA: false,
    noRuntimeChooseOverlay: false,
    noDangerousClicks: false,
    iaposRealDisabled: false
  };

  try {
    if (fs.existsSync(PROFILE_DIR)) {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    }

    // Firefox + Playwright no soporta carga de extensión MV2 de forma confiable.
    // Para flujo completo de extensión local usamos Chromium (solo fixture local).
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: "chromium",
      headless: false,
      args: [
        `--disable-extensions-except=${ROOT}`,
        `--load-extension=${ROOT}`,
        "--no-first-run",
        "--no-default-browser-check"
      ],
      viewport: { width: 1366, height: 900 },
      acceptDownloads: true,
      slowMo: 40
    });

    page = await ctx.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 20000 });
    checks.fixtureLoaded = true;

    // Instrumentación para confirmar que NO hubo clicks peligrosos.
    await page.evaluate(() => {
      window.__dangerClicks = 0;
      ["#btn-autorizar", ".accion-fila", "#img-peligroso", "#btn-eliminar", "#btn-guardar"].forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          el.addEventListener("click", () => { window.__dangerClicks += 1; });
        });
      });
    });

    const panelAppeared = await page.waitForSelector("#webmatic-panel-root", { state: "attached", timeout: 15000 }).then(() => true).catch(() => false);
    if (!panelAppeared) {
      const runtimeDiag = {
        pages: ctx.pages().map((p) => p.url()),
        backgroundPages: ctx.backgroundPages().map((p) => p.url()),
        serviceWorkers: ctx.serviceWorkers().map((w) => w.url())
      };
      const domDiag = await page.evaluate(() => {
        const link = document.getElementById("webmatic-style-link");
        const panel = document.getElementById("webmatic-panel-root");
        return {
          hasStyleLink: !!link,
          styleHref: link ? link.getAttribute("href") : null,
          hasPanel: !!panel,
          bodyLength: document.body ? document.body.innerHTML.length : 0,
          locationHref: location.href
        };
      }).catch((e) => ({ evalError: String(e && e.message ? e.message : e) }));

      log(`DIAG runtime=${JSON.stringify(runtimeDiag)}`);
      log(`DIAG dom=${JSON.stringify(domDiag)}`);
      if (consoleErrors.length) log(`DIAG consoleErrors=${JSON.stringify(consoleErrors.slice(0, 10))}`);
      if (pageErrors.length) log(`DIAG pageErrors=${JSON.stringify(pageErrors.slice(0, 10))}`);
      throw new Error("Timeout esperando #webmatic-panel-root (extensión no inyectada)");
    }
    checks.extensionInjected = true;

    const opened = await openPanelViaBackground(ctx, page);
    if (!opened) throw new Error("No se pudo abrir panel de WebMatic vía background");
    await page.waitForTimeout(700);
    checks.panelOpened = true;

    await page.click('[data-record-btn]');
    await page.waitForSelector("#webmatic-floating-recorder-global", { timeout: 6000 });
    checks.recordingStarted = true;

    await safeSelectOption(page.locator("#wm-select"), "B", { stage: "readonly-filter" });
    await safeFill(page.locator("#wm-input"), "texto-seguro-e2e", { stage: "readonly-filter" });
    await safeClick(page.locator("#btn-buscar"), { stage: "readonly-search" });

    await page.click("#webmatic-floating-recorder-global");
    await page.waitForSelector('[data-script-editor][style*="flex"]', { timeout: 8000 });
    checks.recordingStopped = true;

    checks.chooseOptionRecorded = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".wm-sved-row"));
      return rows.some((r) => {
        const type = r.querySelector(".wm-sved-type")?.textContent?.trim();
        return type === "choose_option";
      });
    });

    // Abrir edición del paso choose_option
    const chooseRow = page.locator(".wm-sved-row", { has: page.locator(".wm-sved-type", { hasText: "choose_option" }) }).first();
    await chooseRow.locator(".wm-sved-btn-edit").click();
    await page.waitForSelector(".wm-sved-edit-form", { timeout: 5000 });

    const combo = page.locator("[data-wm-optcombo]").first();
    checks.editorComboShown = await combo.count() > 0;
    if (!checks.editorComboShown) throw new Error("No apareció combo inteligente en editor visual");

    const optionsText = await combo.locator("option").allTextContents();
    if (!(optionsText.some((t) => t.includes("Opción A")) && optionsText.some((t) => t.includes("Opción B")))) {
      throw new Error("Combo inteligente no mostró opciones reales esperadas");
    }

    await combo.selectOption("A");
    checks.editorComboChangedToA = true;
    await page.click(".wm-sved-edit-form .wm-sved-confirm-btn");
    await page.waitForTimeout(500);

    // Guardar macro local desde script editor
    await page.click('[data-action="script-editor-saveas"]');
    await page.waitForTimeout(300);
    const wmDialogVisible = await page.locator('[data-wm-dialog][style*="flex"]').count();
    if (wmDialogVisible > 0) {
      await page.fill("[data-wm-input]", "E2E_Extension_Safe_Local");
      await page.click("[data-wm-ok]");
    } else {
      await page.fill("[data-save-name]", "E2E_Extension_Safe_Local");
      await page.click('[data-action="save-confirm"]');
    }
    await page.waitForTimeout(800);
    checks.macroSaved = true;

    // Verificar IIM desde pestaña Script
    await page.click('[data-action="script-editor-tab"][data-script-tab="script"]');
    await page.waitForTimeout(300);
    const scriptText = await page.locator("[data-script-editor-area]").inputValue();
    checks.iimContainsChooseOption = scriptText.includes("CHOOSE_OPTION") && scriptText.includes("VALUE=\"A\"");

    await page.click('[data-action="script-editor-close"]');
    await page.waitForTimeout(600);

    // Reproducir macro
    await openPanelViaBackground(ctx, page);
    await page.waitForTimeout(500);
    await page.click('#webmatic-panel-root button[data-mode="play"]');
    await page.waitForTimeout(300);

    const macroItem = page.locator('[data-macro-id]', { hasText: 'E2E_Extension_Safe_Local' }).first();
    if (await macroItem.count() === 0) throw new Error("No se encontró macro guardada en biblioteca");
    await macroItem.click();
    await page.waitForTimeout(300);

    await page.click('[data-action="macro-play"]');
    await page.waitForSelector("#webmatic-floating-player-global", { timeout: 6000 });

    await page.waitForFunction(() => {
      const info = document.querySelector("#webmatic-floating-player-global #wm-play-info");
      return !!(info && info.textContent.includes("Completado"));
    }, { timeout: 25000 });

    checks.playbackCompleted = true;
    checks.selectEndedAsA = await page.$eval("#wm-select", (el) => el.value === "A").catch(() => false);
    checks.noRuntimeChooseOverlay = await page.$("#wm-choose-option-overlay") === null;

    const dangerClicks = await page.evaluate(() => window.__dangerClicks || 0);
    checks.noDangerousClicks = dangerClicks === 0;

    checks.iaposRealDisabled = process.env.IAPOS_E2E_REAL !== "1";

    const parsed = parseResults(checks);
    if (!parsed.ok) {
      throw new Error(`Validaciones fallidas: ${parsed.failed.join(", ")}`);
    }

    log("OK: flujo completo de extensión local validado");
  } catch (e) {
    log("FAIL test:e2e:extension", e && e.message ? e.message : String(e));
    process.exitCode = 1;
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[webmatic-extension-safe] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
