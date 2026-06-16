"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const { makeSafeLogger } = require("../iapos-safe/sanitize-log");

const ROOT = path.resolve(__dirname, "../../..");
const REPO_ROOT = path.resolve(ROOT, "../..");
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
  const packagingCwd = REPO_ROOT;
  const args = ["-qr", xpiPath, "manifest.json", "src", "logo48.png"];
  const out = spawnSync(zipPath, args, { cwd: packagingCwd, encoding: "utf8", windowsHide: true });
  if (out.status === 0 && fs.existsSync(xpiPath)) {
    return { tempDir, xpiPath };
  }

  if (process.platform === "win32") {
    const xpiEsc = xpiPath.replace(/'/g, "''");
    const psScript = [
      "$ErrorActionPreference='Stop'",
      "$tmp = Join-Path ([System.IO.Path]::GetDirectoryName('" + xpiEsc + "')) 'webmatic-temp.zip'",
      "if (Test-Path $tmp) { Remove-Item $tmp -Force }",
      "Compress-Archive -Path manifest.json,src,logo48.png -DestinationPath $tmp -Force",
      "if (Test-Path '" + xpiEsc + "') { Remove-Item '" + xpiEsc + "' -Force }",
      "Move-Item -Path $tmp -Destination '" + xpiEsc + "' -Force"
    ].join("; ");

    const ps = spawnSync("powershell", ["-NoProfile", "-Command", psScript], {
      cwd: packagingCwd,
      encoding: "utf8",
      windowsHide: true
    });

    if (ps.status === 0 && fs.existsSync(xpiPath)) {
      return { tempDir, xpiPath };
    }

    const zipErr = String((out.stderr || out.stdout || "").trim() || "error desconocido");
    const psErr = String((ps.stderr || ps.stdout || "").trim() || "error desconocido");
    throw new Error(`No se pudo crear XPI temporal. zip=${zipErr} | powershell=${psErr}`);
  }

  const stderr = (out.stderr || out.stdout || "").trim();
  throw new Error(`No se pudo crear XPI temporal con zip: ${stderr || "error desconocido"}`);
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

async function getWindowHandles(sessionId) {
  const res = await wdRequest("GET", `/session/${sessionId}/window/handles`);
  const value = res.value !== undefined ? res.value : res;
  return Array.isArray(value) ? value : [];
}

async function switchToWindow(sessionId, handle) {
  await wdRequest("POST", `/session/${sessionId}/window`, { handle });
}

async function closeCurrentWindow(sessionId) {
  await wdRequest("DELETE", `/session/${sessionId}/window`);
}

async function waitUntil(sessionId, script, timeoutMs = 10000, intervalMs = 200) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await execSync(sessionId, script);
    if (ok) return true;
    await sleep(intervalMs);
  }
  return false;
}

function sanitizeFixtureName(file) {
  return String(file || "")
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function openFixture(sessionId, fixtureFile) {
  await wdRequest("POST", `/session/${sessionId}/url`, {
    url: `http://localhost:${PORT}/${fixtureFile}`
  });
}

async function ensurePanelVisible(sessionId) {
  const opened = await execSync(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    if (!panel) return false;
    panel.style.display = "block";
    return true;
  `);
  if (!opened) throw new Error("Panel WebMatic no disponible en fixture");
}

async function startRecordingFromUi(sessionId) {
  const res = await execSync(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const btn = panel && panel.querySelector("[data-action='record-toggle'][data-record-btn]");
    if (!btn) return { ok: false, reason: "record_btn_missing" };
    btn.click();
    return { ok: true };
  `);
  if (!res || !res.ok) throw new Error(`No se pudo iniciar grabación: ${JSON.stringify(res)}`);

  const recording = await waitUntil(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const btn = panel && panel.querySelector("[data-action='record-toggle'][data-record-btn]");
    return !!(btn && btn.dataset && btn.dataset.recording === "true");
  `, 12000, 250);

  if (!recording) throw new Error("La grabación no pasó a estado activo");
}

async function stopRecordingFromUi(sessionId) {
  const res = await execSync(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const btn = panel && panel.querySelector("[data-action='record-toggle'][data-record-btn]");
    if (!btn) return { ok: false, reason: "record_btn_missing" };
    btn.click();
    return { ok: true };
  `);
  if (!res || !res.ok) throw new Error(`No se pudo detener grabación: ${JSON.stringify(res)}`);

  const editorVisible = await waitUntil(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const ov = panel && panel.querySelector("[data-script-editor]");
    return !!(ov && ov.style.display !== "none");
  `, 15000, 250);

  if (!editorVisible) throw new Error("No se abrió el editor visual tras detener grabación");
}

async function interactFixture(sessionId, fixtureFile) {
  const result = await execSync(sessionId, `
    const fixture = arguments[0];
    const emitType = (el, txt) => {
      if (!el) return false;
      el.focus();
      el.value = txt;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    const pickFirst = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.click();
      return true;
    };

    if (fixture === "universal-macro-fixture.html") {
      const a = emitType(document.getElementById("dni"), "30111222");
      const b = emitType(document.getElementById("apellido"), "ANA TORRES");
      const c = emitType(document.getElementById("busqueda"), "auditoria");
      const sel = document.getElementById("ver");
      if (sel) {
        sel.value = "all";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const d = !!pickFirst("#btn-search");
      return { ok: !!(a && b && c && d) };
    }

    if (fixture === "modern-autocomplete.html") {
      const inp = document.getElementById("modern-affiliate");
      const ok1 = emitType(inp, "wa");
      const item = document.querySelector("#modern-affiliate-list .suggest-item");
      if (item) item.click();
      const mode = document.getElementById("modern-mode");
      if (mode) {
        mode.value = "safe";
        mode.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const notes = emitType(document.getElementById("modern-notes"), "nota-e2e");
      return { ok: !!(ok1 && notes) };
    }

    if (fixture === "legacy-autocomplete.html") {
      const d = document.getElementById("legacy-deleg");
      const s = document.getElementById("legacy-spec");
      const ok1 = emitType(d, "ALV");
      const ok2 = emitType(s, "CAR");
      if (typeof window.legacySuggest === "function") {
        window.legacySuggest("legacy-deleg", "legacy-deleg-menu", "legacy-deleg-code", window.LEGACY_DELEG || []);
        window.legacySuggest("legacy-spec", "legacy-spec-menu", "legacy-spec-code", window.LEGACY_SPEC || []);
      }
      pickFirst("#legacy-deleg-menu div");
      pickFirst("#legacy-spec-menu div");
      const mode = document.getElementById("legacy-mode");
      if (mode) {
        mode.value = "2";
        mode.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return { ok: !!(ok1 && ok2) };
    }

    if (fixture === "genexus-subpage.html") {
      const ok1 = emitType(document.getElementById("vDELEGACION"), "ALV");
      pickFirst("#vDELEGACION_menu button");
      const ok2 = emitType(document.getElementById("vAUCAESPEFC"), "CAR");
      pickFirst("#vAUCAESPEFC_menu button");
      const ok3 = !!pickFirst("#gx-search");
      return { ok: !!(ok1 && ok2 && ok3) };
    }

    if (fixture === "iapos-subpage.html") {
      const ok1 = emitType(document.getElementById("iapos-deleg"), "BEL");
      pickFirst("#iapos-deleg-menu button");
      const ok2 = emitType(document.getElementById("iapos-spec"), "DER");
      pickFirst("#iapos-spec-menu button");
      const mode = document.getElementById("iapos-modalidad");
      if (mode) {
        mode.value = "int";
        mode.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const ok3 = !!pickFirst("#iapos-buscar");
      return { ok: !!(ok1 && ok2 && ok3) };
    }

    if (fixture === "new-tab-subpage-fixture.html") {
      const ok1 = emitType(document.getElementById("nt-username"), "usuario-e2e");
      const mode = document.getElementById("nt-mode");
      if (mode) {
        mode.value = "safe";
        mode.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const ok2 = !!pickFirst("#nt-open-window");
      const ok3 = !!pickFirst("#nt-open-blank-link");
      return { ok: !!(ok1 && ok2 && ok3) };
    }

    return { ok: false, reason: "fixture_not_supported" };
  `, [fixtureFile]);

  if (!result || !result.ok) {
    throw new Error(`No se pudo interactuar con fixture ${fixtureFile}: ${JSON.stringify(result)}`);
  }
}

async function saveCurrentRecordingAsMacro(sessionId, macroName) {
  const saveClicked = await execSync(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const btn = panel && panel.querySelector("[data-action='script-editor-save']");
    if (!btn) return { ok: false, reason: "script_save_missing" };
    btn.click();
    return { ok: true };
  `);
  if (!saveClicked || !saveClicked.ok) throw new Error(`No se pudo accionar Guardar macro: ${JSON.stringify(saveClicked)}`);

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
  if (!modalHandled || !modalHandled.ok) throw new Error(`No se pudo completar modal guardar macro: ${JSON.stringify(modalHandled)}`);

  const saved = await waitUntil(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const names = Array.from(panel.querySelectorAll(".webmatic-macro-item .webmatic-macro-name")).map((n) => (n.textContent || "").trim());
    const ov = panel && panel.querySelector("[data-script-editor]");
    return names.includes(arguments[0]) && !(ov && ov.style.display !== "none");
  `.replace("arguments[0]", JSON.stringify(macroName)), 12000, 250);

  if (!saved) throw new Error(`La macro no apareció guardada: ${macroName}`);
}

async function readMacroScript(sessionId, macroName) {
  const opened = await execSync(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const rows = Array.from(panel.querySelectorAll(".webmatic-macro-item"));
    const row = rows.find((r) => {
      const n = r.querySelector(".webmatic-macro-name");
      return n && (n.textContent || "").trim() === arguments[0];
    });
    if (!row) return { ok: false, reason: "macro_row_missing" };
    const edit = row.querySelector("[data-action='macro-edit']");
    if (!edit) return { ok: false, reason: "macro_edit_missing" };
    edit.click();
    return { ok: true };
  `, [macroName]);
  if (!opened || !opened.ok) throw new Error(`No se pudo abrir macro para análisis: ${JSON.stringify(opened)}`);

  const read = await execSync(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const tab = panel && panel.querySelector("[data-action='script-editor-tab'][data-script-tab='script']");
    if (!tab) return { ok: false, reason: "script_tab_missing" };
    tab.click();
    const area = panel.querySelector("[data-script-editor-area]");
    if (!area) return { ok: false, reason: "script_area_missing" };
    return { ok: true, text: String(area.value || "") };
  `);

  await execSync(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const close = panel && panel.querySelector("[data-action='script-editor-close']");
    if (close) close.click();
    return true;
  `);

  if (!read || !read.ok) throw new Error(`No se pudo leer script de macro: ${JSON.stringify(read)}`);
  return String(read.text || "");
}

async function validateNewTabFlow(sessionId, fixtureFile, log) {
  const baseHandles = await getWindowHandles(sessionId);
  const baseHandle = baseHandles[0] || null;
  if (!baseHandle) {
    throw new Error("No se pudo obtener handle base de ventana");
  }

  await openFixture(sessionId, fixtureFile);
  await ensurePanelVisible(sessionId);
  await startRecordingFromUi(sessionId);
  await interactFixture(sessionId, fixtureFile);

  const opened = await waitUntil(sessionId, `
    return (window.__wm_e2e_wait = true), true;
  `, 400, 200);
  if (!opened) throw new Error("Espera interna no disponible");

  const handlesAfterOpen = await getWindowHandles(sessionId);
  if (handlesAfterOpen.length < 2) {
    throw new Error(`No se detectó apertura de nueva pestaña. Handles=${handlesAfterOpen.length}`);
  }

  const newHandle = handlesAfterOpen.find((h) => !baseHandles.includes(h));
  if (!newHandle) {
    throw new Error("No se pudo identificar el handle de la nueva pestaña");
  }

  await switchToWindow(sessionId, newHandle);
  const childInfo = await execSync(sessionId, `
    return { href: location.href, title: document.title || "" };
  `);

  await closeCurrentWindow(sessionId);
  await switchToWindow(sessionId, baseHandle);

  await stopRecordingFromUi(sessionId);

  const macroName = `E2E new-tab-subpage ${Date.now()}`;
  await saveCurrentRecordingAsMacro(sessionId, macroName);
  const scriptText = await readMacroScript(sessionId, macroName);

  const baseUrl = await execSync(sessionId, `return location.href;`);
  const playbackStarted = await execSync(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const rows = Array.from(panel.querySelectorAll(".webmatic-macro-item"));
    const row = rows.find((r) => {
      const n = r.querySelector(".webmatic-macro-name");
      return n && (n.textContent || "").trim() === arguments[0];
    });
    if (!row) return { ok: false, reason: "macro_row_missing_for_play" };
    row.click();
    const play = panel.querySelector("[data-action='macro-play']");
    if (!play || play.disabled) return { ok: false, reason: "play_disabled_or_missing" };
    play.click();
    return { ok: true };
  `, [macroName]);
  if (!playbackStarted || !playbackStarted.ok) {
    throw new Error(`No se pudo iniciar reproducción de macro new-tab: ${JSON.stringify(playbackStarted)}`);
  }

  const playbackFinished = await waitUntil(sessionId, `
    const panel = document.getElementById("webmatic-panel-root");
    const stopBtn = panel && panel.querySelector("[data-action='play-stop']");
    return !(stopBtn && stopBtn.style.display !== "none");
  `, 20000, 300);
  if (!playbackFinished) {
    throw new Error("La reproducción de macro new-tab quedó trabada");
  }

  const finalHandles = await getWindowHandles(sessionId);
  const afterUrl = await execSync(sessionId, `return location.href;`);

  log(`OK: new-tab child=${JSON.stringify(childInfo)} finalHandles=${finalHandles.length}`);

  return {
    fixture: fixtureFile,
    macroName,
    script: scriptText,
    child: childInfo,
    baseUrl: String(baseUrl || ""),
    afterUrl: String(afterUrl || ""),
    handlesAfterOpen: handlesAfterOpen.length,
    handlesAfterPlayback: finalHandles.length
  };
}

async function main() {
  const log = makeSafeLogger({ secrets: [] });
  log("Inicio test:e2e:firefox-extension (Firefox real, fixture local, read-only)");
  const headed = process.env.FIREFOX_E2E_HEADED === "1";
  const runMultiFixtures = process.env.FIREFOX_MULTI_FIXTURES !== "0";
  const runNewTabFlow = process.env.FIREFOX_NEW_TAB_FLOW !== "0";

  const firefoxPath = resolveFirefoxBinary({ log });
  const geckodriverPath = resolveGeckodriverBin();
  const webExtPath = resolveCommand("web-ext");
  const zipPath = resolveZipBin();

  log(`Tooling detectado: firefox=${firefoxPath ? "sí" : "no"}, geckodriver=${geckodriverPath ? "sí" : "no"}, web-ext=${webExtPath ? "sí" : "no"}, zip=${zipPath ? "sí" : "no"}`);
  log(`IAPOS_E2E_REAL=${process.env.IAPOS_E2E_REAL === "1" ? "1" : "0"} (debe ser 0 en este runner)`);
  log(`FIREFOX_E2E_HEADED=${headed ? "1" : "0"}`);
  log(`FIREFOX_MULTI_FIXTURES=${runMultiFixtures ? "1" : "0"}`);
  log(`FIREFOX_NEW_TAB_FLOW=${runNewTabFlow ? "1" : "0"}`);

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
    recorderInputStreamCaptured: false,
    stepUpdatedFromDropdown: false,
    iimReflectsEditedValue: false,
    playbackAppliedExpectedValue: false,
    multiFixturesVisited: false,
    multiMacrosSaved: false,
    multiScriptsCaptured: false,
    newTabOpenCloseFlowPassed: false,
    newTabPlaybackNotStuck: false,
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
            args: headed ? [] : ["-headless"],
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
      path.join(REPO_ROOT, "src", "modules", "inventory", "page-inventory.js"),
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

    // 2) Interactuar con input real de fixture para validar captura de escritura.
    // No disparamos change/blur: el caso crítico real es escribir, esperar y borrar
    // dentro del mismo campo antes de detener la grabación.
    const inputTyped = await execSync(sessionId, `
      const input = document.getElementById("filtro-tabla");
      if (!input) return { ok: false, reason: "fixture_input_missing" };
      input.focus();
      input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      input.value = "ana";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: "ana" }));
      return { ok: true, value: input.value, active: document.activeElement === input };
    `);
    if (!inputTyped || !inputTyped.ok) {
      throw new Error(`No se pudo escribir en #filtro-tabla: ${JSON.stringify(inputTyped)}`);
    }

    await sleep(1500);

    const inputCleared = await execSync(sessionId, `
      const input = document.getElementById("filtro-tabla");
      if (!input) return { ok: false, reason: "fixture_input_missing_on_clear" };
      input.focus();
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "a", code: "KeyA" }));
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, ctrlKey: true, key: "a", code: "KeyA" }));
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Backspace", code: "Backspace" }));
      input.value = "";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "deleteContentBackward", data: null }));
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Backspace", code: "Backspace" }));
      return { ok: true, value: input.value, active: document.activeElement === input };
    `);
    if (!inputCleared || !inputCleared.ok) {
      throw new Error(`No se pudo limpiar #filtro-tabla: ${JSON.stringify(inputCleared)}`);
    }

    // 3) Interactuar con select real de fixture para generar choose_option.
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

    // 4) Detener grabación desde UI.
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

    // 5) Esperar apertura del editor visual.
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

    const streamInputCheck = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      const scriptTab = panel && panel.querySelector("[data-action='script-editor-tab'][data-script-tab='script']");
      if (!scriptTab) return { ok: false, reason: "script_tab_missing_for_input_check" };
      scriptTab.click();
      const area = panel.querySelector("[data-script-editor-area]");
      if (!area) return { ok: false, reason: "script_area_missing_for_input_check" };
      const txt = String(area.value || "");
      const hasTypeAna = /TYPE\\s+SELECTOR="#filtro-tabla"\\s+CONTENT="ana"/m.test(txt);
      const hasTypeEmpty = /TYPE\\s+SELECTOR="#filtro-tabla"\\s+CONTENT=""/m.test(txt);
      const visualTab = panel.querySelector("[data-action='script-editor-tab'][data-script-tab='visual']");
      if (visualTab) visualTab.click();
      return {
        ok: true,
        hasTypeAna,
        hasTypeEmpty,
        snippet: txt.split("\\n").filter((l) => l.includes("#filtro-tabla")).slice(0, 6)
      };
    `);
    if (!streamInputCheck || !streamInputCheck.ok || !streamInputCheck.hasTypeAna || !streamInputCheck.hasTypeEmpty) {
      throw new Error(`Captura real de input incompleta para #filtro-tabla: ${JSON.stringify(streamInputCheck)}`);
    }
    checks.recorderInputStreamCaptured = true;

    // 6) Expandir bloques colapsados y abrir el paso del select grabado.
    const openedChooseStep = await execSync(sessionId, `
      const panel = document.getElementById("webmatic-panel-root");
      if (!panel) return { opened: false, rowCount: 0, reason: "panel_missing" };

      // Asegura visibilidad de filas cuando el editor inicia con bloques colapsados.
      const toggles = Array.from(panel.querySelectorAll(".wm-sved-block-toggle"));
      toggles.forEach((btn) => {
        const expanded = btn && String(btn.getAttribute("aria-expanded") || "").toLowerCase() === "true";
        if (!expanded) btn.click();
      });

      const rows = Array.from(panel.querySelectorAll(".wm-sved-row"));
      let opened = false;
      for (const row of rows) {
        const t = row.querySelector(".wm-sved-type");
        if (!t) continue;
        const type = (t.textContent || "").trim();
        const desc = row.querySelector(".wm-sved-desc");
        const descText = (desc && desc.textContent) ? String(desc.textContent) : "";
        const isTargetSelect = descText.includes("#filtro-modalidad");
        if (type === "choose_option" || ((type === "input" || type === "text") && isTargetSelect)) {
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

    // 7) Verificar dropdown VALUE y opciones reales visibles.
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

    // 8) Cambiar VALUE desde dropdown y guardar paso.
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

    // 9) Guardar macro desde editor (prompt modal).
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

    // 10) Reabrir macro, ir a tab Script y verificar IIM actualizado.
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

    // 11) Reproducir macro y confirmar valor final esperado en fixture.
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
      checks.recorderInputStreamCaptured &&
      checks.valueDropdownVisible &&
      checks.valueDropdownHasRealOptions &&
      checks.stepUpdatedFromDropdown &&
      checks.iimReflectsEditedValue &&
      checks.playbackAppliedExpectedValue;

    let newTabEvidence = null;
    if (runNewTabFlow) {
      log("RUN: validación apertura de nueva pestaña + reproducción sin trabas");
      newTabEvidence = await validateNewTabFlow(sessionId, "new-tab-subpage-fixture.html", log);
      checks.newTabOpenCloseFlowPassed = newTabEvidence.handlesAfterOpen >= 2;
      checks.newTabPlaybackNotStuck = newTabEvidence.handlesAfterPlayback >= 1;
    }

    if (runMultiFixtures) {
      const fixtures = [
        "universal-macro-fixture.html",
        "modern-autocomplete.html",
        "legacy-autocomplete.html",
        "genexus-subpage.html",
        "iapos-subpage.html",
        "new-tab-subpage-fixture.html"
      ];

      const macroBundle = {
        generatedAt: new Date().toISOString(),
        headed,
        fixtures,
        macros: []
      };

      if (newTabEvidence) {
        macroBundle.newTabEvidence = newTabEvidence;
      }

      for (const fixtureFile of fixtures) {
        log(`RUN: grabación supervisada en fixture ${fixtureFile}`);
        await openFixture(sessionId, fixtureFile);
        await ensurePanelVisible(sessionId);
        await startRecordingFromUi(sessionId);
        await interactFixture(sessionId, fixtureFile);
        await stopRecordingFromUi(sessionId);

        const macroName = `E2E ${sanitizeFixtureName(fixtureFile)} ${Date.now()}`;
        await saveCurrentRecordingAsMacro(sessionId, macroName);
        const scriptText = await readMacroScript(sessionId, macroName);

        macroBundle.macros.push({
          fixture: fixtureFile,
          name: macroName,
          script: scriptText
        });
      }

      const stamp = Date.now();
      fs.mkdirSync(PRIVATE_ARTIFACTS, { recursive: true });
      const outJson = path.join(PRIVATE_ARTIFACTS, `firefox-multi-macros-${stamp}.json`);
      fs.writeFileSync(outJson, JSON.stringify(macroBundle, null, 2), "utf8");

      checks.multiFixturesVisited = macroBundle.macros.length === fixtures.length;
      checks.multiMacrosSaved = macroBundle.macros.every((m) => m.name && m.name.length > 0);
      checks.multiScriptsCaptured = macroBundle.macros.every((m) => /VERSION BUILD=1000/.test(String(m.script || "")));

      log(`OK: macros guardadas para análisis (${macroBundle.macros.length}) en ${outJson}`);
    }

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
