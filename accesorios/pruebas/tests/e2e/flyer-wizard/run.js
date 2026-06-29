"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../../../../..");
const FIXTURE_DIR = __dirname;
const PORT = 18090;
const CDP_PORT = 18190;

const WEBMATIC_MODULES = [
  "src/core/utils.js",
  "src/common/dom/text-compare.js",
  "src/common/dom/element-finder.js",
  "src/common/diagnostics/selector-diagnostics.js",
  "src/common/selectors/selector-builder.js",
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
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  };

  const server = http.createServer((req, res) => {
    const rel = (req.url || "/").split("?")[0];
    const localPath = rel === "/" ? "fixture.html" : rel.slice(1);
    const file = path.join(FIXTURE_DIR, localPath);
    const resolvedDir = path.resolve(FIXTURE_DIR);
    const resolvedFile = path.resolve(file);

    if (!resolvedFile.startsWith(resolvedDir)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("forbidden");
      return;
    }

    try {
      const data = fs.readFileSync(resolvedFile);
      res.writeHead(200, { "Content-Type": mime[path.extname(resolvedFile)] || "text/plain; charset=utf-8" });
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

function findChromiumExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
  return response.json();
}

function waitForCdp(port, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
        resolve(version);
      } catch (e) {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`no se pudo conectar a CDP en puerto ${port}: ${e.message}`));
          return;
        }
        setTimeout(attempt, 100);
      }
    };
    attempt();
  });
}

class CdpPage {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result || {});
        return;
      }
      if (message.method && this.listeners.has(message.method)) {
        this.listeners.get(message.method).forEach((listener) => listener(message.params || {}));
      }
    });
  }

  send(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        const list = this.listeners.get(method) || [];
        this.listeners.set(method, list.filter((item) => item !== listener));
        resolve(params);
      };
      const list = this.listeners.get(method) || [];
      list.push(listener);
      this.listeners.set(method, list);
    });
  }

  async init() {
    await this.send("Page.enable");
    await this.send("Runtime.enable");
  }

  async goto(url) {
    const loaded = this.once("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await loaded;
  }

  async evaluate(fn, arg) {
    const expression = typeof fn === "function"
      ? `(${fn})(${JSON.stringify(arg)})`
      : String(fn);
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.text || "Runtime.evaluate fallo";
      throw new Error(text);
    }
    return result.result ? result.result.value : undefined;
  }

  async addScriptTag(options) {
    const content = fs.readFileSync(options.path, "utf8");
    await this.evaluate(`${content}\n//# sourceURL=${options.path.replace(/\\/g, "/")}`);
  }
}

async function createAutomation() {
  try {
    const { chromium } = require("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    const page = await context.newPage();
    return {
      mode: "playwright",
      page,
      close: async () => {
        await context.close();
        await browser.close();
      }
    };
  } catch (e) {
    if (e && e.code !== "MODULE_NOT_FOUND") throw e;
  }

  const executable = findChromiumExecutable();
  if (!executable) throw new Error("Playwright no esta instalado y no se encontro Edge/Chrome para fallback CDP");

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "webmatic-flyer-wizard-"));
  const child = spawn(executable, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ], { stdio: "ignore" });

  await waitForCdp(CDP_PORT, 8000);
  const target = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: "PUT" });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const page = new CdpPage(ws);
  await page.init();

  return {
    mode: "cdp",
    page,
    close: async () => {
      try { ws.close(); } catch (_e) { /* ignore */ }
      try { child.kill(); } catch (_e) { /* ignore */ }
      await new Promise((resolve) => child.once("exit", resolve));
      const resolvedTemp = path.resolve(userDataDir);
      if (resolvedTemp.startsWith(path.resolve(os.tmpdir()))) {
        try {
          fs.rmSync(resolvedTemp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        } catch (_e) {
          // Windows puede retener archivos del perfil del navegador unos instantes.
        }
      }
    }
  };
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
      const player = new window.WebMaticPlayer({ retryMs: 25, timeoutMs: 2000 });
      player.play(macroSteps, {
        speed: 3,
        bootstrapToFirstNavigate: false,
        onDone: (summary) => resolve({ ok: true, summary: summary || null }),
        onError: (err) => resolve({ ok: false, error: err && err.message ? err.message : String(err) })
      });
    });
  }, steps);
}

async function assertFixtureShape(page) {
  const shape = await page.evaluate(() => ({
    panels: document.querySelectorAll(".panel").length,
    hiddenPanels: Array.from(document.querySelectorAll(".panel")).filter((panel) => getComputedStyle(panel).display === "none").length,
    nextButtons: document.querySelectorAll(".next-action").length,
    backButtons: document.querySelectorAll(".back-action").length,
    duplicatedPrimaryPlaceholders: document.querySelectorAll('input[placeholder="Dato principal"]').length,
    duplicatedSecondaryPlaceholders: document.querySelectorAll('input[placeholder="Dato secundario"]').length,
    genericActions: document.querySelectorAll(".generic-action").length,
    textarea: document.querySelectorAll('textarea[placeholder="Texto del flyer"]').length
  }));

  assert.equal(shape.panels, 5, "debe conservar los cinco paneles del wizard en DOM");
  assert.equal(shape.hiddenPanels, 4, "debe haber paneles ocultos presentes en DOM");
  assert.equal(shape.nextButtons, 4, "debe tener botones Siguiente repetidos");
  assert.equal(shape.backButtons, 5, "debe tener botones Volver repetidos");
  assert.equal(shape.duplicatedPrimaryPlaceholders, 4, "debe duplicar placeholders principales en paneles ocultos");
  assert.equal(shape.duplicatedSecondaryPlaceholders, 3, "debe duplicar placeholders secundarios");
  assert.equal(shape.textarea, 1, "debe incluir textarea principal");
  assert.ok(shape.genericActions >= 10, "debe exponer selectores genericos repetidos");
}

async function assertResolverChoosesVisible(page, selector, expectedText) {
  const resolved = await page.evaluate((rawSelector) => {
    const found = window.WebMaticElementFinder.findBestElement(rawSelector, {
      actionType: "click",
      document
    });
    return {
      text: found.element ? (found.element.textContent || "").trim() : null,
      candidates: found.candidates.map((item) => ({
        text: (item.element.textContent || "").trim(),
        visible: item.visible,
        actionable: item.actionable
      }))
    };
  }, selector);

  assert.equal(resolved.text, expectedText);
  assert.ok(resolved.candidates.length > 1, "el selector debe tener multiples candidatos");
}

async function main() {
  console.log("[flyer-wizard] iniciando servidor en", PORT);
  const server = await startFixtureServer();

  let automation;
  let page;

  try {
    automation = await createAutomation();
    console.log("[flyer-wizard] navegador:", automation.mode);
    page = automation.page;

    await page.goto(`http://localhost:${PORT}/fixture.html`);
    await loadWebMaticModules(page);

    await assertFixtureShape(page);

    const steps = [
      { type: "click", selector: 'button[text="Comenzar"]' },
      {
        type: "input",
        selector: 'input[placeholder="Dato principal"]',
        value: "Clinica Norte",
        controlRef: { placeholder: "Dato principal", controlKind: "text-input", visibleSectionTitle: "Institucion" }
      },
      {
        type: "input",
        selector: 'input[placeholder="Dato secundario"]',
        value: "Turnos al 0800",
        controlRef: { placeholder: "Dato secundario", controlKind: "text-input", visibleSectionTitle: "Institucion" }
      },
      { type: "click", selector: 'button[text="Siguiente"]' },
      {
        type: "click",
        selector: ".choice-action",
        controlRef: { text: "Campania", controlKind: "button", visibleSectionTitle: "Tipo" }
      },
      { type: "click", selector: 'button[text="Siguiente"]' },
      {
        type: "input",
        selector: 'textarea[placeholder="Texto del flyer"]',
        value: "Vacunacion antigripal sin turno previo",
        controlRef: { placeholder: "Texto del flyer", controlKind: "textarea", visibleSectionTitle: "Contenido" }
      },
      { type: "click", selector: 'button[text="Siguiente"]' },
      {
        type: "input",
        selector: 'input[placeholder="Dato secundario"]',
        value: "Claro, accesible, verde salud",
        controlRef: { placeholder: "Dato secundario", controlKind: "text-input", visibleSectionTitle: "Diseno" }
      },
      { type: "click", selector: 'button[text="Siguiente"]' },
      { type: "click", selector: 'button[text="Copiar prompt"]' },
      { type: "click", selector: ".final-candidate", controlRef: { text: "Finalizar", controlKind: "button", visibleSectionTitle: "Resultado" } }
    ];

    const playback = await runPlayback(page, steps);
    assert.equal(playback.ok, true, playback.error || "playback debe completar");

    await assertResolverChoosesVisible(page, ".final-candidate", "Finalizar");

    const finalState = await page.evaluate(() => ({
      step: document.querySelector("#current-step").textContent,
      copied: document.querySelector("#copy-status").textContent,
      result: document.querySelector("#flow-result").textContent,
      prompt: document.querySelector("#prompt-output").textContent
    }));

    assert.equal(finalState.step, "resultado");
    assert.equal(finalState.copied, "copied");
    assert.equal(finalState.result, "prompt-ready");
    assert.match(finalState.prompt, /Clinica Norte/);
    assert.match(finalState.prompt, /Vacunacion antigripal sin turno previo/);

    console.log("[flyer-wizard] OK: wizard SPA local con paneles ocultos, selectores repetidos y accion final validada");
  } finally {
    if (automation) await automation.close();
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    else if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((e) => {
  console.error("[flyer-wizard] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
