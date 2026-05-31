"use strict";
// 07-iim.spec.js — Export/Import de macros como archivos .iim

const { test: base, expect } = require("@playwright/test");
const { test } = require("../fixtures/electron-fixture");
const iimAdapter = require("../../src/storage/iimAdapter");
const path = require("path");
const fs   = require("fs");
const os   = require("os");

// ── 1. Unit tests del adaptador iimAdapter (sin Electron) ─────────────────

base.describe("iimAdapter", () => {
  base.test("serializa y deserializa pasos básicos en roundtrip", () => {
    const steps = [
      { type: "navigate",  url: "https://example.com" },
      { type: "click",     selector: "#btn" },
      { type: "input",     selector: "[name=q]", value: "hello world" },
      { type: "wait",      ms: 500 },
      { type: "key",       key: "Enter" }
    ];
    const { name, steps: out } = iimAdapter.deserialize(
      iimAdapter.serialize("Test Macro", steps), "fallback"
    );
    expect(name).toBe("Test Macro");
    expect(out).toHaveLength(5);
    expect(out[0]).toMatchObject({ type: "navigate", url: "https://example.com" });
    expect(out[1]).toMatchObject({ type: "click",    selector: "#btn" });
    expect(out[2]).toMatchObject({ type: "input",    selector: "[name=q]", value: "hello world" });
    expect(out[3]).toMatchObject({ type: "wait",     ms: 500 });
    expect(out[4]).toMatchObject({ type: "key",      key: "Enter" });
  });

  base.test("soporta nombre con espacios y caracteres especiales", () => {
    const { name } = iimAdapter.deserialize(
      iimAdapter.serialize("Mi Macro #1 (prueba)", [])
    );
    expect(name).toBe("Mi Macro #1 (prueba)");
  });

  base.test("soporta selector complejo con espacios y comillas", () => {
    const steps = [{ type: "click", selector: 'div[data-id="item 1"]' }];
    const { steps: out } = iimAdapter.deserialize(iimAdapter.serialize("x", steps));
    expect(out[0].selector).toBe('div[data-id="item 1"]');
  });

  base.test("soporta todos los tipos de paso", () => {
    const steps = [
      { type: "navigate",  url: "https://x.com" },
      { type: "click",     selector: "#a" },
      { type: "dblclick",  selector: "#b" },
      { type: "input",     selector: "#c", value: "val" },
      { type: "text",      selector: "#d", value: "msg" },
      { type: "check",     selector: "#e", checked: true },
      { type: "key",       key: "Tab" },
      { type: "wait",      ms: 300 },
      { type: "extract",   selector: "#f", variable: "myVar" }
    ];
    const { steps: out } = iimAdapter.deserialize(iimAdapter.serialize("t", steps));
    expect(out).toHaveLength(9);
    expect(out[5]).toMatchObject({ type: "check",   checked: true });
    expect(out[7]).toMatchObject({ type: "wait",    ms: 300 });
    expect(out[8]).toMatchObject({ type: "extract", variable: "myVar" });
  });

  base.test("wait con campo seconds se convierte a ms correctamente", () => {
    const steps = [{ type: "wait", seconds: 2 }];
    const { steps: out } = iimAdapter.deserialize(iimAdapter.serialize("t", steps));
    expect(out[0]).toMatchObject({ type: "wait", ms: 2000 });
  });

  base.test("ignora lineas desconocidas y comentarios", () => {
    const content = [
      "VERSION BUILD=1.0 RECORDER=WEBMATIC",
      "MACRO NAME=X",
      "",
      "# esto es un comentario",
      "UNKNOWNCMD foo=bar",
      "CLICK SELECTOR=%23ok"
    ].join("\n");
    const { steps } = iimAdapter.deserialize(content);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ type: "click", selector: "#ok" });
  });

  base.test("deserialize con CRLF funciona igual que LF", () => {
    const content = "VERSION BUILD=1.0 RECORDER=WEBMATIC\r\nMACRO NAME=CRLF\r\nCLICK SELECTOR=%23x\r\n";
    const { name, steps } = iimAdapter.deserialize(content);
    expect(name).toBe("CRLF");
    expect(steps).toHaveLength(1);
  });

  base.test("serialize genera cabecera correcta", () => {
    const text = iimAdapter.serialize("Mi Macro", []);
    expect(text).toContain("VERSION BUILD=1.0 RECORDER=WEBMATIC");
    expect(text).toContain("MACRO NAME=Mi%20Macro");
  });
});

// ── 2. E2E tests con Electron ─────────────────────────────────────────────

async function injectStep(page, step) {
  await page.evaluate((s) => {
    const wv  = document.getElementById("wm-webview");
    const evt = new Event("ipc-message");
    evt.channel = "wm:step";
    evt.args    = [s];
    wv.dispatchEvent(evt);
  }, step);
}

async function recordAndSave(page, macroName) {
  await page.locator("#wm-btn-record").click();
  await expect(page.locator("#wm-rec-label")).toContainText("Grabando", { timeout: 3_000 });
  await injectStep(page, { type: "wait", ms: 50, _ts: Date.now() });
  await page.locator("#wm-btn-record").click();
  await expect(page.locator("#wm-btn-save")).toBeEnabled({ timeout: 3_000 });
  await page.locator("#wm-btn-save").click();
  await page.locator("#wm-save-name").fill(macroName);
  await page.locator("#wm-save-confirm").click();
  await expect(page.locator("#wm-macro-list")).toContainText(macroName, { timeout: 3_000 });
}

test.describe("export/import .iim (E2E)", () => {
  test.beforeEach(async ({ page, testServer }) => {
    await page.evaluate((url) => window.__wmTestReset(url), testServer.url);
    await page.locator('[data-tab="play"]').click();
  });

  test("boton Importar .iim existe en la biblioteca", async ({ page }) => {
    await expect(page.locator("#wm-btn-import-iim")).toBeVisible();
  });

  test("cada macro tiene boton de exportar (.iim)", async ({ page }) => {
    await recordAndSave(page, "Export Btn Test");
    const exportBtn = page.locator(".wm-macro-item")
      .filter({ hasText: "Export Btn Test" })
      .locator('[title="Exportar como .iim"]');
    await expect(exportBtn).toBeVisible();
  });

  test("exportar macro escribe archivo .iim con contenido valido", async ({ page, electronApp }) => {
    await recordAndSave(page, "Mi Macro Export");
    const tmpFile = path.join(os.tmpdir(), `wm-export-${Date.now()}.iim`);

    // Mock dialog.showSaveDialog en el proceso principal
    await electronApp.evaluate(async ({ dialog }, fp) => {
      dialog._wmSaveOrig = dialog.showSaveDialog;
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: fp });
    }, tmpFile);

    try {
      const exportBtn = page.locator(".wm-macro-item")
        .filter({ hasText: "Mi Macro Export" })
        .locator('[title="Exportar como .iim"]');
      await exportBtn.click();

      // Esperar a que el archivo sea creado (hasta 5 s)
      await expect.poll(() => fs.existsSync(tmpFile), { timeout: 5_000 }).toBe(true);

      const content = fs.readFileSync(tmpFile, "utf8");
      expect(content).toContain("VERSION BUILD=1.0 RECORDER=WEBMATIC");
      expect(content).toContain("Mi%20Macro%20Export");
      expect(content).toContain("WAIT MS=");
    } finally {
      await electronApp.evaluate(({ dialog }) => {
        if (dialog._wmSaveOrig) { dialog.showSaveDialog = dialog._wmSaveOrig; delete dialog._wmSaveOrig; }
      });
      fs.rmSync(tmpFile, { force: true });
    }
  });

  test("importar .iim añade macro a la biblioteca con pasos correctos", async ({ page, electronApp }) => {
    const tmpFile = path.join(os.tmpdir(), `wm-import-${Date.now()}.iim`);
    fs.writeFileSync(tmpFile, iimAdapter.serialize("Macro Importado", [
      { type: "navigate", url: "https://example.com" },
      { type: "click",    selector: "#go" }
    ]), "utf8");

    // Mock dialog.showOpenDialog en el proceso principal
    await electronApp.evaluate(async ({ dialog }, fp) => {
      dialog._wmOpenOrig = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fp] });
    }, tmpFile);

    try {
      await page.locator("#wm-btn-import-iim").click();

      await expect(page.locator("#wm-macro-list"))
        .toContainText("Macro Importado", { timeout: 3_000 });

      await expect(
        page.locator(".wm-macro-item")
          .filter({ hasText: "Macro Importado" })
          .locator(".wm-macro-meta")
      ).toContainText("2 pasos");
    } finally {
      await electronApp.evaluate(({ dialog }) => {
        if (dialog._wmOpenOrig) { dialog.showOpenDialog = dialog._wmOpenOrig; delete dialog._wmOpenOrig; }
      });
      fs.rmSync(tmpFile, { force: true });
    }
  });

  test("cancelar el dialogo de importar no modifica la biblioteca", async ({ page, electronApp }) => {
    // Guardar un macro antes y anotar el count resultante
    await recordAndSave(page, "Pre-Import Macro");
    const countBefore = await page.locator(".wm-macro-item").count();

    await electronApp.evaluate(async ({ dialog }) => {
      dialog._wmOpenOrig = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    });

    try {
      await page.locator("#wm-btn-import-iim").click();
      // Esperar un tick y verificar que la biblioteca no cambió
      await page.waitForTimeout(300);
      await expect(page.locator(".wm-macro-item")).toHaveCount(countBefore);
    } finally {
      await electronApp.evaluate(({ dialog }) => {
        if (dialog._wmOpenOrig) { dialog.showOpenDialog = dialog._wmOpenOrig; delete dialog._wmOpenOrig; }
      });
    }
  });
});
