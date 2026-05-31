/**
 * WebMatic — Test E2E con Playwright + Edge
 *
 * Estrategia DOM-based (aislamiento de mundos en Chromium):
 *  • Content scripts corren en "isolated world" → page.evaluate NO puede acceder
 *    a WebMaticStore, WebMaticPlayer ni ninguna variable del content script.
 *  • El DOM sí es compartido → usamos elementos del DOM para detectar estado.
 *  • Para abrir el panel enviamos OPEN_PANEL desde la background page via ctx.backgroundPages().
 *  • Todas las interacciones son clicks/fills reales sobre el DOM de la extensión.
 *
 * Uso: node tests/e2e/run.js
 */

"use strict";

const { chromium } = require("playwright");
const http          = require("http");
const fs            = require("fs");
const path          = require("path");
const os            = require("os");

// ── Rutas ───────────────────────────────────────────────────────────────────

const ROOT           = path.resolve(__dirname, "../..");
const TEST_PAGE_DIR  = path.join(ROOT, "test-page");
const EDGE_PATH      = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SCREENSHOTS    = path.join(__dirname, "screenshots");
const PROFILE_DIR    = path.join(os.tmpdir(), "webmatic-e2e-profile");
const PORT           = 18080;

if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });

// ── Servidor HTTP local ──────────────────────────────────────────────────────

function startServer() {
  const mime = {
    ".html": "text/html",
    ".css" : "text/css",
    ".js"  : "application/javascript",
    ".png" : "image/png",
  };
  const server = http.createServer((req, res) => {
    const urlPath = req.url.split("?")[0];
    const file    = path.join(TEST_PAGE_DIR, urlPath === "/" ? "index.html" : urlPath);
    try {
      const data = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "text/plain" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, () => resolve(server));
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let _sc = 0;
async function screenshot(page, label) {
  _sc++;
  const file = path.join(SCREENSHOTS, `${String(_sc).padStart(2, "0")}-${label}.png`);
  try { await page.screenshot({ path: file }); } catch {}
  return file;
}

function log(msg) { console.log("→", msg); }

// ── Obtener extension ID desde el DOM ────────────────────────────────────────
// El link #webmatic-style-link tiene href "chrome-extension://[ID]/..."
async function getExtensionId(page) {
  return page.evaluate(() => {
    const link = document.getElementById("webmatic-style-link");
    if (!link) return null;
    const m = link.href.match(/chrome-extension:\/\/([^/]+)\//);
    return m ? m[1] : null;
  });
}

// ── Abrir panel vía background page URL directa ──────────────────────────────
// ctx.backgroundPages() retorna [] en Edge porque el background page carga antes
// del CDP connection. Solución: navegar al URL del background page directamente
// (chrome-extension://[extId]/_generated_background_page.html).
async function openPanelViaBackground(ctx, page) {
  const extId = await getExtensionId(page);
  if (!extId) { log("⚠ No se pudo obtener extension ID"); return false; }

  const bgUrl = `chrome-extension://${extId}/_generated_background_page.html`;
  const bgPage = await ctx.newPage();

  try {
    await bgPage.goto(bgUrl, { waitUntil: "load", timeout: 8000 });
  } catch (e) {
    log("⚠ Error navegando a background page: " + e.message);
    await bgPage.close();
    return false;
  }

  const hasTabs = await bgPage.evaluate(
    () => typeof chrome !== "undefined" && typeof chrome.tabs !== "undefined"
  ).catch(() => false);

  if (!hasTabs) {
    log("⚠ chrome.tabs no disponible en background page");
    await bgPage.close();
    return false;
  }

  const tabId = await bgPage.evaluate(
    (port) => new Promise((r) =>
      chrome.tabs.query({ url: `http://localhost:${port}/*` }, (tabs) =>
        r(tabs && tabs[0] ? tabs[0].id : null)
      )
    ),
    PORT
  ).catch(() => null);

  if (!tabId) {
    log("⚠ No se encontró el tab de la página de prueba");
    await bgPage.close();
    return false;
  }

  await bgPage.evaluate(
    (id) => new Promise((r) =>
      chrome.tabs.sendMessage(id, { type: "OPEN_PANEL" }, () => {
        void chrome.runtime.lastError;
        r();
      })
    ),
    tabId
  ).catch(() => {});

  await bgPage.close();
  return true;
}

// ── Runner principal ─────────────────────────────────────────────────────────

async function main() {
  const results = [];

  function assert(ok, name, detail = "") {
    const icon = ok ? "✅" : "❌";
    console.log(`${icon} ${name}${detail ? " — " + detail : ""}`);
    results.push({ ok, name });
  }

  // ── Servidor ─────────────────────────────────────────────────────────────
  log(`Iniciando servidor HTTP en puerto ${PORT}...`);
  let server;
  try {
    server = await startServer();
    log(`Servidor listo → http://localhost:${PORT}`);
  } catch (e) {
    console.error("No se pudo iniciar el servidor:", e.message);
    process.exit(1);
  }

  // Limpiar perfil viejo
  if (fs.existsSync(PROFILE_DIR)) {
    try { fs.rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch {}
  }

  // ── Abrir Edge con extensión ─────────────────────────────────────────────
  log("Lanzando Edge con extensión WebMatic...");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless      : false,
    executablePath: EDGE_PATH,
    args: [
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      "--disable-infobars",
    ],
    viewport: { width: 1280, height: 820 },
    slowMo  : 60,
  });

  // Esperar a que la extensión registre sus scripts (~2.5s)
  // (El background page carga durante el startup del browser, antes del CDP)
  await new Promise((r) => setTimeout(r, 2500));

  // Usar una página NUEVA (no la inicial) para asegurar que la extensión ya cargó
  const page = await ctx.newPage();

  // Capturar TODOS los mensajes de consola para diagnóstico
  const consoleErrors = [];
  const consoleLogs   = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") consoleErrors.push(text);
    if (text.includes("WebMatic") || text.includes("webmatic")) consoleLogs.push(`[${msg.type()}] ${text.slice(0, 120)}`);
  });

  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 15000 });
  } catch (e) {
    log("Error cargando página: " + e.message);
    await ctx.close(); server.close(); return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICACIÓN: content scripts inyectados
  // Detección: #webmatic-panel-root está en el DOM compartido → si existe,
  // los content scripts se inyectaron correctamente.
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Verificando inyección de content scripts ──");

  let panelExists = false;
  try {
    await page.waitForSelector("#webmatic-panel-root", { state: "attached", timeout: 15000 });
    panelExists = true;
  } catch {}
  assert(panelExists, "Panel #webmatic-panel-root creado en DOM por content script");
  await screenshot(page, "00-carga-inicial");

  if (!panelExists) {
    console.log("❌ No se inyectaron content scripts. Posibles errores:");
    consoleErrors.slice(0, 5).forEach((e) => console.log("  ", e));
    console.log("Logs WebMatic:", consoleLogs.length ? consoleLogs : "(ninguno)");
    // Extra diagnóstico: ¿hay algo en el DOM?
    const domCheck = await page.evaluate(() => ({
      hasPanel: !!document.getElementById("webmatic-panel-root"),
      hasStyle: !!document.getElementById("webmatic-style-link"),
      bodyLen:  document.body ? document.body.innerHTML.length : -1,
    }));
    console.log("DOM check:", domCheck);
    await ctx.close(); server.close(); return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1 — Abrir panel via background page
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 1: Abrir panel ──");
  const opened = await openPanelViaBackground(ctx, page);
  assert(opened, "Mensaje OPEN_PANEL enviado via background page");
  await page.waitForTimeout(700);

  const panelVisible = await page.evaluate(
    () => document.getElementById("webmatic-panel-root")?.style.display !== "none"
  );
  assert(panelVisible, "Panel visible (style.display ≠ none) tras OPEN_PANEL");
  await screenshot(page, "01-panel-abierto");

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Navegación de tabs (Record / Play / Settings)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 2: Tabs de modo ──");

  // Settings
  await page.click('#webmatic-panel-root button[data-mode="settings"]');
  await page.waitForTimeout(400);
  const settingsActive = await page.evaluate(
    () => document.querySelector('#webmatic-panel-root .webmatic-view[data-view="settings"]')?.classList.contains("active")
  );
  assert(settingsActive, "Vista Settings activa tras click en tab");
  await screenshot(page, "02-modo-settings");

  // Play
  await page.click('#webmatic-panel-root button[data-mode="play"]');
  await page.waitForTimeout(300);
  const playActive = await page.evaluate(
    () => document.querySelector('#webmatic-panel-root .webmatic-view[data-view="play"]')?.classList.contains("active")
  );
  assert(playActive, "Vista Play activa tras click en tab Play");

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3 — Configuración: tema oscuro
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 3: Configuración — Tema oscuro ──");
  await page.click('#webmatic-panel-root button[data-mode="settings"]');
  await page.waitForTimeout(300);

  const darkToggle = page.locator("#webmatic-dark-toggle");
  const wasDark    = await darkToggle.isChecked();
  await darkToggle.click();
  await page.waitForTimeout(500);

  const isDark = await page.evaluate(
    () => document.getElementById("webmatic-panel-root")?.classList.contains("webmatic-dark")
  );
  assert(isDark !== wasDark, `Toggle dark → ${isDark ? "oscuro" : "claro"} (antes: ${wasDark ? "oscuro" : "claro"})`);
  await screenshot(page, "03-tema-oscuro");

  // Restaurar estado original
  if (isDark) { await darkToggle.click(); await page.waitForTimeout(300); }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 4 — Configuración: velocidad
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 4: Configuración — Velocidad ──");
  const speedSlider = page.locator("[data-action-input='settings-speed']");
  await speedSlider.fill("2.5");
  await speedSlider.dispatchEvent("input");
  await page.waitForTimeout(400);

  const speedLabel = await page.locator("[data-speed-label]").textContent().catch(() => "");
  assert(speedLabel.includes("2.5"), `Velocidad actualizada → "${speedLabel}"`);
  await screenshot(page, "04-velocidad");

  // Restaurar 1.5
  await speedSlider.fill("1.5");
  await speedSlider.dispatchEvent("input");
  await page.waitForTimeout(200);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 5 — Configuración: lado del panel
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 5: Configuración — Lado del panel ──");
  await page.click('[data-action="settings-side-right"]');
  await page.waitForTimeout(400);

  const isRight = await page.evaluate(
    () => document.getElementById("webmatic-panel-root")?.classList.contains("webmatic-right")
  );
  assert(isRight, "Panel tiene clase webmatic-right");
  await screenshot(page, "05-panel-derecha");

  await page.click('[data-action="settings-side-left"]').catch(() => {});
  await page.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 6 — Grabación de formulario
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 6: Grabación de formulario ──");
  await page.click('#webmatic-panel-root button[data-mode="play"]');
  await page.waitForTimeout(300);

  // Clic en el botón "● Grabar"
  await page.click('[data-record-btn]');
  await page.waitForTimeout(500);

  // Al iniciar grabación: panel se oculta, floating btn aparece
  const floatingBtnAppeared = await page.waitForSelector(
    "#webmatic-floating-recorder-global",
    { timeout: 6000 }
  ).then(() => true).catch(() => false);
  assert(floatingBtnAppeared, "Botón flotante 'Grabando' aparece al iniciar grabación");
  await screenshot(page, "06-grabando");

  // Interactuar con la página de prueba (pasos que se grabarán)
  await page.click("#nombre");
  await page.fill("#nombre", "Ana Torres");
  await page.press("#nombre", "Tab");
  await page.fill("#apellido", "López");
  await page.fill("#email",    "ana@test.com");
  await page.fill("#edad",     "32");
  await page.selectOption("#pais", "AR");
  await page.waitForTimeout(200);
  await page.check("#chk-tecnologia");
  await page.click("#rad-casado");
  await page.waitForTimeout(400);
  await screenshot(page, "07-interaccion-grabada");

  // Verificar que la grabación sigue activa
  const stillRecording = await page.evaluate(
    () => !!document.getElementById("webmatic-floating-recorder-global")
  );
  assert(stillRecording, "Botón flotante sigue presente durante grabación");

  // Detener via floating btn
  await page.click("#webmatic-floating-recorder-global");
  await page.waitForTimeout(800);

  const floatingBtnGone = await page.evaluate(
    () => !document.getElementById("webmatic-floating-recorder-global")
  );
  assert(floatingBtnGone, "Botón flotante desaparece al detener grabación");
  await screenshot(page, "08-grabacion-detenida");

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 7 — Script editor y guardado de macro
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 7: Script editor y guardado ──");

  // Script editor debe haberse abierto tras detener grabación
  const scriptEditorOpen = await page.waitForSelector(
    '[data-script-editor][style*="flex"]',
    { timeout: 6000 }
  ).then(() => true).catch(() => false);
  assert(scriptEditorOpen, "Script editor se abre tras detener grabación");
  await screenshot(page, "09-script-editor");

  // Click en "Guardar macro…"
  await page.click('[data-action="script-editor-save"]');
  await page.waitForTimeout(600);

  const saveModalOpen = await page.waitForSelector(
    '[data-wm-dialog][style*="flex"]',
    { state: "attached", timeout: 5000 }
  ).then(() => true).catch(() => false);
  assert(saveModalOpen, "Modal de guardado visible");
  await screenshot(page, "10-save-modal");

  await page.fill('[data-wm-input]', 'E2E_Test_Formulario');
  await page.waitForTimeout(200);
  await page.click('[data-wm-ok]');
  await page.waitForTimeout(700);
  await screenshot(page, "11-macro-guardada");

  const macroInLibrary = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-macro-id]');
    return Array.from(items).some((el) => el.textContent.includes("E2E_Test_Formulario"));
  });
  assert(macroInLibrary, "Macro 'E2E_Test_Formulario' aparece en biblioteca");

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 8 — Reproducción de macro
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 8: Reproducción ──");

  // Limpiar formulario
  await page.evaluate(() => {
    ["nombre", "apellido", "email", "edad"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const chk = document.getElementById("chk-tecnologia");
    if (chk) chk.checked = false;
  });

  // Asegurarse de que el panel está visible y en vista Play
  await openPanelViaBackground(ctx, page);
  await page.waitForTimeout(500);
  await page.click('#webmatic-panel-root button[data-mode="play"]').catch(() => {});
  await page.waitForTimeout(300);

  // Seleccionar la macro guardada
  const macroItem = page.locator('[data-macro-id]').first();
  const macroItemExists = await macroItem.count() > 0;
  assert(macroItemExists, "Ítem de macro visible en lista de la biblioteca");

  if (macroItemExists) {
    await macroItem.click();
    await page.waitForTimeout(300);

    const playBtnEnabled = await page.evaluate(
      () => !!document.querySelector('[data-action="macro-play"]:not([disabled])')
    );
    assert(playBtnEnabled, "Botón 'Reproducir' habilitado al seleccionar macro");
    await screenshot(page, "12-macro-seleccionada");

    await page.click('[data-action="macro-play"]');
    await page.waitForTimeout(300);

    // El player flotante debe aparecer
    const playerFloating = await page.waitForSelector(
      "#webmatic-floating-player-global",
      { timeout: 6000 }
    ).then(() => true).catch(() => false);
    assert(playerFloating, "Panel flotante de reproducción aparece");
    await screenshot(page, "13-reproduciendo");

    // Esperar a que termine — el panel flotante muestra "Completado" (no desaparece solo)
    const playbackFinished = await page.waitForFunction(
      () => {
        const infoEl = document.querySelector("#webmatic-floating-player-global #wm-play-info");
        return infoEl && infoEl.textContent.includes("Completado");
      },
      { timeout: 25000 }
    ).then(() => true).catch(() => false);
    assert(playbackFinished, "Reproducción completada (panel flotante muestra 'Completado')");
    await screenshot(page, "14-reproduccion-terminada");

    // Verificar formulario rellenado
    const nombreVal   = await page.$eval("#nombre",   (el) => el.value).catch(() => "");
    const apellidoVal = await page.$eval("#apellido", (el) => el.value).catch(() => "");
    assert(nombreVal   === "Ana Torres", `Nombre reproducido: "${nombreVal}"`);
    assert(apellidoVal === "López",      `Apellido reproducido: "${apellidoVal}"`);
    await screenshot(page, "15-formulario-reproducido");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 9 — Bucle (repeat count)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 9: Opciones de bucle ──");

  await openPanelViaBackground(ctx, page);
  await page.waitForTimeout(500);

  const repeatInput = page.locator('[data-action-change="repeat-count"]');
  const repeatInputExists = await repeatInput.count() > 0;
  assert(repeatInputExists, "Input de repeat count existe en panel");

  if (repeatInputExists) {
    await repeatInput.fill("3");
    await repeatInput.dispatchEvent("change");
    await page.waitForTimeout(300);
    const val = await repeatInput.inputValue();
    assert(val === "3", `Repeat count actualizado → "${val}"`);
  }
  await screenshot(page, "16-bucle");

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 10 — Grabación de flujo con modal
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEST 10: Grabación con modal ──");

  // Abrir panel → modo play → iniciar grabación
  await openPanelViaBackground(ctx, page);
  await page.waitForTimeout(400);
  await page.click('#webmatic-panel-root button[data-mode="play"]').catch(() => {});
  await page.waitForTimeout(200);
  await page.click('[data-record-btn]');
  await page.waitForTimeout(500);

  const floatingForModal = await page.waitForSelector(
    "#webmatic-floating-recorder-global", { timeout: 5000 }
  ).then(() => true).catch(() => false);

  if (floatingForModal) {
    await page.click("#btn-abrir-modal");
    await page.waitForSelector("#modal-overlay.open", { timeout: 4000 }).catch(() => {});
    await page.fill("#modal-motivo", "Test E2E");
    await page.click("#btn-modal-confirmar");
    await page.waitForTimeout(500);

    await page.click("#webmatic-floating-recorder-global").catch(() => {});
    await page.waitForTimeout(700);

    const modalScriptEditor = await page.waitForSelector(
      '[data-script-editor][style*="flex"]', { timeout: 5000 }
    ).then(() => true).catch(() => false);
    assert(modalScriptEditor, "Script editor abierto tras grabar flujo de modal");
    await screenshot(page, "17-modal-grabado");

    // Cerrar sin guardar
    await page.click('[data-action="script-editor-close"]').catch(() => {});
    await page.waitForTimeout(400);
  } else {
    assert(false, "Botón flotante no apareció para test de modal");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  const passed = results.filter((r) =>  r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log("\n" + "═".repeat(62));
  console.log(`RESULTADO:  ${passed} ✅   ${failed} ❌   total: ${results.length}`);
  if (failed > 0) {
    console.log("\nTests fallidos:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name}`));
  } else {
    console.log("¡TODOS LOS TESTS PASARON! 🎉");
  }
  if (consoleErrors.length > 0) {
    console.log(`\nErrores de consola capturados (${consoleErrors.length}):`);
    consoleErrors.slice(0, 10).forEach((e) => console.log("  •", e.slice(0, 120)));
  }
  console.log(`\nScreenshots → ${SCREENSHOTS}`);
  console.log("═".repeat(62));

  await page.waitForTimeout(4000);
  await ctx.close();
  server.close();
}

main().catch((err) => {
  console.error("ERROR FATAL:", err.stack || err.message);
  process.exit(1);
});
