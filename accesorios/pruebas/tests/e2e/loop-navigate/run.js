"use strict";

const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../../../../..");
const FIXTURE_DIR = __dirname;
const PORT = 18088;
const TARGET_SELECTOR = "#objetivo";
const TARGET_VALUE = "ITERACION";
const LOOP_TOTAL = 3;

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
    const localPath = rel === "/" ? "start.html" : rel.slice(1);
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
        sendMessage: function (message, callback) {
          Promise.resolve(window.__wmRuntimeSendMessage(message))
            .then(function (response) {
              window.chrome.runtime.lastError = null;
              if (typeof callback === "function") callback(response);
            })
            .catch(function (err) {
              window.chrome.runtime.lastError = { message: err && err.message ? err.message : String(err) };
              if (typeof callback === "function") callback(null);
            });
        }
      }
    };
  `;

  return [
    chromeStub,
    ...WEBMATIC_MODULES.map((rel) => fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf8"))
  ].join("\n;\n");
}

function nextLoopReplayState(loopReplay) {
  if (!loopReplay || typeof loopReplay !== "object") return null;
  const total = Number(loopReplay.total);
  const remaining = Number(loopReplay.remaining);
  if (!Number.isFinite(total) || !Number.isFinite(remaining) || remaining <= 1) return null;
  return { total, remaining: remaining - 1 };
}

function waitForPlaybackEvent(playbackEvents) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("timeout esperando fin de reproduccion"));
    }, 10000);

    playbackEvents.waiter = (event) => {
      clearTimeout(timeout);
      playbackEvents.waiter = null;
      resolve(event);
    };
  });
}

async function startPlayback(page, args) {
  await page.evaluate((payload) => {
    const player = new window.WebMaticPlayer({ retryMs: 25, timeoutMs: 2500 });
    window.__wmLoopNavigatePlayer = player;
    player.play(payload.steps, {
      speed: payload.speed,
      startIndex: payload.startIndex,
      vars: payload.vars || {},
      macroId: payload.macroId,
      loopReplay: payload.loopReplay,
      bootstrapToFirstNavigate: false,
      onDone: (summary) => {
        window.__wmPlaybackEvent({ type: "done", summary: summary || null });
      },
      onError: (err) => {
        window.__wmPlaybackEvent({
          type: "error",
          error: err && err.message ? err.message : String(err)
        });
      }
    });
    return true;
  }, args);
}

async function queryPendingPlayback(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      window.chrome.runtime.sendMessage({ type: "QUERY_PENDING_PLAYBACK" }, (resp) => {
        resolve(resp && resp.pending ? resp.pending : null);
      });
    });
  });
}

async function runIteration(page, macroSteps, loopReplay, fixtureUrl, playbackEvents, queriedPendings) {
  await startPlayback(page, {
    steps: macroSteps,
    startIndex: 0,
    speed: 3,
    vars: {},
    macroId: "macro-loop-navigate",
    loopReplay
  });

  await page.waitForURL(fixtureUrl, { waitUntil: "load", timeout: 10000 });

  const pending = await queryPendingPlayback(page);
  queriedPendings.push(pending);
  assert.ok(pending, "debe existir pending playback despues de NAVIGATE");
  assert.equal(pending.index, 1, "debe reanudar despues del paso NAVIGATE");
  assert.equal(pending.macroId, "macro-loop-navigate");
  assert.deepEqual(pending.loopReplay, loopReplay, "NAVIGATE debe conservar loopReplay en pending playback");

  const doneEventPromise = waitForPlaybackEvent(playbackEvents);
  await startPlayback(page, {
    steps: pending.steps,
    startIndex: pending.index,
    speed: pending.speed,
    vars: pending.vars || {},
    macroId: pending.macroId,
    loopReplay: pending.loopReplay
  });

  const doneEvent = await doneEventPromise;
  assert.equal(doneEvent.type, "done", doneEvent.error || "la iteracion debe completar");

  return nextLoopReplayState(pending.loopReplay);
}

async function main() {
  console.log("[loop-navigate] iniciando servidor en", PORT);
  const server = await startFixtureServer();
  const startUrl = `http://localhost:${PORT}/start.html`;
  const fixtureUrl = `http://localhost:${PORT}/fixture.html?target=loop`;
  const playbackEvents = [];
  const runtimeMessages = [];
  const queriedPendings = [];
  let pendingPlayback = null;

  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    await context.exposeBinding("__wmRuntimeSendMessage", async (_source, message) => {
      runtimeMessages.push(message);
      if (!message || typeof message !== "object") return { ok: false, error: "invalid_message" };

      if (message.type === "SAVE_PLAYBACK_STATE") {
        pendingPlayback = {
          steps: message.steps,
          index: message.index,
          vars: message.vars || {},
          speed: message.speed || 1,
          macroId: message.macroId || null
        };
        if (message.loopReplay && typeof message.loopReplay === "object") {
          pendingPlayback.loopReplay = message.loopReplay;
        }
        return { ok: true };
      }

      if (message.type === "QUERY_PENDING_PLAYBACK") {
        const pending = pendingPlayback;
        pendingPlayback = null;
        return { pending };
      }

      if (message.type === "CLEAR_PENDING_PLAYBACK") {
        pendingPlayback = null;
        return { ok: true };
      }

      return { ok: true };
    });

    await context.exposeBinding("__wmPlaybackEvent", async (_source, event) => {
      playbackEvents.push(event);
      if (typeof playbackEvents.waiter === "function") playbackEvents.waiter(event);
      return { ok: true };
    });

    await context.addInitScript({ content: buildInitScript() });
    page = await context.newPage();

    await page.goto(startUrl, { waitUntil: "load", timeout: 20000 });
    await page.evaluate(() => {
      window.localStorage.removeItem("wmLoopNavigatePasses");
      window.localStorage.removeItem("wmLoopNavigateLoads");
    });

    const macroSteps = [
      { type: "navigate", url: fixtureUrl },
      { type: "wait_for", selector: TARGET_SELECTOR, timeout: 5000, visible: true },
      { type: "input", selector: TARGET_SELECTOR, value: TARGET_VALUE }
    ];

    let loopReplay = { total: LOOP_TOTAL, remaining: LOOP_TOTAL };
    for (let i = 0; i < LOOP_TOTAL; i++) {
      loopReplay = await runIteration(page, macroSteps, loopReplay, fixtureUrl, playbackEvents, queriedPendings);
      if (i < LOOP_TOTAL - 1) {
        assert.ok(loopReplay, "debe quedar una siguiente vuelta de bucle");
      } else {
        assert.equal(loopReplay, null, "no debe quedar bucle pendiente despues de la tercera vuelta");
      }
    }

    const finalState = await page.evaluate(() => {
      const read = (key) => {
        try { return JSON.parse(window.localStorage.getItem(key) || "[]"); }
        catch (_) { return []; }
      };
      return {
        href: window.location.href,
        inputValue: document.querySelector("#objetivo") ? document.querySelector("#objetivo").value : null,
        visibleCount: document.querySelector("#estado") ? document.querySelector("#estado").textContent : "",
        passes: read("wmLoopNavigatePasses"),
        loads: read("wmLoopNavigateLoads")
      };
    });

    const saveMessages = runtimeMessages.filter((message) => message && message.type === "SAVE_PLAYBACK_STATE");
    const clearMessages = runtimeMessages.filter((message) => message && message.type === "CLEAR_PENDING_PLAYBACK");

    assert.equal(finalState.passes.length, LOOP_TOTAL, "el fixture debe evidenciar 3 pasadas");
    assert.equal(finalState.visibleCount, "Pasadas registradas: 3");
    assert.equal(finalState.inputValue, TARGET_VALUE);
    assert.ok(finalState.href.includes("played=3"), "la pagina final debe marcar la tercera pasada");
    assert.ok(finalState.loads.length >= LOOP_TOTAL, "debe haber una carga local por cada NAVIGATE");
    assert.equal(queriedPendings.length, LOOP_TOTAL, "debe consultar pending playback tras cada NAVIGATE");
    assert.ok(
      queriedPendings.every((pending) => pending && pending.loopReplay && pending.loopReplay.total === LOOP_TOTAL),
      "todos los pending playback de navegacion deben conservar loopReplay"
    );
    assert.ok(
      saveMessages.some((message) => message.index === 1 && message.loopReplay && message.loopReplay.remaining === LOOP_TOTAL),
      "la primera navegacion debe guardar pending playback con bucle completo"
    );
    assert.ok(clearMessages.length >= LOOP_TOTAL, "cada iteracion completada debe limpiar pending playback");

    console.log("[loop-navigate] OK: bucle x3 conserva pending playback y reanuda despues de NAVIGATE");
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    else if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((e) => {
  console.error("[loop-navigate] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
