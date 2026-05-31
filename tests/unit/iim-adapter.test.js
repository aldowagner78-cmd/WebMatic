/**
 * Tests unitarios para iim-adapter.js — exportToIim / importFromIim
 * Cubre: tipos estándar, round-trip con WM_JSON, tipos extendidos, backward-compat.
 */
const test  = require("node:test");
const assert = require("node:assert/strict");

// iim-adapter usa globalThis/window — polyfill mínimo para Node
const G = global;
G.globalThis = G;

require("../../src/modules/storage/iim-adapter.js");
const adapter = G.WebMaticIimAdapter;

// ── Helpers ──────────────────────────────────────────────────────────────────
function roundTrip(steps) {
  const script = adapter.exportToIim({ steps });
  return adapter.importFromIim(script).steps;
}

// ── Tipos estándar ────────────────────────────────────────────────────────────

test("exportToIim: emite encabezado VERSION y TAB", () => {
  const script = adapter.exportToIim({ steps: [] });
  assert.ok(script.includes("VERSION BUILD=1000"));
  assert.ok(script.includes("TAB T=1"));
});

test("exportToIim: navigate genera NAVIGATE URL", () => {
  const script = adapter.exportToIim({ steps: [{ type: "navigate", url: "https://test.com" }] });
  assert.ok(script.includes('NAVIGATE URL="https://test.com"'));
});

test("exportToIim: click genera CLICK SELECTOR", () => {
  const script = adapter.exportToIim({ steps: [{ type: "click", selector: "#btn" }] });
  assert.ok(script.includes('CLICK SELECTOR="#btn"'));
});

test("exportToIim: input genera TYPE CONTENT", () => {
  const script = adapter.exportToIim({ steps: [{ type: "input", selector: "#n", value: "Juan" }] });
  assert.ok(script.includes('TYPE SELECTOR="#n" CONTENT="Juan"'));
});

test("exportToIim: check genera CHECK CHECKED", () => {
  const script = adapter.exportToIim({ steps: [{ type: "check", selector: "#ok", checked: true }] });
  assert.ok(script.includes('CHECK SELECTOR="#ok" CHECKED="true"'));
});

test("exportToIim: wait genera WAIT SECONDS", () => {
  const script = adapter.exportToIim({ steps: [{ type: "wait", seconds: 3 }] });
  assert.ok(script.includes("WAIT SECONDS=3"));
});

test("exportToIim: extract genera EXTRACT VAR", () => {
  const script = adapter.exportToIim({ steps: [{ type: "extract", selector: "#precio", variable: "PRECIO" }] });
  assert.ok(script.includes('EXTRACT SELECTOR="#precio" VAR="PRECIO"'));
});

test("exportToIim: key genera KEY CODE", () => {
  const script = adapter.exportToIim({ steps: [{ type: "key", key: "Enter" }] });
  assert.ok(script.includes('KEY CODE="Enter"'));
});

// ── WM_JSON — round-trip lossless ─────────────────────────────────────────────

test("exportToIim: embebe comentario WM_JSON cuando hay pasos", () => {
  const script = adapter.exportToIim({ steps: [{ type: "navigate", url: "x" }] });
  assert.ok(script.includes("// WM_JSON:"));
});

test("exportToIim: NO embebe WM_JSON si steps esta vacio", () => {
  const script = adapter.exportToIim({ steps: [] });
  assert.ok(!script.includes("WM_JSON"));
});

test("exportToIim: el JSON embebido es parseable y contiene los pasos", () => {
  const steps = [{ type: "navigate", url: "https://a.com" }, { type: "click", selector: "#x" }];
  const script = adapter.exportToIim({ steps });
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  assert.ok(line, "debe existir linea WM_JSON");
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.steps.length, 2);
});

test("importFromIim: usa WM_JSON como fuente autoritativa ignorando IIM", () => {
  // Script con WM_JSON que tiene 3 pasos pero IIM tiene solo 1 CLICK
  const fakeScript = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// WM_JSON:{"version":2,"steps":[{"type":"navigate","url":"x"},{"type":"click","selector":"#a"},{"type":"wait","seconds":2}]}',
    'CLICK SELECTOR="#a"'
  ].join("\n");
  const { steps } = adapter.importFromIim(fakeScript);
  assert.equal(steps.length, 3); // toma del JSON, no del IIM
  assert.equal(steps[0].type, "navigate");
  assert.equal(steps[2].type, "wait");
});

test("importFromIim: cae al parser IIM si WM_JSON esta malformado", () => {
  const badScript = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// WM_JSON:{invalid json!!!}',
    'CLICK SELECTOR="#fallback"'
  ].join("\n");
  const { steps } = adapter.importFromIim(badScript);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].selector, "#fallback");
});

test("importFromIim: parser legacy ignora lineas que comienzan con //", () => {
  const script = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// este es un comentario',
    'CLICK SELECTOR="#real"'
  ].join("\n");
  const { steps } = adapter.importFromIim(script);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].selector, "#real");
});

// ── Round-trip de tipos extendidos ────────────────────────────────────────────

test("round-trip: wait_for sobrevive export/import", () => {
  const steps = [{ type: "wait_for", selector: "#resultado", timeout: 5000 }];
  const rt = roundTrip(steps);
  assert.equal(rt.length, 1);
  assert.equal(rt[0].type, "wait_for");
  assert.equal(rt[0].selector, "#resultado");
  assert.equal(rt[0].timeout, 5000);
});

test("round-trip: set_variable sobrevive export/import", () => {
  const steps = [{ type: "set_variable", variable: "TOTAL", value: "{{!A}} + {{!B}}" }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "set_variable");
  assert.equal(rt[0].variable, "TOTAL");
  assert.equal(rt[0].value, "{{!A}} + {{!B}}");
});

test("round-trip: prompt sobrevive export/import", () => {
  const steps = [{ type: "prompt", label: "¿RUT?", variable: "RUT", default: "" }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "prompt");
  assert.equal(rt[0].label, "¿RUT?");
  assert.equal(rt[0].variable, "RUT");
});

test("round-trip: call_macro sobrevive export/import con sus pasos", () => {
  const steps = [{
    type: "call_macro",
    macro_name: "Login",
    steps: [{ type: "click", selector: "#btn" }]
  }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "call_macro");
  assert.equal(rt[0].macro_name, "Login");
  assert.equal(rt[0].steps.length, 1);
});

test("round-trip: for_each_row sobrevive export/import con dataset completo", () => {
  const steps = [{
    type: "for_each_row",
    columns: ["NOMBRE", "RUT"],
    dataset: [["Ana", "12.345.678-9"], ["Luis", "98.765.432-1"]],
    steps: [{ type: "input", selector: "#n", value: "{{!NOMBRE}}" }]
  }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "for_each_row");
  assert.equal(rt[0].dataset.length, 2);
  assert.deepEqual(rt[0].columns, ["NOMBRE", "RUT"]);
  assert.equal(rt[0].steps[0].value, "{{!NOMBRE}}");
});

test("round-trip: if_exists con ramas then/else sobrevive export/import", () => {
  const steps = [{
    type: "if_exists",
    selector: "#modal",
    then: [{ type: "click", selector: "#cerrar" }],
    else:  [{ type: "navigate", url: "https://x.com" }]
  }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "if_exists");
  assert.equal(rt[0].then.length, 1);
  assert.equal(rt[0].else.length, 1);
  assert.equal(rt[0].then[0].selector, "#cerrar");
});

test("round-trip: macro mixta (estandar + extendida) conserva todos los pasos", () => {
  const steps = [
    { type: "navigate", url: "https://app.com" },
    { type: "wait_for", selector: "#content" },
    { type: "set_variable", variable: "INICIO", value: "ok" },
    { type: "click", selector: "#submit" },
    { type: "prompt", label: "Código:", variable: "COD" },
    { type: "for_each_row", columns: ["X"], dataset: [["1"]], steps: [] }
  ];
  const rt = roundTrip(steps);
  assert.equal(rt.length, 6);
  assert.equal(rt[0].type, "navigate");
  assert.equal(rt[1].type, "wait_for");
  assert.equal(rt[4].type, "prompt");
  assert.equal(rt[5].type, "for_each_row");
});

test("round-trip: el campo _ts interno NO aparece en el JSON exportado", () => {
  const steps = [{ type: "click", selector: "#x", _ts: 1234567890 }];
  const script = adapter.exportToIim({ steps });
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  assert.ok(!("_ts" in parsed.steps[0]), "_ts no debe aparecer en el JSON");
});

// ── Backward compat: IIM sin WM_JSON ─────────────────────────────────────────

test("importFromIim: script legacy sin WM_JSON parsea correctamente", () => {
  const legacy = [
    "VERSION BUILD=1000",
    "TAB T=1",
    'NAVIGATE URL="https://old.com"',
    'CLICK SELECTOR="#id"',
    'TYPE SELECTOR="#name" CONTENT="Hola"',
    "WAIT SECONDS=2",
    'EXTRACT SELECTOR="#result" VAR="RES"'
  ].join("\n");
  const { steps } = adapter.importFromIim(legacy);
  assert.equal(steps.length, 5);
  assert.equal(steps[0].url, "https://old.com");
  assert.equal(steps[2].value, "Hola");
  assert.equal(steps[4].variable, "RES");
});
