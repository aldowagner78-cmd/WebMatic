"use strict";

const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../../../../..");
const FIXTURE_DIR = __dirname;
const PORT = 18086;

const WEBMATIC_MODULES = [
  "src/core/utils.js",
  "src/common/dom/text-compare.js",
  "src/common/dom/element-finder.js",
  "src/common/diagnostics/selector-diagnostics.js",
  "src/common/selectors/selector-builder.js",
  "src/modules/inventory/page-inventory.js",
  "src/modules/player/state/variable-expander.js",
  "src/modules/player/navigation/navigation-analyzer.js",
  "src/modules/player/navigation/background-navigator.js",
  "src/modules/player/actions/action-click.js",
  "src/modules/player/actions/action-check.js",
  "src/modules/player/actions/action-check-runner.js",
  "src/modules/player/actions/action-input-value.js",
  "src/modules/player/actions/action-input-text.js",
  "src/modules/player/actions/action-autocomplete.js",
  "src/modules/player/actions/action-simple-events.js",
  "src/modules/player/actions/action-wait.js",
  "src/modules/player/actions/action-extract.js",
  "src/modules/player/defaults/pre-run-reset-utils.js",
  "src/modules/player/defaults/modified-selectors.js",
  "src/modules/player/defaults/baseline-restorer.js",
  "src/modules/player/defaults/pre-run-reset-runner.js",
  "src/modules/player/defaults/default-selector.js",
  "src/modules/player/defaults/default-steps-collector.js",
  "src/modules/player/diagnostics/highlight-manager.js",
  "src/modules/player/state/step-normalizer.js",
  "src/modules/player/state/transient-recovery.js",
  "src/modules/player/state/login-step-bypass.js",
  "src/modules/player/control-flow/continuation-steps.js",
  "src/modules/player/player.js"
];

function startFixtureServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8"
  };

  const server = http.createServer((req, res) => {
    const rel = (req.url || "/").split("?")[0];
    const localPath = rel === "/" ? "fixture.html" : rel.slice(1);
    const file = path.join(FIXTURE_DIR, localPath);

    try {
      const data = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "text/plain; charset=utf-8" });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, () => resolve(server));
  });
}

async function loadWebMaticModules(page) {
  await page.evaluate(() => {
    window.chrome = {
      runtime: {
        lastError: null,
        sendMessage: function (_message, callback) {
          if (typeof callback === "function") callback({ ok: true });
        }
      }
    };
  });

  for (const rel of WEBMATIC_MODULES) {
    await page.addScriptTag({ path: path.join(PROJECT_ROOT, rel) });
  }
}

async function runPlayback(page, steps) {
  return page.evaluate((macroSteps) => {
    return new Promise((resolve) => {
      const player = new window.WebMaticPlayer({ retryMs: 25, timeoutMs: 1500 });
      player.play(macroSteps, {
        speed: 3,
        bootstrapToFirstNavigate: false,
        onDone: (summary) => resolve({ ok: true, summary: summary || null }),
        onError: (err) => resolve({ ok: false, error: err && err.message ? err.message : String(err) })
      });
    });
  }, steps);
}

async function main() {
  console.log("[angular-material-selectors] iniciando servidor en", PORT);
  const server = await startFixtureServer();

  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();

    await page.goto(`http://localhost:${PORT}/fixture.html?id=mat-input-3`, { waitUntil: "load", timeout: 20000 });
    await loadWebMaticModules(page);

    const captured = await page.evaluate(() => {
      const input = document.querySelector("#mat-input-3");
      const selector = window.WebMaticSelectorBuilder.buildSelector(input);
      const altSelectors = window.WebMaticSelectorBuilder.buildStableFallbackSelectors(input, selector);
      const inventory = window.WebMaticPageInventory.captureInventory(document, {
        url: location.href,
        title: document.title
      });
      const control = inventory.controls.find((item) => item.id === "mat-input-3") || null;
      return { selector, altSelectors, control };
    });

    assert.equal(
      captured.selector,
      'input[placeholder="Buscar Nro. de Expediente:"]',
      "rc35 debe preferir placeholder estable sobre #mat-input-3"
    );
    assert.ok(captured.control, "el inventario debe capturar el input Angular Material");
    assert.equal(captured.control.selector, 'input[placeholder="Buscar Nro. de Expediente:"]');
    assert.equal(captured.altSelectors.includes("#mat-input-3"), false, "no debe guardar #mat-input-3 como fallback estable");
    assert.equal(captured.control.altSelectors.includes("#mat-input-3"), false, "controlRef no debe depender del id dinamico");

    const stableFallbacks = [
      captured.selector,
      ...captured.altSelectors,
      ...captured.control.altSelectors
    ];
    assert.ok(
      stableFallbacks.includes('input[placeholder="Buscar Nro. de Expediente:"]'),
      "macro/controlRef debe conservar el selector estable por placeholder"
    );

    const legacyDynamicMacro = [
      {
        type: "wait_for",
        selector: "#mat-input-3",
        timeout: 1000,
        visible: true,
        controlRef: {
          selector: captured.control.selector,
          altSelectors: captured.control.altSelectors
        }
      },
      {
        type: "input",
        selector: "#mat-input-3",
        value: "EXP-2026-0001",
        controlRef: {
          selector: captured.control.selector,
          altSelectors: captured.control.altSelectors
        }
      }
    ];

    await page.goto(`http://localhost:${PORT}/fixture.html?id=mat-input-99`, { waitUntil: "load", timeout: 20000 });
    await loadWebMaticModules(page);

    assert.equal(await page.locator("#mat-input-3").count(), 0, "la segunda carga no debe contener #mat-input-3");
    assert.equal(await page.locator("#mat-input-99").count(), 1, "la segunda carga debe contener #mat-input-99");
    assert.equal(
      await page.locator('input[placeholder="Buscar Nro. de Expediente:"]').count(),
      1,
      "el selector estable debe seguir existiendo tras cambiar el id"
    );

    const playback = await runPlayback(page, legacyDynamicMacro);
    assert.equal(playback.ok, true, playback.error || "playback debe completar");

    const finalState = await page.evaluate(() => {
      const input = document.querySelector("#mat-input-99");
      return {
        value: input ? input.value : null,
        events: window.__wmAngularMaterialEvents || []
      };
    });

    assert.equal(finalState.value, "EXP-2026-0001", "la reproduccion debe completar el input con id cambiado");
    assert.ok(
      finalState.events.some((event) => event.type === "input" && event.id === "mat-input-99"),
      "la reproduccion debe disparar input sobre el nuevo id dinamico"
    );

    console.log("[angular-material-selectors] OK: #mat-input-3 -> #mat-input-99 cubierto por placeholder/controlRef.altSelectors");
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    else if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((e) => {
  console.error("[angular-material-selectors] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
