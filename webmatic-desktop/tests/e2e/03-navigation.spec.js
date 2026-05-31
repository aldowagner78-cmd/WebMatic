"use strict";
// 03-navigation.spec.js — Barra de URL, navegacion con el webview

const { test, expect } = require("../fixtures/electron-fixture");

test("barra de URL acepta texto tecleado", async ({ page }) => {
  await page.locator("#wm-url-input").fill("https://example.com");
  await expect(page.locator("#wm-url-input")).toHaveValue("https://example.com");
});

test("URL normalizada: dominio sin https → agrega https", async ({ page, electronApp }) => {
  await page.locator("#wm-url-input").fill("example.com");
  await page.locator("#wm-go").click();

  // Verificar que el webview navego a https://example.com
  await page.waitForFunction(
    () => {
      const input = document.getElementById("wm-url-input");
      return input.value.startsWith("https://");
    },
    { timeout: 10_000 }
  );

  const url = await page.locator("#wm-url-input").inputValue();
  expect(url).toContain("example.com");
});

test("URL del webview se actualiza en la barra al navegar (test-page local)", async ({ page, testServer }) => {
  await page.locator("#wm-url-input").fill(testServer.url);
  await page.locator("#wm-url-input").press("Enter");

  await page.waitForFunction(
    (expectedUrl) => document.getElementById("wm-url-input").value.startsWith(expectedUrl),
    testServer.url,
    { timeout: 10_000 }
  );

  const url = await page.locator("#wm-url-input").inputValue();
  expect(url).toContain("127.0.0.1");
});

test("boton Ir navega igual que presionar Enter", async ({ page, testServer }) => {
  await page.locator("#wm-url-input").fill(testServer.url);
  await page.locator("#wm-go").click();

  await page.waitForFunction(
    (u) => document.getElementById("wm-url-input").value.startsWith(u),
    testServer.url,
    { timeout: 10_000 }
  );

  const url = await page.locator("#wm-url-input").inputValue();
  expect(url).toContain("127.0.0.1");
});

test("busqueda de texto usa Google (query sin dominio)", async ({ page }) => {
  await page.locator("#wm-url-input").fill("esto es una busqueda de prueba");
  await page.locator("#wm-go").click();

  await page.waitForFunction(
    () => {
      const v = document.getElementById("wm-url-input").value;
      return v.includes("google.com");
    },
    { timeout: 12_000 }
  );

  const url = await page.locator("#wm-url-input").inputValue();
  expect(url).toContain("google.com/search");
});

test("boton Atras esta en el DOM y es clickeable", async ({ page }) => {
  const btn = page.locator("#wm-back");
  await expect(btn).toBeVisible();
  // No deberia lanzar error al hacer click (aunque no haya historial)
  await btn.click();
});

test("boton Adelante esta en el DOM y es clickeable", async ({ page }) => {
  await expect(page.locator("#wm-fwd")).toBeVisible();
  await page.locator("#wm-fwd").click();
});

test("boton Recargar esta en el DOM y es clickeable", async ({ page }) => {
  await expect(page.locator("#wm-reload")).toBeVisible();
  await page.locator("#wm-reload").click();
});
