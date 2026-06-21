const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../../../..");

const compactor = require("../../../../src/modules/macros/macro-step-compactor.js");
require("../../../../src/modules/storage/iim-adapter.js");
const adapter = global.WebMaticIimAdapter;

function textInput(selector, value, extra = {}) {
  return {
    type: "input",
    selector,
    value,
    controlRef: { selector, tag: "input", type: "text", controlKind: "text-input" },
    ...extra
  };
}

function compact(steps) {
  return compactor.compactRedundantTextWrites(steps);
}

function wmJsonSteps(script) {
  const line = script.split("\n").find((item) => item.startsWith("// WM_JSON:"));
  assert.ok(line, "debe existir WM_JSON");
  return JSON.parse(line.slice("// WM_JSON:".length)).steps;
}

function repoJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8").replace(/^\uFEFF/, ""));
}

test("compacta tres escrituras sucesivas sobre el mismo selector y deja solo la ultima", () => {
  assert.deepEqual(
    compact([
      textInput("#ce-observaciones", "|"),
      textInput("#ce-observaciones", "O"),
      textInput("#ce-observaciones", "Observaciones 12 final")
    ]),
    [textInput("#ce-observaciones", "Observaciones 12 final")]
  );
});

test("compacta con auto-waits cortos y elimina waits intermedios redundantes", () => {
  const out = compact([
    textInput("#ce-observaciones", "|"),
    { type: "wait", seconds: 1, _autoWait: true },
    textInput("#ce-observaciones", "O"),
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "wait", seconds: 1, _autoWait: true },
    textInput("#ce-observaciones", "Observaciones 12 final")
  ]);

  assert.deepEqual(out, [textInput("#ce-observaciones", "Observaciones 12 final")]);
});

test("compacta con vacio intermedio si el ultimo valor no es vacio", () => {
  const out = compact([
    textInput("#ce-observaciones", "l"),
    { type: "wait", seconds: 1, _autoWait: true },
    textInput("#ce-observaciones", "0"),
    { type: "wait", seconds: 1, _autoWait: true },
    textInput("#ce-observaciones", ""),
    { type: "wait", seconds: 1, _autoWait: true },
    textInput("#ce-observaciones", "OBSERVACIONES 12 FINAL")
  ]);

  assert.deepEqual(out, [textInput("#ce-observaciones", "OBSERVACIONES 12 FINAL")]);
});

test("compacta con auto-waits intermedios de hasta 5 segundos", () => {
  const out = compact([
    textInput("#ce-observaciones", "l"),
    { type: "wait", seconds: 5, _autoWait: true },
    textInput("#ce-observaciones", ""),
    { type: "wait", seconds: 4, _autoWait: true },
    textInput("#ce-observaciones", "OBSERVACIONES 12 FINAL")
  ]);

  assert.deepEqual(out, [textInput("#ce-observaciones", "OBSERVACIONES 12 FINAL")]);
});

test("no compacta si hay key o Enter entre escrituras", () => {
  const withKey = [
    textInput("#busqueda", "test"),
    { type: "key", key: "Tab" },
    textInput("#busqueda", "test final")
  ];
  const withEnter = [
    textInput("#busqueda", "test"),
    { type: "key", key: "Enter", selector: "#busqueda" },
    textInput("#busqueda", "test final")
  ];

  assert.deepEqual(compact(withKey), withKey);
  assert.deepEqual(compact(withEnter), withEnter);
});

test("no compacta si hay acciones semanticas entre medio", () => {
  const blockers = [
    { type: "click", selector: "#x" },
    { type: "hover", selector: "#x" },
    { type: "choose_option", selector: "#pais", value: "ar" },
    { type: "check", selector: "#ok", checked: true },
    { type: "navigate", url: "https://example.test" },
    { type: "wait_for", selector: "#ready" },
    { type: "submit", selector: "#form" }
  ];

  for (const blocker of blockers) {
    const steps = [textInput("#campo", "uno"), blocker, textInput("#campo", "dos")];
    assert.deepEqual(compact(steps), steps, `no debe compactar con ${blocker.type}`);
  }
});

test("no compacta si cambia selector, bloque o wait no seguro", () => {
  const changeSelector = [textInput("#a", "uno"), textInput("#b", "dos")];
  const changeBlock = [
    textInput("#a", "uno", { _wmBlockKey: "a.local/" }),
    textInput("#a", "dos", { _wmBlockKey: "b.local/" })
  ];
  const longWait = [
    textInput("#a", "uno"),
    { type: "wait", seconds: 6, _autoWait: true },
    textInput("#a", "dos")
  ];
  const manualWait = [
    textInput("#a", "uno"),
    { type: "wait", seconds: 1 },
    textInput("#a", "dos")
  ];

  assert.deepEqual(compact(changeSelector), changeSelector);
  assert.deepEqual(compact(changeBlock), changeBlock);
  assert.deepEqual(compact(longWait), longWait);
  assert.deepEqual(compact(manualWait), manualWait);
});

test("no compacta password, sensitive, fechas, select, checkbox ni radio", () => {
  const cases = [
    [
      { type: "input", selector: "#password", value: "a", controlRef: { selector: "#password", tag: "input", type: "password", controlKind: "text-input" } },
      { type: "input", selector: "#password", value: "b", controlRef: { selector: "#password", tag: "input", type: "password", controlKind: "text-input" } }
    ],
    [textInput("#api_token", "a"), textInput("#api_token", "b")],
    [textInput("#fecha", "2026-06-01", { inputType: "date" }), textInput("#fecha", "2026-06-02", { inputType: "date" })],
    [
      { type: "input", selector: "#pais", value: "ar", controlRef: { selector: "#pais", tag: "select", controlKind: "native-select" } },
      { type: "input", selector: "#pais", value: "uy", controlRef: { selector: "#pais", tag: "select", controlKind: "native-select" } }
    ],
    [
      { type: "input", selector: "#ok", value: "true", controlRef: { selector: "#ok", tag: "input", type: "checkbox", controlKind: "checkbox" } },
      { type: "input", selector: "#ok", value: "false", controlRef: { selector: "#ok", tag: "input", type: "checkbox", controlKind: "checkbox" } }
    ],
    [
      { type: "input", selector: "#r", value: "a", controlRef: { selector: "#r", tag: "input", type: "radio", controlKind: "radio" } },
      { type: "input", selector: "#r", value: "b", controlRef: { selector: "#r", tag: "input", type: "radio", controlKind: "radio" } }
    ]
  ];

  for (const steps of cases) {
    assert.deepEqual(compact(steps), steps);
  }
});

test("no compacta TYPE vacio ni defaults baseline", () => {
  const emptyFinal = [textInput("#campo", "ana"), textInput("#campo", "")];
  const baseline = [
    textInput("#campo", "default", { _baselineDefault: true }),
    textInput("#campo", "final")
  ];

  assert.deepEqual(compact(emptyFinal), emptyFinal);
  assert.deepEqual(compact(baseline), baseline);
});

test("no compacta filtro si el ultimo valor queda vacio", () => {
  const steps = [
    textInput("#filtro-tabla", "ana"),
    { type: "wait", seconds: 1, _autoWait: true },
    textInput("#filtro-tabla", "")
  ];

  assert.deepEqual(compact(steps), steps);
});

test("macro grabada compactada exporta IIM visible y WM_JSON consistentes", () => {
  const steps = compact([
    textInput("#ce-observaciones", "|"),
    { type: "wait", seconds: 3, _autoWait: true },
    textInput("#ce-observaciones", "O"),
    { type: "wait", seconds: 2, _autoWait: true },
    textInput("#ce-observaciones", ""),
    { type: "wait", seconds: 4, _autoWait: true },
    textInput("#ce-observaciones", "Observaciones 12 final")
  ]);
  const script = adapter.exportToIim({ steps });

  assert.equal(script.includes('CONTENT="|"'), false);
  assert.equal(script.includes('CONTENT="O"'), false);
  assert.ok(script.includes('TYPE SELECTOR="#ce-observaciones" CONTENT="Observaciones 12 final"'));

  const parsedSteps = wmJsonSteps(script);
  assert.equal(parsedSteps.length, 1);
  assert.equal(parsedSteps[0].selector, "#ce-observaciones");
  assert.equal(parsedSteps[0].value, "Observaciones 12 final");
});

test("manifiestos cargan macro-step-compactor antes de content.js", () => {
  const firefox = repoJson("manifest.json");
  const chromium = repoJson("chromium/manifest.json");
  const file = "src/modules/macros/macro-step-compactor.js";
  const content = "src/content/content.js";

  assert.ok(firefox.content_scripts[0].js.indexOf(file) < firefox.content_scripts[0].js.indexOf(content));
  assert.ok(chromium.content_scripts[0].js.indexOf(file) < chromium.content_scripts[0].js.indexOf(content));
});
