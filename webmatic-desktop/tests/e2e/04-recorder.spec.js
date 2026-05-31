"use strict";
// 04-recorder.spec.js — Grabacion de pasos, lista de pasos, descarte

const { test, expect } = require("../fixtures/electron-fixture");

// Helper: inyecta un paso simulando el evento ipc-message del webview
async function injectStep(page, step) {
  await page.evaluate((s) => {
    const wv  = document.getElementById("wm-webview");
    const evt = new Event("ipc-message");
    evt.channel = "wm:step";
    evt.args    = [s];
    wv.dispatchEvent(evt);
  }, step);
}

// Helper: inyecta N pasos wait
async function injectWaitSteps(page, count) {
  for (let i = 0; i < count; i++) {
    await injectStep(page, { type: "wait", ms: 50, _ts: Date.now() + i });
  }
}

// Helper: inicia grabacion y espera a que startRecording() (async) termine
async function startRecording(page) {
  await page.locator("#wm-btn-record").click();
  await expect(page.locator("#wm-rec-label")).toContainText("Grabando", { timeout: 3_000 });
}

test.beforeEach(async ({ page, testServer }) => {
  await page.evaluate((url) => window.__wmTestReset(url), testServer.url);
  // Siempre empezar en tab Macros
  await page.locator('[data-tab="play"]').click();
});

test("estado inicial: grabacion inactiva, dot apagado", async ({ page }) => {
  const dotActive = await page.locator("#wm-rec-dot").evaluate(
    el => el.classList.contains("active")
  );
  expect(dotActive).toBe(false);
  await expect(page.locator("#wm-rec-label")).toContainText("Listo");
});

test("click Grabar cambia etiqueta a 'Grabando'", async ({ page }) => {
  await page.locator("#wm-btn-record").click();
  await expect(page.locator("#wm-rec-label")).toContainText("Grabando");
  await page.locator("#wm-btn-record").click(); // parar
});

test("click Grabar activa el dot rojo pulsante", async ({ page }) => {
  await page.locator("#wm-btn-record").click();
  const dotActive = await page.locator("#wm-rec-dot").evaluate(
    el => el.classList.contains("active")
  );
  expect(dotActive).toBe(true);
  await page.locator("#wm-btn-record").click(); // parar
});

test("pasos inyectados durante grabacion aparecen en la lista", async ({ page }) => {
  await startRecording(page);
  await injectWaitSteps(page, 3);

  // El badge debe mostrar 3
  await expect(page.locator("#wm-step-badge")).toHaveText("3", { timeout: 5_000 });
  // La card de pasos es visible
  await expect(page.locator("#wm-steps-card")).toBeVisible();

  await page.locator("#wm-btn-record").click(); // parar
});

test("pasos NO se capturan cuando la grabacion esta parada", async ({ page }) => {
  // No empezar grabacion
  await injectStep(page, { type: "click", selector: "#btn", _ts: Date.now() });
  // La card de pasos debe estar oculta (no hay pasos registrados)
  await expect(page.locator("#wm-steps-card")).not.toBeVisible();
});

test("label muestra el conteo de pasos en tiempo real", async ({ page }) => {
  await startRecording(page);
  await injectStep(page, { type: "click", selector: "#a", _ts: Date.now() });
  await expect(page.locator("#wm-rec-label")).toContainText("1");
  await injectStep(page, { type: "click", selector: "#b", _ts: Date.now() + 1 });
  await expect(page.locator("#wm-rec-label")).toContainText("2");
  await page.locator("#wm-btn-record").click();
});

test("parar grabacion habilita Reproducir y Guardar", async ({ page }) => {
  await startRecording(page);
  await injectWaitSteps(page, 2);
  await page.locator("#wm-btn-record").click(); // parar

  await expect(page.locator("#wm-btn-play")).toBeEnabled({ timeout: 3_000 });
  await expect(page.locator("#wm-btn-save")).toBeEnabled({ timeout: 3_000 });
});

test("Descartar pasos limpia la lista y oculta la card", async ({ page }) => {
  await startRecording(page);
  await injectWaitSteps(page, 2);
  await page.locator("#wm-btn-record").click(); // parar

  // Confirmar el dialogo de descarte (Playwright maneja window.confirm automaticamente con OK)
  page.once("dialog", d => d.accept());
  await page.locator("#wm-btn-clear").click();

  await expect(page.locator("#wm-steps-card")).not.toBeVisible({ timeout: 3_000 });
  await expect(page.locator("#wm-btn-play")).toBeDisabled();
});

test("cada paso muestra numero de orden en la lista", async ({ page }) => {
  await startRecording(page);
  await injectWaitSteps(page, 3);
  await page.locator("#wm-btn-record").click();

  const nums = await page.locator(".wm-step-num").allTextContents();
  expect(nums).toEqual(["1", "2", "3"]);
});

test("boton X en un paso lo elimina de la lista", async ({ page }) => {
  await startRecording(page);
  await injectWaitSteps(page, 3);
  await page.locator("#wm-btn-record").click();

  // Eliminar el segundo paso
  await page.locator(".wm-step-del").nth(1).click();

  const badge = await page.locator("#wm-step-badge").textContent();
  expect(badge).toBe("2");
});

test("tipo de paso 'click' muestra selector en la etiqueta", async ({ page }) => {
  await startRecording(page);
  await injectStep(page, { type: "click", selector: "#mi-boton", _ts: Date.now() });
  await page.locator("#wm-btn-record").click();

  const label = await page.locator(".wm-step-lbl").first().textContent();
  expect(label).toContain("#mi-boton");
});

test("tipo de paso 'input' muestra selector y valor", async ({ page }) => {
  await startRecording(page);
  await injectStep(page, { type: "input", selector: "#campo", value: "hola", _ts: Date.now() });
  await page.locator("#wm-btn-record").click();

  const label = await page.locator(".wm-step-lbl").first().textContent();
  expect(label).toContain("#campo");
  expect(label).toContain("hola");
});
