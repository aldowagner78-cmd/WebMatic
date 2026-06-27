"use strict";

const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../../../../..");
const FIXTURE_DIR = __dirname;
const PORT = 18087;
const INPUT_SELECTOR = "#busqueda-expediente";
const INPUT_VALUE = "EE-2026-00014539";

const WEBMATIC_MODULES = [
  "src/core/utils.js",
  "src/common/dom/text-compare.js",
  "src/common/dom/element-finder.js",
  "src/common/diagnostics/selector-diagnostics.js",
  "src/common/selectors/selector-builder.js",
  "src/modules/recorder/normalizer/recording-normalizer.js",
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

function buildInitScript() {
  const chromeStub = `
    window.chrome = {
      runtime: {
        lastError: null,
        sendMessage: function (_message, callback) {
          if (typeof callback === "function") callback({ ok: true });
        }
      }
    };
  `;

  return [
    chromeStub,
    ...WEBMATIC_MODULES.map((rel) => fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf8"))
  ].join("\n;\n");
}

async function runPlayback(page, steps) {
  return page.evaluate((macroSteps) => {
    return new Promise((resolve) => {
      const startedAt = performance.now();
      window.__wmWaitForNavigateLog.push({ type: "playback-started", at: startedAt });

      const player = new window.WebMaticPlayer({ retryMs: 25, timeoutMs: 2500 });
      player.play(macroSteps, {
        speed: 3,
        bootstrapToFirstNavigate: false,
        onDone: (summary) => resolve({ ok: true, summary: summary || null }),
        onError: (err) => resolve({ ok: false, error: err && err.message ? err.message : String(err) })
      });
    });
  }, steps);
}

function assertNavigateWaitInputOrder(steps, fixtureUrl) {
  assert.equal(steps[0] && steps[0].type, "navigate");
  assert.equal(steps[0] && steps[0].url, fixtureUrl);
  assert.equal(steps[1] && steps[1].type, "wait_for");
  assert.equal(steps[1] && steps[1].selector, INPUT_SELECTOR);
  assert.equal(steps[1] && steps[1].visible, true);
  assert.equal(steps[1] && steps[1]._autoWait, true);
  assert.equal(steps[2] && steps[2].type, "input");
  assert.equal(steps[2] && steps[2].selector, INPUT_SELECTOR);
  assert.equal(steps[2] && steps[2].value, INPUT_VALUE);
}

async function main() {
  console.log("[wait-for-after-navigate] iniciando servidor en", PORT);
  const server = await startFixtureServer();
  const fixtureUrl = `http://localhost:${PORT}/fixture.html?delay=800`;

  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript({ content: buildInitScript() });
    page = await context.newPage();

    await page.goto(fixtureUrl, { waitUntil: "load", timeout: 20000 });

    const normalized = await page.evaluate(({ fixtureUrl: url, selector, value }) => {
      return window.WebMaticRecordingNormalizer.normalizeRecordedSteps([
        { type: "navigate", url },
        { type: "input", selector, value }
      ]);
    }, { fixtureUrl, selector: INPUT_SELECTOR, value: INPUT_VALUE });

    assertNavigateWaitInputOrder(normalized, fixtureUrl);

    const alreadyExists = await page.locator(INPUT_SELECTOR).count();
    assert.equal(alreadyExists, 0, "el input no debe existir antes de iniciar la reproduccion");

    const playback = await runPlayback(page, normalized);
    assert.equal(playback.ok, true, playback.error || "playback debe completar");

    const finalState = await page.evaluate((selector) => {
      const input = document.querySelector(selector);
      return {
        value: input ? input.value : null,
        log: window.__wmWaitForNavigateLog || []
      };
    }, INPUT_SELECTOR);

    const started = finalState.log.find((entry) => entry.type === "playback-started");
    const created = finalState.log.find((entry) => entry.type === "input-created");
    const inputEvent = finalState.log.find((entry) => entry.type === "input-event");

    assert.ok(started, "debe registrar inicio de reproduccion");
    assert.ok(created, "debe registrar creacion tardia del input");
    assert.ok(inputEvent, "debe registrar escritura sobre el input");
    assert.ok(started.at < created.at, "la reproduccion debe empezar antes de que el input exista");
    assert.ok(inputEvent.at >= created.at, "no debe escribir antes de que el input exista");
    assert.equal(finalState.value, INPUT_VALUE);

    console.log("[wait-for-after-navigate] OK: NAVIGATE -> WAIT_FOR visible -> TYPE sobre input demorado");
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    else if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((e) => {
  console.error("[wait-for-after-navigate] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
