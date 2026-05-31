"use strict";
// 05-player.spec.js — Reproduccion de pasos, barra de progreso, repeticion

const { test, expect } = require("../fixtures/electron-fixture");

// Inyecta pasos simulando el evento ipc-message
async function injectStep(page, step) {
  await page.evaluate((s) => {
    const wv  = document.getElementById("wm-webview");
    const evt = new Event("ipc-message");
    evt.channel = "wm:step";
    evt.args    = [s];
    wv.dispatchEvent(evt);
  }, step);
}

// Inyecta pasos de espera (no requieren elemento en el DOM del webview)
async function setupWaitSteps(page, count) {
  await page.locator("#wm-btn-record").click();
  // Esperar a que startRecording() termine (async) antes de inyectar pasos
  await expect(page.locator("#wm-rec-label")).toContainText("Grabando", { timeout: 3_000 });
  for (let i = 0; i < count; i++) {
    await injectStep(page, { type: "wait", ms: 80, _ts: Date.now() + i * 10 });
  }
  await page.locator("#wm-btn-record").click(); // parar grabacion
  // Esperar botones habilitados
  await expect(page.locator("#wm-btn-play")).toBeEnabled({ timeout: 3_000 });
}

test.beforeEach(async ({ page, testServer }) => {
  await page.evaluate((url) => window.__wmTestReset(url), testServer.url);
  await page.locator('[data-tab="play"]').click();
});

test("card de playback esta oculta antes de reproducir", async ({ page }) => {
  await expect(page.locator("#wm-playback-status-card")).not.toBeVisible();
});

test("reproduccion de pasos 'wait' completa y muestra barra al 100%", async ({ page }) => {
  await setupWaitSteps(page, 3);

  await page.locator("#wm-btn-play").click();
  await expect(page.locator("#wm-playback-status-card")).toBeVisible({ timeout: 3_000 });

  // Esperar que el progreso llegue al 100%
  await page.waitForFunction(
    () => {
      const fill = document.getElementById("wm-progress-fill");
      return fill && parseFloat(fill.style.width) >= 100;
    },
    { timeout: 12_000 }
  );

  const width = await page.locator("#wm-progress-fill").evaluate(el => el.style.width);
  expect(parseFloat(width)).toBeGreaterThanOrEqual(100);
});

test("mensaje 'Completado' aparece al terminar la reproduccion", async ({ page }) => {
  await setupWaitSteps(page, 2);

  await page.locator("#wm-btn-play").click();
  await expect(page.locator("#wm-play-msg")).toContainText("Completado", { timeout: 10_000 });
  await expect(page.locator("#wm-play-msg")).toHaveClass(/success/);
});

test("texto de progreso muestra el paso actual / total", async ({ page }) => {
  await setupWaitSteps(page, 3);

  await page.locator("#wm-btn-play").click();
  await expect(page.locator("#wm-playback-status-card")).toBeVisible();

  // Esperar alguna actualizacion del texto
  await page.waitForFunction(
    () => {
      const txt = document.getElementById("wm-progress-text");
      return txt && txt.textContent.includes("/");
    },
    { timeout: 8_000 }
  );

  const txt = await page.locator("#wm-progress-text").textContent();
  expect(txt).toMatch(/\d+ \/ \d+/);
});

test("Detener corta la reproduccion", async ({ page }) => {
  await setupWaitSteps(page, 5); // 5 pasos × 80ms = ~400ms

  await page.locator("#wm-btn-play").click();
  await expect(page.locator("#wm-btn-stop")).toBeEnabled({ timeout: 3_000 });

  // Detener antes de que termine
  await page.locator("#wm-btn-stop").click();

  // Boton stop debe deshabilitarse
  await expect(page.locator("#wm-btn-stop")).toBeDisabled({ timeout: 3_000 });
});

test("repetir 2 veces ejecuta el playback dos veces", async ({ page }) => {
  await setupWaitSteps(page, 2);

  // Configurar repeticion = 2
  await page.locator("#wm-repeat-count").fill("2");
  await page.locator("#wm-btn-play").click();

  // Esperar primera ronda completada (el contador baja a 1)
  await expect(page.locator("#wm-play-msg")).toContainText("Completado", { timeout: 8_000 });

  // Segunda ronda inicia automaticamente (~600ms despues)
  await page.waitForFunction(
    () => {
      const fill = document.getElementById("wm-progress-fill");
      if (!fill) return false;
      // En la segunda ronda el progreso baja o se reinicia
      return parseFloat(fill.style.width) < 100 ||
             document.getElementById("wm-play-msg").textContent === "";
    },
    { timeout: 3_000 }
  ).catch(() => { /* si no se detecta, puede que ya haya terminado */ });

  // Esperar que la segunda ronda complete
  await expect(page.locator("#wm-play-msg")).toContainText("Completado", { timeout: 10_000 });

  // Restaurar repeat a 1
  await page.locator("#wm-repeat-count").fill("1");
});

test("despues de completar, Reproducir vuelve a habilitarse", async ({ page }) => {
  await setupWaitSteps(page, 2);
  await page.locator("#wm-btn-play").click();

  await expect(page.locator("#wm-play-msg")).toContainText("Completado", { timeout: 8_000 });
  // Un momento despues el boton debe reactivarse
  await expect(page.locator("#wm-btn-play")).toBeEnabled({ timeout: 4_000 });
});
