"use strict";
// 01-smoke.spec.js — Verifica que la app abre y la estructura de la UI es correcta

const { test, expect } = require("../fixtures/electron-fixture");

test("titlebar muestra 'WebMatic Desktop'", async ({ page }) => {
  await expect(page.locator(".wm-tb-title")).toHaveText("WebMatic Desktop");
});

test("version visible en el titlebar (vX.Y.Z)", async ({ page }) => {
  const ver = await page.locator("#wm-app-version").textContent();
  expect(ver).toMatch(/^v\d+\.\d+/);
});

test("sidebar tiene tabs Macros y Config", async ({ page }) => {
  await expect(page.locator('[data-tab="play"]')).toBeVisible();
  await expect(page.locator('[data-tab="settings"]')).toBeVisible();
});

test("tab Macros esta activo por defecto", async ({ page }) => {
  await expect(page.locator('[data-tab="play"]')).toHaveClass(/active/);
});

test("view Macros tiene botones de grabar, reproducir y detener", async ({ page }) => {
  await expect(page.locator("#wm-btn-record")).toBeVisible();
  await expect(page.locator("#wm-btn-play")).toBeVisible();
  await expect(page.locator("#wm-btn-stop")).toBeVisible();
});

test("Reproducir y Detener estan deshabilitados cuando no hay pasos", async ({ page }) => {
  await expect(page.locator("#wm-btn-play")).toBeDisabled();
  await expect(page.locator("#wm-btn-stop")).toBeDisabled();
});

test("controles de ventana (min/max/cerrar) son visibles", async ({ page }) => {
  await expect(page.locator("#wm-min")).toBeVisible();
  await expect(page.locator("#wm-max")).toBeVisible();
  await expect(page.locator("#wm-close")).toBeVisible();
});

test("URL bar y boton de navegacion estan presentes", async ({ page }) => {
  await expect(page.locator("#wm-url-input")).toBeVisible();
  await expect(page.locator("#wm-go")).toBeVisible();
});

test("sidebar 'pill' muestra 'Desktop'", async ({ page }) => {
  await expect(page.locator(".wm-side-pill")).toHaveText("Desktop");
});

test("biblioteca de macros muestra mensaje de vacia al inicio", async ({ page }) => {
  await expect(page.locator("#wm-macro-list")).toContainText("No hay macros guardados");
});
