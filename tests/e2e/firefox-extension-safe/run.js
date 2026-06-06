"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const { makeSafeLogger } = require("../iapos-safe/sanitize-log");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures");
const PRIVATE_ARTIFACTS = path.join(ROOT, "tests", "e2e", "artifacts-private");
const PORT = 18086;
const GECKO_PORT = 4545;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCandidatePath(candidate, platform = process.platform) {
  if (!candidate) return null;
  const trimmed = String(candidate).trim().replace(/^"|"$/g, "");
  if (!trimmed) return null;

  if (platform === "win32") {
    // Convierte rutas estilo MSYS (/c/Program Files/...) a formato Windows.
    const msys = /^\/([a-zA-Z])\/(.*)$/.exec(trimmed);
    if (msys) {
      return `${msys[1].toUpperCase()}:\\${msys[2].replace(/\//g, "\\")}`;
    }
  }

  return trimmed;
}

function uniquePaths(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function parseOutputLines(text, platform = process.platform) {
  return uniquePaths(
    String(text || "")
      .split(/\r?\n/)
      .map((line) => normalizeCandidatePath(line, platform))
      .filter(Boolean)
  );
}

function resolveCommand(name, options = {}) {
  const spawnSyncImpl = options.spawnSyncImpl || spawnSync;
  const out = spawnSyncImpl("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" });
  if (out.status !== 0) return null;
  const v = normalizeCandidatePath((out.stdout || "").trim(), process.platform);
  return v || null;
}

function resolveWhere(name, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== "win32") return [];

  const spawnSyncImpl = options.spawnSyncImpl || spawnSync;
  const out = spawnSyncImpl("where", [name], {
    encoding: "utf8",
    windowsHide: true
  });
  if (out.status !== 0) return [];
  return parseOutputLines(out.stdout, platform);
}

function detectFirefoxCandidates(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;

  const candidates = [env.FIREFOX_BIN];
  if (platform === "win32") {
    candidates.push(...resolveWhere("firefox", options));
    candidates.push(...resolveWhere("firefox.exe", options));
    candidates.push(
      "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe"
    );
  } else {
    candidates.push(resolveCommand("firefox", options));
    candidates.push(resolveCommand("firefox-esr", options));
  }

  return uniquePaths(candidates.map((c) => normalizeCandidatePath(c, platform)).filter(Boolean));
}

function detectExecutableCandidates(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const envVarName = options.envVarName;
  const commandName = options.commandName;
  const windowsFallbacks = options.windowsFallbacks || [];
  const candidates = [envVarName ? env[envVarName] : null];

  if (platform === "win32") {
    if (commandName) {
      candidates.push(...resolveWhere(commandName, options));
      candidates.push(...resolveWhere(`${commandName}.exe`, options));
    }
    candidates.push(...windowsFallbacks);
  } else if (commandName) {
    candidates.push(resolveCommand(commandName, options));
  }

  return uniquePaths(candidates.map((c) => normalizeCandidatePath(c, platform)).filter(Boolean));
}

function resolveFirstExistingExecutable(candidates, options = {}) {
  const fsApi = options.fsApi || fs;
  for (const candidate of candidates || []) {
    try {
      if (!fsApi.existsSync(candidate)) continue;
      return fsApi.realpathSync(candidate);
    } catch {
      // continuar probando candidatos
    }
  }
  return null;
}

function resolveFirefoxBinary(options = {}) {
  const platform = options.platform || process.platform;
  const log = options.log || (() => {});
  const spawnSyncImpl = options.spawnSyncImpl || spawnSync;
  const fsApi = options.fsApi || fs;
  const candidates = options.candidates || detectFirefoxCandidates(options);

  for (const candidate of candidates) {
    try {
      if (!fsApi.existsSync(candidate)) continue;
      const real = fsApi.realpathSync(candidate);

      if (platform === "win32") {
        const probe = spawnSyncImpl(real, ["--version"], { encoding: "utf8", windowsHide: true });
        if (probe.status !== 0) {
          log(`WARN: Firefox detectado en ${real}, pero '--version' devolvió status ${probe.status}; se continúa usando el binario.`);
        }
        return real;
      }

      const preferred = path.join(path.dirname(real), "firefox-bin");
      if (fsApi.existsSync(preferred)) {
        const probePreferred = spawnSyncImpl(preferred, ["--version"], { encoding: "utf8" });
        if (probePreferred.status === 0) return preferred;
      }

      const probe = spawnSyncImpl(real, ["--version"], { encoding: "utf8" });
      if (probe.status === 0) return real;
    } catch {
      // continuar probando candidatos
    }
  }
  return null;
}

function resolveGeckodriverBin(options = {}) {
  const env = options.env || process.env;
  const candidates = detectExecutableCandidates({
    ...options,
    envVarName: "GECKODRIVER_BIN",
    commandName: "geckodriver",
    windowsFallbacks: [
      env.USERPROFILE ? path.join(env.USERPROFILE, "tools", "geckodriver", "geckodriver.exe") : null
    ]
  });
  return resolveFirstExistingExecutable(candidates, options);
}

function resolveZipBin(options = {}) {
  const candidates = detectExecutableCandidates({
    ...options,
    envVarName: "ZIP_BIN",
    commandName: "zip",
    windowsFallbacks: [
      "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\zip.exe"
    ]
  });
  return resolveFirstExistingExecutable(candidates, options);
}

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

function buildTemporaryXpi(zipPath) {
  fs.mkdirSync(PRIVATE_ARTIFACTS, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(PRIVATE_ARTIFACTS, "webmatic-firefox-ext-"));
  const xpiPath = path.join(tempDir, "webmatic-temp.xpi");
  const args = ["-qr", xpiPath, "manifest.json", "src", "logo48.png"];
  const out = spawnSync(zipPath, args, { cwd: ROOT, encoding: "utf8" });
  if (out.status !== 0) {
    const stderr = (out.stderr || "").trim();
    throw new Error(`No se pudo crear XPI temporal con zip: ${stderr || "error desconocido"}`);
  }
  return { tempDir, xpiPath };
}

function startGeckodriver(geckodriverPath, log) {
  const proc = spawn(geckodriverPath, ["--port", String(GECKO_PORT)], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const lines = [];
  const capture = (src, chunk) => {
    const text = String(chunk || "").trim();
    if (!text) return;
    const line = `[${src}] ${text}`;
    lines.push(line);
    if (lines.length > 60) lines.shift();
  };

  proc.stdout.on("data", (c) => capture("stdout", c));
  proc.stderr.on("data", (c) => capture("stderr", c));

  const ready = (async () => {
    const started = Date.now();
    const timeoutMs = 20000;

    while (Date.now() - started < timeoutMs) {
      if (proc.exitCode !== null) {
        throw new Error(`geckodriver terminó antes de iniciar (code=${proc.exitCode})`);
      }

      try {
        const res = await fetch(`http://127.0.0.1:${GECKO_PORT}/status`);
        if (res.ok) return;
      } catch {
        // geckodriver aún no está listo
      }

      await sleep(250);
    }

    throw new Error("Timeout iniciando geckodriver");
  })();

  return {
    proc,
    ready,
    logs: lines,
    stop: async () => {
      if (!proc || proc.killed) return;
      proc.kill("SIGTERM");
      await sleep(300);
      if (!proc.killed) proc.kill("SIGKILL");
      log("geckodriver finalizado");
    }
  };
}

async function wdRequest(method, route, body) {
  const res = await fetch(`http://127.0.0.1:${GECKO_PORT}${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await res.text();
  let json = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { raw };
  }

  const value = json.value !== undefined ? json.value : json;
  if (!res.ok || (value && value.error)) {
    throw new Error(`WebDriver ${method} ${route} -> ${JSON.stringify(value)}`);
  }

  return json;
}

function getSessionId(createSessionResponse) {
  if (createSessionResponse.sessionId) return createSessionResponse.sessionId;
  if (createSessionResponse.value && createSessionResponse.value.sessionId) return createSessionResponse.value.sessionId;
  return null;
}

async function readMarkers(sessionId) {
  const result = await wdRequest("POST", `/session/${sessionId}/execute/sync`, {
    script: `
      const style = document.getElementById("webmatic-style-link");
      const panel = document.getElementById("webmatic-panel-root");
      const root = document.documentElement;
      return {
        url: location.href,
        title: document.title,
        fixtureLoaded: !!document.getElementById("wm-input") && !!document.getElementById("wm-select"),
        hasStyleLink: !!style,
        styleHref: style ? style.getAttribute("href") : null,
        hasPanelRoot: !!panel,
        panelDisplay: panel ? panel.style.display || "" : null,
        htmlLength: root ? root.outerHTML.length : 0
      };
    `,
    args: []
  });

  return result.value !== undefined ? result.value : result;
}

async function execSync(sessionId, script, args = []) {
  const result = await wdRequest("POST", `/session/${sessionId}/execute/sync`, {
    script,
    args
  });
  return result.value !== undefined ? result.value : result;
}

async function main() {
  const log = makeSafeLogger({ secrets: [] });
  log("Inicio test:e2e:firefox-extension (Firefox real, fixture local, read-only)");

  const firefoxPath = resolveFirefoxBinary({ log });
  const geckodriverPath = resolveGeckodriverBin();
  const webExtPath = resolveCommand("web-ext");
  const zipPath = resolveZipBin();

  log(`Tooling detectado: firefox=${firefoxPath ? "sí" : "no"}, geckodriver=${geckodriverPath ? "sí" : "no"}, web-ext=${webExtPath ? "sí" : "no"}, zip=${zipPath ? "sí" : "no"}`);
  log(`IAPOS_E2E_REAL=${process.env.IAPOS_E2E_REAL === "1" ? "1" : "0"} (debe ser 0 en este runner)`);

  if (process.env.IAPOS_E2E_REAL === "1") {
    log("FAIL: este runner no permite IAPOS_E2E_REAL=1");
    process.exitCode = 1;
    return;
  }

  if (!firefoxPath || !geckodriverPath || !zipPath) {
    log("FAIL: faltan dependencias locales para automatizar Firefox real (se requiere firefox + geckodriver + zip)");
    if (!firefoxPath) log("Detalle: firefox no encontrado en PATH");
    if (!geckodriverPath) log("Detalle: geckodriver no encontrado en PATH");
    if (!zipPath) log("Detalle: zip no encontrado en PATH");
    process.exitCode = 1;
    return;
  }

  const server = await startFixtureServer();
  const checks = {
    firefoxSessionStarted: false,
    extensionInstalledTemporary: false,
    fixtureOpened: false,
    contentScriptInjected: false,
    panelPresentOrMountReady: false,
    inventoryModuleWorks: false,
    visualEditorFlowPassed: false,
    valueDropdownVisible: false,
    valueDropdownHasRealOptions: false,
    stepUpdatedFromDropdown: false,
    iimReflectsEditedValue: false,
    playbackAppliedExpectedValue: false,
    iaposRealDisabled: process.env.IAPOS_E2E_REAL !== "1",
    dangerousActionsExecuted: false
  };

  let gecko;
  let sessionId = null;
  let addonInstallResult = null;
  let markers = null;
  let tempXpiDir = null;

  try {
    const xpi = buildTemporaryXpi(zipPath);
    tempXpiDir = xpi.tempDir;
    log(`XPI temporal generado: ${path.basename(xpi.xpiPath)}`);

    gecko = startGeckodriver(geckodriverPath, log);
    await gecko.ready;
    log("geckodriver listo");

    const sessionResp = await wdRequest("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          acceptInsecureCerts: true,
          "moz:firefoxOptions": {
            args: ["-headless"],
            prefs: {
              "xpinstall.signatures.required": false,
              "extensions.autoDisableScopes": 0,
              "extensions.enabledScopes": 15
            }
          }
        }
      }
    });

    sessionId = getSessionId(sessionResp);
    if (!sessionId) throw new Error("No se obtuvo sessionId desde geckodriver");
    checks.firefoxSessionStarted = true;
    log("Sesión Firefox iniciada");

    addonInstallResult = await wdRequest("POST", `/session/${sessionId}/moz/addon/install`, {
      path: xpi.xpiPath,
      temporary: true
    });

    checks.extensionInstalledTemporary = true;
    log("Extensión temporal instalada en Firefox");

    await wdRequest("POST", `/session/${sessionId}/url`, {
      url: `http://localhost:${PORT}/iapos-safe-page.html`
    });

    checks.fixtureOpened = true;

    const started = Date.now();
    const timeoutMs = 18000;
    while (Date.now() - started < timeoutMs) {
      markers = await readMarkers(sessionId);
      if (markers.hasStyleLink || markers.hasPanelRoot) {
        checks.contentScriptInjected = true;
        checks.panelPresentOrMountReady = !!markers.hasPanelRoot;
        break;
      }
      await sleep(500);
    }

    if (!checks.contentScriptInjected) {
      log(`DIAG addonInstallResult=${JSON.stringify(addonInstallResult.value !== undefined ? addonInstallResult.value : addonInstallResult)}`);
      log(`DIAG markers=${JSON.stringify(markers)}`);
      if (gecko && gecko.logs.length) {
        log(`DIAG geckodriverTail=${JSON.stringify(gecko.logs.slice(-12))}`);
      }
      throw new Error("No se detectó inyección de content script en fixture local de Firefox");
    }

    log(`OK: inyección detectada hasStyleLink=${markers.hasStyleLink ? "sí" : "no"} hasPanelRoot=${markers.hasPanelRoot ? "sí" : "no"}`);

    // ── Validación del módulo de inventario en Firefox real ─────────────────
    // El módulo se inyecta en el contexto de la página (window === globalThis)
    // y se ejecuta contra la fixture real para confirmar que captura controles
    // y ofrece las opciones predefinidas de un <select> (VALUE como dropdown).
    const inventorySrc = fs.readFileSync(
      path.join(ROOT, "src", "modules", "inventory", "page-inventory.js"),
      "utf8"
    );
    const invResp = await wdRequest("POST", `/session/${sessionId}/execute/sync`, {
      script: `
        ${inventorySrc}
        const api = (typeof globalThis !== "undefined" && globalThis.WebMaticPageInventory) || window.WebMaticPageInventory;
        if (!api) return { hasApi: false };
        const snap = api.captureInventory(document);
        const opts = api.findOptionsForSelector("#filtro-modalidad", [snap]);
        return {
          hasApi: true,
          controlCount: snap.controls.length,
          optCount: opts ? opts.length : 0,
          optValues: opts ? opts.map((o) => o.value) : []
        };
      `,
      args: []
    });
    const invValue = invResp.value !== undefined ? invResp.value : invResp;
    if (invValue && invValue.hasApi && invValue.controlCount > 0 && invValue.optCount === 2) {
      checks.inventoryModuleWorks = true;
      log(`OK: inventario capturó ${invValue.controlCount} controles; opciones de #filtro-modalidad=[${invValue.optValues.join(", ")}]`);
    } else {
      log(`DIAG inventory=${JSON.stringify(invValue)}`);
      throw new Error("El módulo de inventario no funcionó correctamente en Firefox real");
    }

    // ── Flujo UI real: grabar -> editar paso -> dropdown VALUE -> guardar -> replay ──
    const macroName = `E2E Inventory ${Date.now()}`;

    // 1) Abrir panel y empezar grabación real desde UI.
    const startedRecording = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      if (!panel) return { ok: false, reason: "panel_missing" };
      panel.style.display = "block";
      const btn = panel.querySelector("[data-action='record-toggle'][data-record-btn]");
      if (!btn) return { ok: false, reason: "record_btn_missing" };
      btn.click();
      return { ok: true, text: btn.textContent || "" };
    `);
    if (!startedRecording || !startedRecording.ok) {
      throw new Error(`No se pudo iniciar grabación desde UI: ${JSON.stringify(startedRecording)}`);
    }

    const recStartedAt = Date.now();
    while (Date.now() - recStartedAt < 10000) {
      const recState = await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const btn = panel && panel.querySelector("[data-action='record-toggle'][data-record-btn]");
        return !!(btn && btn.dataset && btn.dataset.recording === "true");
      `);
      if (recState) break;
      await sleep(200);
    }

    // 2) Interactuar con select real de fixture para generar choose_option.
    const interacted = await execSync(sessionId, `
      const sel = document.getElementById("filtro-modalidad");
      if (!sel) return { ok: false, reason: "fixture_select_missing" };
      sel.focus();
      sel.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      sel.value = "2";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, value: sel.value };
    `);
    if (!interacted || !interacted.ok) {
      throw new Error(`No se pudo interactuar con select de fixture: ${JSON.stringify(interacted)}`);
    }

    // 3) Detener grabación desde UI.
    const stoppedRecording = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const btn = panel && panel.querySelector("[data-action='record-toggle'][data-record-btn]");
      if (!btn) return { ok: false, reason: "record_btn_missing_on_stop" };
      btn.click();
      return { ok: true };
    `);
    if (!stoppedRecording || !stoppedRecording.ok) {
      throw new Error(`No se pudo detener grabación desde UI: ${JSON.stringify(stoppedRecording)}`);
    }

    // 4) Esperar apertura del editor visual.
    const seOpenedAt = Date.now();
    let seVisible = false;
    while (Date.now() - seOpenedAt < 15000) {
      const state = await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const ov = panel && panel.querySelector("[data-script-editor]");
        return !!(ov && ov.style.display !== "none");
      `);
      if (state) { seVisible = true; break; }
      await sleep(250);
    }
    if (!seVisible) throw new Error("No se abrió el editor visual tras detener grabación");

    // 5) Expandir paso choose_option.
    const openedChooseStep = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const rows = Array.from(panel.querySelectorAll(".wm-sved-row"));
      let opened = false;
      for (const row of rows) {
        const t = row.querySelector(".wm-sved-type");
        if (!t) continue;
        const type = (t.textContent || "").trim();
        if (type === "choose_option") {
          const edit = row.querySelector(".wm-sved-btn-edit");
          if (edit) {
            edit.click();
            opened = true;
            break;
          }
        }
      }
      return { opened, rowCount: rows.length };
    `);
    if (!openedChooseStep || !openedChooseStep.opened) {
      throw new Error(`No se encontró/abrió paso choose_option: ${JSON.stringify(openedChooseStep)}`);
    }

    // 6) Verificar dropdown VALUE y opciones reales visibles.
    const comboReadyAt = Date.now();
    let comboInfo = null;
    while (Date.now() - comboReadyAt < 10000) {
      comboInfo = await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const combo = panel && panel.querySelector(".wm-sved-edit-form [data-wm-optcombo]");
        if (!combo) return { visible: false };
        const options = Array.from(combo.options).map((o) => ({ value: o.value, text: o.textContent || "" }));
        return { visible: true, options, value: combo.value };
      `);
      if (comboInfo && comboInfo.visible) break;
      await sleep(200);
    }
    if (!comboInfo || !comboInfo.visible) throw new Error("VALUE no se renderizó como dropdown visible");
    checks.valueDropdownVisible = true;
    const texts = (comboInfo.options || []).map((o) => String(o.text || "").trim());
    const hasAmb = texts.includes("Ambulatorio");
    const hasInt = texts.includes("Internacion");
    if (!(hasAmb && hasInt)) {
      throw new Error(`Dropdown VALUE sin opciones reales esperadas: ${JSON.stringify(comboInfo.options || [])}`);
    }
    checks.valueDropdownHasRealOptions = true;

    // 7) Cambiar VALUE desde dropdown y guardar paso.
    const changedValue = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const combo = panel && panel.querySelector(".wm-sved-edit-form [data-wm-optcombo]");
      if (!combo) return { ok: false, reason: "combo_missing" };
      combo.value = "1";
      combo.dispatchEvent(new Event("change", { bubbles: true }));
      const save = panel.querySelector(".wm-sved-edit-form .wm-sved-confirm-btn");
      if (!save) return { ok: false, reason: "step_save_missing" };
      save.click();
      const rows = Array.from(panel.querySelectorAll(".wm-sved-row"));
      let desc = "";
      for (const row of rows) {
        const typeEl = row.querySelector(".wm-sved-type");
        const descEl = row.querySelector(".wm-sved-desc");
        const type = (typeEl && typeEl.textContent ? typeEl.textContent : "").trim();
        const txt = (descEl && descEl.textContent ? descEl.textContent : "").trim();
        if (type === "choose_option" && txt.includes("#filtro-modalidad")) {
          desc = txt;
          break;
        }
      }
      return { ok: true, desc };
    `);
    if (!changedValue || !changedValue.ok) {
      throw new Error(`No se pudo cambiar/guardar VALUE desde dropdown: ${JSON.stringify(changedValue)}`);
    }
    if (!String(changedValue.desc || "").includes("= 1")) {
      throw new Error(`El step no quedó actualizado tras guardar dropdown: ${JSON.stringify(changedValue)}`);
    }
    checks.stepUpdatedFromDropdown = true;

    // 8) Guardar macro desde editor (prompt modal).
    const saveClicked = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const btn = panel && panel.querySelector("[data-action='script-editor-save']");
      if (!btn) return { ok: false, reason: "script_save_missing" };
      btn.click();
      return { ok: true };
    `);
    if (!saveClicked || !saveClicked.ok) {
      throw new Error(`No se pudo accionar Guardar macro: ${JSON.stringify(saveClicked)}`);
    }

    const modalHandled = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const input = panel && panel.querySelector("[data-wm-input]");
      const ok = panel && panel.querySelector("[data-wm-ok]");
      if (!input || !ok) return { ok: false, reason: "wm_modal_missing" };
      input.value = arguments[0];
      input.dispatchEvent(new Event("input", { bubbles: true }));
      ok.click();
      return { ok: true };
    `, [macroName]);
    if (!modalHandled || !modalHandled.ok) {
      throw new Error(`No se pudo completar modal Guardar macro: ${JSON.stringify(modalHandled)}`);
    }

    const savedAt = Date.now();
    let macroSaved = false;
    while (Date.now() - savedAt < 10000) {
      const found = await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const names = Array.from(panel.querySelectorAll(".webmatic-macro-item .webmatic-macro-name"))
          .map((n) => (n.textContent || "").trim());
        const overlay = panel && panel.querySelector("[data-script-editor]");
        return {
          exists: names.includes(arguments[0]),
          overlayOpen: !!(overlay && overlay.style.display !== "none")
        };
      `, [macroName]);
      if (found && found.exists && !found.overlayOpen) { macroSaved = true; break; }
      await sleep(250);
    }
    if (!macroSaved) throw new Error("La macro guardada no apareció en biblioteca o el editor no cerró");

    // 9) Reabrir macro, ir a tab Script y verificar IIM actualizado.
    const openedMacro = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const rows = Array.from(panel.querySelectorAll(".webmatic-macro-item"));
      const row = rows.find((r) => {
        const nameEl = r.querySelector(".webmatic-macro-name");
        return nameEl && (nameEl.textContent || "").trim() === arguments[0];
      });
      if (!row) return { ok: false, reason: "macro_row_missing" };
      const edit = row.querySelector("[data-action='macro-edit']");
      if (!edit) return { ok: false, reason: "macro_edit_missing" };
      edit.click();
      return { ok: true };
    `, [macroName]);
    if (!openedMacro || !openedMacro.ok) {
      throw new Error(`No se pudo reabrir macro guardada: ${JSON.stringify(openedMacro)}`);
    }

    const iimCheck = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const scriptTab = panel && panel.querySelector("[data-action='script-editor-tab'][data-script-tab='script']");
      if (!scriptTab) return { ok: false, reason: "script_tab_missing" };
      scriptTab.click();
      const area = panel.querySelector("[data-script-editor-area]");
      if (!area) return { ok: false, reason: "script_area_missing" };
      const txt = String(area.value || "");
      return {
        ok: true,
        hasChoose: txt.includes("CHOOSE_OPTION") && txt.includes("#filtro-modalidad"),
        hasValue1: /CHOOSE_OPTION[^\\n]*VALUE="1"/m.test(txt),
        snippet: txt.split("\\n").filter((l) => l.includes("CHOOSE_OPTION")).slice(0, 1)[0] || ""
      };
    `);
    if (!iimCheck || !iimCheck.ok || !iimCheck.hasChoose || !iimCheck.hasValue1) {
      throw new Error(`IIM no refleja VALUE editado a 1: ${JSON.stringify(iimCheck)}`);
    }
    checks.iimReflectsEditedValue = true;

    // Cerrar editor.
    await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const close = panel && panel.querySelector("[data-action='script-editor-close']");
      if (close) close.click();
      return true;
    `);

    // 10) Reproducir macro y confirmar valor final esperado en fixture.
    const startedPlay = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const rows = Array.from(panel.querySelectorAll(".webmatic-macro-item"));
      const row = rows.find((r) => {
        const nameEl = r.querySelector(".webmatic-macro-name");
        return nameEl && (nameEl.textContent || "").trim() === arguments[0];
      });
      if (!row) return { ok: false, reason: "macro_row_missing_for_play" };
      row.click();
      const play = panel.querySelector("[data-action='macro-play']");
      if (!play || play.disabled) return { ok: false, reason: "play_disabled_or_missing" };
      play.click();
      return { ok: true };
    `, [macroName]);
    if (!startedPlay || !startedPlay.ok) {
      throw new Error(`No se pudo iniciar reproducción: ${JSON.stringify(startedPlay)}`);
    }

    const playDoneAt = Date.now();
    let playbackApplied = false;
    while (Date.now() - playDoneAt < 20000) {
      const pb = await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const playBtn = panel && panel.querySelector("[data-action='macro-play']");
        const stopBtn = panel && panel.querySelector("[data-action='play-stop']");
        const sel = document.getElementById("filtro-modalidad");
        const playing = !!(stopBtn && stopBtn.style.display !== "none");
        const value = sel ? sel.value : null;
        return { playing, value, playVisible: !!(playBtn && playBtn.style.display !== "none") };
      `);
      if (pb && !pb.playing && pb.value === "1") {
        playbackApplied = true;
        break;
      }
      await sleep(300);
    }
    if (!playbackApplied) {
      throw new Error("La reproducción no dejó el valor final esperado (filtro-modalidad=1)");
    }
    checks.playbackAppliedExpectedValue = true;

    checks.visualEditorFlowPassed =
      checks.valueDropdownVisible &&
      checks.valueDropdownHasRealOptions &&
      checks.stepUpdatedFromDropdown &&
      checks.iimReflectsEditedValue &&
      checks.playbackAppliedExpectedValue;

    const failed = Object.entries(checks)
      .filter(([key, value]) => {
        if (key === "dangerousActionsExecuted") return value !== false;
        return value !== true;
      })
      .map(([key]) => key);

    if (failed.length) {
      throw new Error(`Validaciones fallidas: ${failed.join(", ")}`);
    }

    log("OK: validación Firefox-first completada sobre fixture local (sin IAPOS real)");
  } catch (e) {
    log("FAIL test:e2e:firefox-extension", e && e.message ? e.message : String(e));
    process.exitCode = 1;
  } finally {
    try {
      if (sessionId) await wdRequest("DELETE", `/session/${sessionId}`);
    } catch {
      // no-op
    }

    if (gecko) await gecko.stop();
    await new Promise((resolve) => server.close(resolve));

    if (tempXpiDir && fs.existsSync(tempXpiDir)) {
      fs.rmSync(tempXpiDir, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[firefox-extension-safe] FATAL", e && e.stack ? e.stack : e);
    process.exit(1);
  });
}

module.exports = {
  detectFirefoxCandidates,
  detectExecutableCandidates,
  resolveFirstExistingExecutable,
  resolveFirefoxBinary,
  resolveGeckodriverBin,
  resolveZipBin,
  normalizeCandidatePath,
  parseOutputLines
};
