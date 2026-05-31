"use strict";

const { test: base } = require("@playwright/test");
const { _electron: electronLib } = require("@playwright/test");
const path = require("path");
const fs   = require("fs");
const os   = require("os");
const http = require("http");

const MAIN      = path.join(__dirname, "../../main.js");
const TEST_PAGE = path.join(__dirname, "../../../../test-page");
const ELECTRON_BIN = require("electron");

// ── Servidor HTTP local que sirve test-page/ ──────────────────────────
async function startHttpServer() {
  const MIME = {
    ".html": "text/html",
    ".css":  "text/css",
    ".js":   "application/javascript",
    ".png":  "image/png"
  };
  const server = http.createServer((req, res) => {
    const urlPath = req.url.split("?")[0];
    const file    = path.join(TEST_PAGE, urlPath === "/" ? "index.html" : urlPath);
    try {
      const data = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "text/plain" });
      res.end(data);
    } catch {
      res.writeHead(404); res.end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve); // puerto aleatorio
  });
  return server;
}

const test = base.extend({
  // Servidor HTTP — scope worker (uno por archivo de tests)
  testServer: [async ({}, use) => {
    const server = await startHttpServer();
    const { port } = server.address();
    await use({ port, url: `http://127.0.0.1:${port}` });
    await new Promise(r => server.close(r));
  }, { scope: "worker" }],

  // App Electron con directorio de datos aislado — scope worker
  electronApp: [async ({ testServer }, use) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wm-e2e-"));

    // Pre-poblamos settings: startupUrl = test server para que el preload se inyecte
    fs.writeFileSync(
      path.join(tmpDir, "webmatic-settings.json"),
      JSON.stringify({ themeMode: "dark", themeVariant: 1, startupUrl: testServer.url })
    );

    const app = await electronLib.launch({
      executablePath: ELECTRON_BIN,
      args: [MAIN],
      env: { ...process.env, WM_TEST_DATA_DIR: tmpDir }
    });

    await use(app);

    await app.close().catch(() => {});
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, { scope: "worker" }],

  // Ventana principal (renderer) — por test
  page: async ({ electronApp }, use) => {
    const win = await electronApp.firstWindow();
    // Esperar a que el renderer aplique el tema (init() completo)
    await win.waitForFunction(
      () => document.documentElement.style.getPropertyValue("--wm-accent") !== "",
      { timeout: 10_000 }
    );
    await use(win);
  }
});

module.exports = { test, expect: base.expect };
