"use strict";
// 08-step-editor.spec.js — editor inline de pasos y settings de reproduccion

const { test, expect } = require("../fixtures/electron-fixture");

// ── helpers ───────────────────────────────────────────────────────────────

async function injectStep(page, step) {
  await page.evaluate((s) => {
    const wv  = document.getElementById("wm-webview");
    const evt = new Event("ipc-message");
    evt.channel = "wm:step";
    evt.args    = [s];
    wv.dispatchEvent(evt);
  }, step);
}

async function recordSteps(page, steps) {
  await page.locator("#wm-btn-record").click();
  await expect(page.locator("#wm-rec-label")).toContainText("Grabando", { timeout: 3_000 });
  for (const step of steps) {
    await injectStep(page, step);
  }
  await page.locator("#wm-btn-record").click();
  await expect(page.locator("#wm-btn-save")).toBeEnabled({ timeout: 3_000 });
}

// ── setup ─────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page, testServer }) => {
  await page.evaluate((url) => window.__wmTestReset(url), testServer.url);
  await page.locator('[data-tab="play"]').click();
});

// ── Editor inline ─────────────────────────────────────────────────────────

test("el label de un paso es clickeable para editar", async ({ page }) => {
  await recordSteps(page, [{ type: "click", selector: "#original" }]);
  const lbl = page.locator(".wm-step-lbl").first();
  await expect(lbl).toBeVisible();
  await lbl.click();
  // Debe aparecer un input con el valor original
  await expect(page.locator(".wm-step-edit input").first()).toBeVisible();
  await expect(page.locator(".wm-step-edit input").first()).toHaveValue("#original");
});

test("editar selector de un paso click y confirmar con OK actualiza el label", async ({ page }) => {
  await recordSteps(page, [{ type: "click", selector: "#old" }]);
  await page.locator(".wm-step-lbl").first().click();
  await page.locator(".wm-step-edit input").first().fill("#new-selector");
  await page.locator(".wm-step-edit-ok").click();
  await expect(page.locator(".wm-step-lbl").first()).toContainText("#new-selector");
});

test("confirmar edicion con Enter actualiza el label", async ({ page }) => {
  await recordSteps(page, [{ type: "click", selector: "#btn" }]);
  await page.locator(".wm-step-lbl").first().click();
  await page.locator(".wm-step-edit input").first().fill("#entered");
  await page.locator(".wm-step-edit input").first().press("Enter");
  await expect(page.locator(".wm-step-lbl").first()).toContainText("#entered");
});

test("cancelar edicion con Escape no modifica el paso", async ({ page }) => {
  await recordSteps(page, [{ type: "click", selector: "#keep" }]);
  await page.locator(".wm-step-lbl").first().click();
  await page.locator(".wm-step-edit input").first().fill("#changed");
  await page.locator(".wm-step-edit input").first().press("Escape");
  await expect(page.locator(".wm-step-lbl").first()).toContainText("#keep");
});

test("cancelar edicion con boton Cancelar no modifica el paso", async ({ page }) => {
  await recordSteps(page, [{ type: "click", selector: "#original" }]);
  await page.locator(".wm-step-lbl").first().click();
  await page.locator(".wm-step-edit input").first().fill("#discarded");
  await page.locator(".wm-step-edit-cancel").click();
  await expect(page.locator(".wm-step-lbl").first()).toContainText("#original");
});

test("paso input tiene dos campos editables: selector y valor", async ({ page }) => {
  await recordSteps(page, [{ type: "input", selector: "#q", value: "hello" }]);
  await page.locator(".wm-step-lbl").first().click();
  const inputs = page.locator(".wm-step-edit input");
  await expect(inputs).toHaveCount(2);
  await expect(inputs.nth(0)).toHaveValue("#q");
  await expect(inputs.nth(1)).toHaveValue("hello");
});

test("editar paso wait modifica el valor ms", async ({ page }) => {
  await recordSteps(page, [{ type: "wait", ms: 100 }]);
  await page.locator(".wm-step-lbl").first().click();
  await page.locator(".wm-step-edit input").first().fill("999");
  await page.locator(".wm-step-edit-ok").click();
  await expect(page.locator(".wm-step-lbl").first()).toContainText("999ms");
});

// ── Reordenar pasos ───────────────────────────────────────────────────────

test("cada paso tiene botones subir y bajar", async ({ page }) => {
  await recordSteps(page, [
    { type: "click", selector: "#a" },
    { type: "click", selector: "#b" }
  ]);
  const items = page.locator(".wm-step-item");
  await expect(items).toHaveCount(2);
  await expect(items.first().locator('[title="Subir"]')).toBeVisible();
  await expect(items.first().locator('[title="Bajar"]')).toBeVisible();
});

test("boton Subir del primer paso esta deshabilitado", async ({ page }) => {
  await recordSteps(page, [
    { type: "click", selector: "#a" },
    { type: "click", selector: "#b" }
  ]);
  const upFirst = page.locator(".wm-step-item").first().locator('[title="Subir"]');
  await expect(upFirst).toBeDisabled();
});

test("boton Bajar del ultimo paso esta deshabilitado", async ({ page }) => {
  await recordSteps(page, [
    { type: "click", selector: "#a" },
    { type: "click", selector: "#b" }
  ]);
  const items = page.locator(".wm-step-item");
  const downLast = items.last().locator('[title="Bajar"]');
  await expect(downLast).toBeDisabled();
});

test("click en Bajar intercambia el paso con el siguiente", async ({ page }) => {
  await recordSteps(page, [
    { type: "click", selector: "#primero" },
    { type: "click", selector: "#segundo" }
  ]);
  // Bajar el primer paso
  await page.locator(".wm-step-item").first().locator('[title="Bajar"]').click();
  const items = page.locator(".wm-step-item");
  await expect(items.first().locator(".wm-step-lbl")).toContainText("#segundo");
  await expect(items.last().locator(".wm-step-lbl")).toContainText("#primero");
});

test("click en Subir intercambia el paso con el anterior", async ({ page }) => {
  await recordSteps(page, [
    { type: "click", selector: "#primero" },
    { type: "click", selector: "#segundo" }
  ]);
  // Subir el segundo paso
  await page.locator(".wm-step-item").last().locator('[title="Subir"]').click();
  const items = page.locator(".wm-step-item");
  await expect(items.first().locator(".wm-step-lbl")).toContainText("#segundo");
  await expect(items.last().locator(".wm-step-lbl")).toContainText("#primero");
});

test("los numeros de orden se actualizan al reordenar", async ({ page }) => {
  await recordSteps(page, [
    { type: "click", selector: "#a" },
    { type: "click", selector: "#b" },
    { type: "click", selector: "#c" }
  ]);
  // Subir el tercer paso (idx 2) -> pasa a ser idx 1
  await page.locator(".wm-step-item").nth(2).locator('[title="Subir"]').click();
  const nums = page.locator(".wm-step-num");
  await expect(nums.nth(0)).toHaveText("1");
  await expect(nums.nth(1)).toHaveText("2");
  await expect(nums.nth(2)).toHaveText("3");
});

// ── Settings de reproduccion ─────────────────────────────────────────────

test("tab Config tiene card de Reproduccion con inputs de delay y timeout", async ({ page }) => {
  await page.locator('[data-tab="settings"]').click();
  await expect(page.locator("#wm-cfg-step-delay")).toBeVisible();
  await expect(page.locator("#wm-cfg-step-timeout")).toBeVisible();
});

test("delay por defecto es 100 ms", async ({ page }) => {
  await page.locator('[data-tab="settings"]').click();
  await expect(page.locator("#wm-cfg-step-delay")).toHaveValue("100");
});

test("timeout por defecto es 8000 ms", async ({ page }) => {
  await page.locator('[data-tab="settings"]').click();
  await expect(page.locator("#wm-cfg-step-timeout")).toHaveValue("8000");
});

test("cambiar delay persiste en settings", async ({ page }) => {
  await page.locator('[data-tab="settings"]').click();
  const inp = page.locator("#wm-cfg-step-delay");
  await inp.fill("250");
  await inp.press("Tab"); // dispara change
  // Verificar que el valor sigue siendo 250 (no fue reseteado)
  await expect(inp).toHaveValue("250");
});

test("cambiar timeout persiste en settings", async ({ page }) => {
  await page.locator('[data-tab="settings"]').click();
  const inp = page.locator("#wm-cfg-step-timeout");
  await inp.fill("5000");
  await inp.press("Tab");
  await expect(inp).toHaveValue("5000");
});
