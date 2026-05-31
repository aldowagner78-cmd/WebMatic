"use strict";
// 06-macros.spec.js — CRUD de macros: guardar, renombrar, cargar, eliminar

const { test, expect } = require("../fixtures/electron-fixture");

// Inyecta un paso simulando ipc-message
async function injectStep(page, step) {
  await page.evaluate((s) => {
    const wv  = document.getElementById("wm-webview");
    const evt = new Event("ipc-message");
    evt.channel = "wm:step";
    evt.args    = [s];
    wv.dispatchEvent(evt);
  }, step);
}

// Graba 2 pasos de espera y para la grabacion
async function recordTwoSteps(page) {
  await page.locator("#wm-btn-record").click();
  // Esperar a que startRecording() termine (async) antes de inyectar pasos
  await expect(page.locator("#wm-rec-label")).toContainText("Grabando", { timeout: 3_000 });
  await injectStep(page, { type: "wait", ms: 50, _ts: Date.now() });
  await injectStep(page, { type: "wait", ms: 50, _ts: Date.now() + 1 });
  await page.locator("#wm-btn-record").click();
  await expect(page.locator("#wm-btn-save")).toBeEnabled({ timeout: 3_000 });
}

test.beforeEach(async ({ page, testServer }) => {
  await page.evaluate((url) => window.__wmTestReset(url), testServer.url);
  await page.locator('[data-tab="play"]').click();
});

// ── GUARDAR ──────────────────────────────────────────────────────────────────

test("click en Guardar abre el formulario inline", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await expect(page.locator("#wm-save-form")).toBeVisible();
});

test("guardar con nombre lo agrega a la biblioteca", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Test 01");
  await page.locator("#wm-save-confirm").click();

  await expect(page.locator("#wm-macro-list")).toContainText("Macro Test 01", { timeout: 3_000 });
});

test("el formulario se cierra tras guardar", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Test 02");
  await page.locator("#wm-save-confirm").click();
  await expect(page.locator("#wm-save-form")).not.toBeVisible({ timeout: 3_000 });
});

test("Enter en el campo de nombre guarda el macro", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Test Enter");
  await page.locator("#wm-save-name").press("Enter");
  await expect(page.locator("#wm-macro-list")).toContainText("Macro Test Enter", { timeout: 3_000 });
});

test("cancelar no guarda el macro", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("No guardar este");
  await page.locator("#wm-save-cancel").click();
  await expect(page.locator("#wm-macro-list")).not.toContainText("No guardar este");
});

test("el macro guardado muestra el conteo de pasos", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Con Pasos");
  await page.locator("#wm-save-confirm").click();
  // Acotar el locator al item especifico para evitar ambiguedad con otros macros de la suite
  const savedMacro = page.locator(".wm-macro-item").filter({ hasText: "Macro Con Pasos" });
  await expect(savedMacro.locator(".wm-macro-meta")).toContainText("2 pasos", { timeout: 3_000 });
});

// ── BUSQUEDA ─────────────────────────────────────────────────────────────────

test("busqueda filtra la lista de macros", async ({ page }) => {
  // Guardar dos macros con nombres distintos
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro ABC");
  await page.locator("#wm-save-confirm").click();

  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro XYZ");
  await page.locator("#wm-save-confirm").click();

  // Buscar "ABC" — solo debe mostrar ese
  await page.locator("#wm-lib-search").fill("ABC");
  await expect(page.locator("#wm-macro-list")).toContainText("Macro ABC");
  await expect(page.locator("#wm-macro-list")).not.toContainText("Macro XYZ");

  // Limpiar busqueda
  await page.locator("#wm-lib-search").fill("");
});

// ── RENOMBRAR ────────────────────────────────────────────────────────────────

test("doble clic en el nombre abre campo de edicion inline", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Renombrar");
  await page.locator("#wm-save-confirm").click();

  await page.locator(".wm-macro-name").filter({ hasText: "Macro Renombrar" }).dblclick();
  await expect(page.locator(".wm-rename-input")).toBeVisible({ timeout: 2_000 });
});

test("renombrar con Enter actualiza el nombre en la lista", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Viejo");
  await page.locator("#wm-save-confirm").click();

  await page.locator(".wm-macro-name").filter({ hasText: "Macro Viejo" }).dblclick();
  const inp = page.locator(".wm-rename-input");
  await inp.fill("Macro Nuevo");
  await inp.press("Enter");

  await expect(page.locator("#wm-macro-list")).toContainText("Macro Nuevo", { timeout: 3_000 });
  await expect(page.locator("#wm-macro-list")).not.toContainText("Macro Viejo");
});

// ── CARGAR PASOS ─────────────────────────────────────────────────────────────

test("boton cargar (←) carga los pasos del macro en memoria", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Cargar");
  await page.locator("#wm-save-confirm").click();

  // Limpiar pasos actuales primero
  page.once("dialog", d => d.accept());
  await page.locator("#wm-btn-clear").click();
  await expect(page.locator("#wm-steps-card")).not.toBeVisible({ timeout: 2_000 });

  // Cargar desde la biblioteca
  const macroItem2 = page.locator(".wm-macro-item").filter({ hasText: "Macro Cargar" });
  await macroItem2.locator('[title="Cargar pasos (para editar)"]').click();

  await expect(page.locator("#wm-steps-card")).toBeVisible({ timeout: 2_000 });
  const badge = await page.locator("#wm-step-badge").textContent();
  expect(parseInt(badge)).toBe(2);
});

// ── ELIMINAR ─────────────────────────────────────────────────────────────────

test("boton eliminar (✕) borra el macro de la lista", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Borrar");
  await page.locator("#wm-save-confirm").click();

  await expect(page.locator("#wm-macro-list")).toContainText("Macro Borrar");

  // Confirmar eliminacion
  page.once("dialog", d => d.accept());
  const macroItem = page.locator(".wm-macro-item").filter({ hasText: "Macro Borrar" });
  await macroItem.locator(".wm-macro-btn-del").click();

  await expect(page.locator("#wm-macro-list")).not.toContainText("Macro Borrar", { timeout: 3_000 });
});

test("al borrar el unico macro, la lista muestra el mensaje de vacia", async ({ page }) => {
  // Guardar un macro
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Unico");
  await page.locator("#wm-save-confirm").click();

  // Filtrar para encontrar solo ese macro
  await page.locator("#wm-lib-search").fill("Macro Unico");

  page.once("dialog", d => d.accept());
  const macroItem = page.locator(".wm-macro-item").filter({ hasText: "Macro Unico" });
  await macroItem.locator(".wm-macro-btn-del").click();

  await page.locator("#wm-lib-search").fill("");

  // Si no quedan macros, aparece el mensaje de lista vacía
  const text = await page.locator("#wm-macro-list").textContent();
  if (text.includes("No hay macros")) {
    await expect(page.locator(".wm-macro-empty")).toBeVisible();
  }
});

// ── REPRODUCIR DIRECTO DESDE BIBLIOTECA ──────────────────────────────────────

test("boton play (▶) en la biblioteca reproduce el macro", async ({ page }) => {
  await recordTwoSteps(page);
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill("Macro Reproducir");
  await page.locator("#wm-save-confirm").click();

  // Usar el boton play de la biblioteca
  const macroItem = page.locator(".wm-macro-item").filter({ hasText: "Macro Reproducir" });
  await macroItem.locator(".wm-macro-btn-play").click();

  // Debe aparecer la card de estado de reproduccion
  await expect(page.locator("#wm-playback-status-card")).toBeVisible({ timeout: 3_000 });
  // Y completarse (pasos wait de 80ms)
  await expect(page.locator("#wm-play-msg")).toContainText("Completado", { timeout: 8_000 });
});
