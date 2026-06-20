const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createChromeMock,
  createDomHarness,
  freshRequire
} = require("../helpers/browser-harness.js");

const REPO_ROOT = path.resolve(__dirname, "../../../..");

function readRepoJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function createState(overrides) {
  const contracts = freshRequire("../../../../src/core/contracts.js");
  const storeApi = freshRequire("../../../../src/core/store.js");
  const store = storeApi.createStore();
  store.dispatch({ type: contracts.ActionTypes.PANEL_SHOWN });
  store.dispatch({
    type: contracts.ActionTypes.LIBRARY_LOADED,
    payload: [
      { id: "m1", name: "Macro vieja", steps: [{ type: "click", selector: "#a" }], script: "CLICK SELECTOR=\"#a\"", createdAt: 1 },
      { id: "m2", name: "Otra macro", steps: [{ type: "input", selector: "#b", value: "x" }], script: "TYPE SELECTOR=\"#b\" CONTENT=\"x\"", createdAt: 2 }
    ]
  });
  store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: "m1" });
  Object.entries(overrides || {}).forEach(([type, payload]) => {
    store.dispatch({ type, payload });
  });
  return { contracts, store, state: store.getState() };
}

function bootUiShell() {
  const harness = createDomHarness();
  globalThis.DOMParser = harness.window.DOMParser;
  createChromeMock();
  freshRequire("../../../../src/modules/ui/components/ui-components.js");
  freshRequire("../../../../src/modules/ui/macro-list-state.js");
  return freshRequire("../../../../src/modules/ui/ui-shell.js");
}

test("macro list state: firma visible cambia cuando cambia el nombre aunque conserve id", () => {
  const listState = freshRequire("../../../../src/modules/ui/macro-list-state.js");
  const before = [{ id: "m1", name: "Viejo", steps: [{}] }];
  const after = [{ id: "m1", name: "Nuevo", steps: [{}] }];

  assert.notEqual(listState.getVisibleSignature(before), listState.getVisibleSignature(after));
  assert.equal(listState.shouldRebuildMacroList(listState.getVisibleSignature(before), after), true);
});

test("macro list state: filtro activo usa el nombre renombrado", () => {
  const listState = freshRequire("../../../../src/modules/ui/macro-list-state.js");
  const macros = [
    { id: "m1", name: "Nuevo login", steps: [] },
    { id: "m2", name: "Reporte", steps: [] }
  ];

  assert.deepEqual(listState.filterMacros(macros, "nuevo").map((macro) => macro.id), ["m1"]);
  assert.deepEqual(listState.filterMacros(macros, "viejo").map((macro) => macro.id), []);
});

test("macro rename service: actualiza estado local sin duplicar y conserva payload operativo", () => {
  const rename = freshRequire("../../../../src/modules/macros/macro-rename-service.js");
  const macros = [
    { id: "m1", name: "Macro vieja", steps: [{ type: "key", key: "Enter", selector: "#busqueda" }], script: "KEY CODE=\"Enter\"", createdAt: 1 },
    { id: "m2", name: "Otra macro", steps: [{ type: "click", selector: "#ok" }], script: "CLICK SELECTOR=\"#ok\"", createdAt: 2 }
  ];

  const result = rename.buildRenamedMacros(macros, "m1", "Macro nueva");

  assert.equal(result.ok, true);
  assert.equal(result.macros.length, 2);
  assert.deepEqual(result.macros.map((macro) => macro.id), ["m1", "m2"]);
  assert.equal(result.macros[0].name, "Macro nueva");
  assert.equal(result.macros.some((macro) => macro.name === "Macro vieja"), false);
  assert.deepEqual(result.macros[0].steps, macros[0].steps);
  assert.equal(result.macros[0].script, macros[0].script);
});

test("macro rename service: rename fallido no devuelve macros modificadas", () => {
  const rename = freshRequire("../../../../src/modules/macros/macro-rename-service.js");
  const macros = [{ id: "m1", name: "Macro vieja", steps: [], createdAt: 1 }];

  const empty = rename.buildRenamedMacros(macros, "m1", "   ");
  const missing = rename.buildRenamedMacros(macros, "m9", "Nueva");

  assert.equal(empty.ok, false);
  assert.equal(empty.macros, macros);
  assert.equal(missing.ok, false);
  assert.equal(missing.macros, macros);
});

test("ui shell: renombrar macro seleccionada actualiza listado visible sin refresh", () => {
  const uiShell = bootUiShell();
  const { contracts, store, state } = createState();
  const panel = uiShell.mount();

  uiShell.render(state);
  assert.equal(panel.querySelector("[data-macro-id='m1'] .webmatic-macro-name").textContent, "Macro vieja");

  store.dispatch({ type: contracts.ActionTypes.MACRO_RENAMED, payload: { id: "m1", name: "Macro nueva" } });
  uiShell.render(store.getState());

  assert.equal(panel.querySelectorAll(".webmatic-macro-item[data-macro-id='m1']").length, 1);
  assert.equal(panel.querySelector(".webmatic-macro-item[data-macro-id='m1'] .webmatic-macro-name").textContent, "Macro nueva");
  assert.equal(panel.textContent.includes("Macro vieja"), false);
  assert.equal(panel.querySelector(".webmatic-macro-item[data-macro-id='m1']").classList.contains("selected"), true);
});

test("ui shell: renombrar con filtro activo respeta coincidencia y desaparicion filtrada", () => {
  const uiShell = bootUiShell();
  const { contracts, store } = createState({ LIBRARY_FILTERED: "login" });
  const panel = uiShell.mount();

  store.dispatch({ type: contracts.ActionTypes.MACRO_RENAMED, payload: { id: "m1", name: "Login nuevo" } });
  uiShell.render(store.getState());
  assert.equal(panel.querySelector(".webmatic-macro-item[data-macro-id='m1'] .webmatic-macro-name").textContent, "Login nuevo");

  store.dispatch({ type: contracts.ActionTypes.MACRO_RENAMED, payload: { id: "m1", name: "Reporte final" } });
  uiShell.render(store.getState());

  assert.equal(panel.querySelector(".webmatic-macro-item[data-macro-id='m1']"), null);
  assert.equal(store.getState().library.macros.find((macro) => macro.id === "m1").name, "Reporte final");
});

test("manifest: modulos de rename/listado cargan antes de sus consumidores", () => {
  const manifest = readRepoJson("manifest.json");
  const scripts = manifest.content_scripts[0].js;

  assert.ok(scripts.indexOf("src/modules/ui/macro-list-state.js") < scripts.indexOf("src/modules/ui/ui-shell.js"));
  assert.ok(scripts.indexOf("src/modules/macros/macro-rename-service.js") < scripts.indexOf("src/content/content.js"));
});
