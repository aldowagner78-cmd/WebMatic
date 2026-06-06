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

function resolveCommand(name) {
  const out = spawnSync("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" });
  if (out.status !== 0) return null;
  const v = (out.stdout || "").trim();
  return v || null;
}

function resolveFirefoxBinary() {
  const candidates = [resolveCommand("firefox"), resolveCommand("firefox-esr")].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const real = fs.realpathSync(candidate);
      const preferred = path.join(path.dirname(real), "firefox-bin");
      const probePreferred = spawnSync(preferred, ["--version"], { encoding: "utf8" });
      if (probePreferred.status === 0) return preferred;

      const probe = spawnSync(real, ["--version"], { encoding: "utf8" });
      if (probe.status === 0) return real;
    } catch {
      // continuar probando candidatos
    }
  }
  return null;
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

async function main() {
  const log = makeSafeLogger({ secrets: [] });
  log("Inicio test:e2e:firefox-extension (Firefox real, fixture local, read-only)");

  const firefoxPath = resolveFirefoxBinary();
  const geckodriverPath = resolveCommand("geckodriver");
  const webExtPath = resolveCommand("web-ext");
  const zipPath = resolveCommand("zip");

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

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[firefox-extension-safe] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
