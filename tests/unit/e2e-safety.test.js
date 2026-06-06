/**
 * Tests unitarios de seguridad E2E read-only para IAPOS/GeneXus.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Window } = require("happy-dom");

const {
  assertSafeTarget,
  safeClick,
  safeFill,
  safeSelectOption
} = require("../../tests/e2e/iapos-safe/safety-actions.js");
const { sanitizeForLog } = require("../../tests/e2e/iapos-safe/sanitize-log.js");

const FIXTURE_FILE = path.resolve(__dirname, "../fixtures/iapos-safe-page.html");

function loadFixtureDom() {
  const html = fs.readFileSync(FIXTURE_FILE, "utf8");
  const win = new Window({ url: "http://localhost/" });
  win.document.write(html);
  win.document.close();
  return win;
}

function makeLocator(el) {
  return {
    async evaluate(fn) { return fn(el); },
    async click() { el.setAttribute("data-clicked", "1"); },
    async fill(v) { el.value = String(v); },
    async selectOption(v) { el.value = String(v); }
  };
}

test("assertSafeTarget: permite botón Buscar/Consultar/Filtrar", () => {
  const okBuscar = assertSafeTarget({ text: "Buscar", inGridRow: false }, { action: "click" });
  const okConsultar = assertSafeTarget({ text: "Consultar", inGridRow: false }, { action: "click" });
  const okFiltrar = assertSafeTarget({ text: "Filtrar", inGridRow: false }, { action: "click" });
  assert.equal(okBuscar.ok, true);
  assert.equal(okConsultar.ok, true);
  assert.equal(okFiltrar.ok, true);
});

test("assertSafeTarget: bloquea Autorizar/Eliminar/Anular/Guardar/Confirmar", () => {
  const blocked = ["Autorizar", "Eliminar", "Anular", "Guardar", "Confirmar", "Approve", "Delete"];
  for (const label of blocked) {
    assert.throws(
      () => assertSafeTarget({ text: label, inGridRow: false }, { action: "click" }),
      /SAFE_ABORT/i,
      `debería bloquear: ${label}`
    );
  }
});

test("assertSafeTarget: bloquea click en filas de grilla", () => {
  assert.throws(
    () => assertSafeTarget({ text: "Ver detalle", inGridRow: true }, { action: "click" }),
    /grilla/i
  );
});

test("safeClick: permite Buscar y bloquea Autorizar usando fixture real", async () => {
  const win = loadFixtureDom();

  const btnBuscar = win.document.getElementById("btn-buscar");
  const btnAutorizar = win.document.getElementById("btn-autorizar");

  await safeClick(makeLocator(btnBuscar), { stage: "readonly-search" });
  assert.equal(btnBuscar.getAttribute("data-clicked"), "1", "buscar debería ejecutarse");

  await assert.rejects(
    () => safeClick(makeLocator(btnAutorizar), { stage: "readonly-search" }),
    /SAFE_ABORT/i,
    "autorizar debe bloquearse"
  );
});

test("safeClick: bloquea input type=image peligroso en fixture", async () => {
  const win = loadFixtureDom();
  const imgDanger = win.document.getElementById("img-peligroso");
  await assert.rejects(
    () => safeClick(makeLocator(imgDanger), { stage: "readonly-search" }),
    /SAFE_ABORT/i
  );
});

test("safeSelectOption: permite select seguro", async () => {
  const win = loadFixtureDom();
  const sel = win.document.getElementById("filtro-modalidad");
  await safeSelectOption(makeLocator(sel), "2", { stage: "readonly-filter" });
  assert.equal(sel.value, "2");
});

test("safeFill: permite input de filtro seguro", async () => {
  const win = loadFixtureDom();
  const inp = win.document.getElementById("filtro-texto");
  await safeFill(makeLocator(inp), "ABC123", { stage: "readonly-filter" });
  assert.equal(inp.value, "ABC123");
});

test("sanitizeForLog: no expone usuario ni contraseña", () => {
  const raw = "login IAPOS_USER=miusuario IAPOS_PASS=miclave password=supersecreta";
  const out = sanitizeForLog(raw, ["miusuario", "miclave", "supersecreta"]);
  assert.ok(!out.includes("miusuario"));
  assert.ok(!out.includes("miclave"));
  assert.ok(!out.includes("supersecreta"));
  assert.ok(out.includes("[REDACTED]"));
});
