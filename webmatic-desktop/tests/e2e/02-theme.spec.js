"use strict";
// 02-theme.spec.js — Sistema de temas: modo oscuro/claro y variantes de color

const { test, expect } = require("../fixtures/electron-fixture");

test.beforeEach(async ({ page }) => {
  // Asegurar que estamos en el tab Config
  await page.locator('[data-tab="settings"]').click();
  await expect(page.locator('[data-view="settings"]')).not.toHaveAttribute("hidden");
});

test("modo oscuro activo por defecto (data-wm-mode=dark)", async ({ page }) => {
  const mode = await page.evaluate(
    () => document.documentElement.getAttribute("data-wm-mode")
  );
  expect(mode).toBe("dark");
});

test("el toggle de modo oscuro refleja el estado actual", async ({ page }) => {
  const checked = await page.locator("#wm-dark-toggle").isChecked();
  expect(checked).toBe(true); // dark por defecto
});

test("se renderizan exactamente 4 swatches", async ({ page }) => {
  const count = await page.locator(".wm-swatch").count();
  expect(count).toBe(4);
});

test("swatch activo tiene clase 'active' (variante 1 por defecto)", async ({ page }) => {
  const activeCount = await page.locator(".wm-swatch.active").count();
  expect(activeCount).toBe(1);
});

test("toggle oscuro→claro cambia data-wm-mode a 'light'", async ({ page }) => {
  await page.locator("#wm-dark-toggle").click();
  const mode = await page.evaluate(
    () => document.documentElement.getAttribute("data-wm-mode")
  );
  expect(mode).toBe("light");
  // Revertir
  await page.locator("#wm-dark-toggle").click();
});

test("cambio de variante (swatch 2) modifica --wm-accent", async ({ page }) => {
  const before = await page.evaluate(
    () => document.documentElement.style.getPropertyValue("--wm-accent").trim()
  );
  await page.locator(".wm-swatch").nth(1).click();
  const after = await page.evaluate(
    () => document.documentElement.style.getPropertyValue("--wm-accent").trim()
  );
  expect(after).toBeTruthy();
  expect(after).not.toBe(before);
  // Revertir a variante 1
  await page.locator(".wm-swatch").nth(0).click();
});

test("en modo claro los swatches cambian al cambiar el modo", async ({ page }) => {
  // Capturar color swatch 1 en dark
  const colorDark = await page.locator(".wm-swatch").nth(0).evaluate(
    el => el.style.background
  );
  // Cambiar a light
  await page.locator("#wm-dark-toggle").click();
  const colorLight = await page.locator(".wm-swatch").nth(0).evaluate(
    el => el.style.background
  );
  expect(colorDark).not.toBe(colorLight);
  // Revertir
  await page.locator("#wm-dark-toggle").click();
});

test("cambio de modo actualiza el gradiente del titlebar", async ({ page }) => {
  const titlebarBefore = await page.evaluate(
    () => window.getComputedStyle(document.getElementById("wm-titlebar")).background
  );
  await page.locator("#wm-dark-toggle").click();
  const titlebarAfter = await page.evaluate(
    () => window.getComputedStyle(document.getElementById("wm-titlebar")).background
  );
  expect(titlebarAfter).not.toBe(titlebarBefore);
  // Revertir
  await page.locator("#wm-dark-toggle").click();
});

test("todas las variantes dark tienen --wm-surface no blanco", async ({ page }) => {
  for (let i = 0; i < 4; i++) {
    await page.locator(".wm-swatch").nth(i).click();
    const surface = await page.evaluate(
      () => document.documentElement.style.getPropertyValue("--wm-surface").trim()
    );
    // En modo oscuro el surface no debe ser blanco ni muy claro
    expect(surface).not.toBe("#ffffff");
    expect(surface).not.toBe("#fff");
  }
  // Revertir a variante 1
  await page.locator(".wm-swatch").nth(0).click();
});

test("todas las variantes light tienen --wm-surface claro", async ({ page }) => {
  await page.locator("#wm-dark-toggle").click(); // → light
  for (let i = 0; i < 4; i++) {
    await page.locator(".wm-swatch").nth(i).click();
    const surface = await page.evaluate(
      () => document.documentElement.style.getPropertyValue("--wm-surface").trim()
    );
    // En modo claro el surface empieza con #f (fondo claro)
    expect(surface.toLowerCase()).toMatch(/^#f/i);
  }
  // Revertir
  await page.locator("#wm-dark-toggle").click();
  await page.locator(".wm-swatch").nth(0).click();
});
