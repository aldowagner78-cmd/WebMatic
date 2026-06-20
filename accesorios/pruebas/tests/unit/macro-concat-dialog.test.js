const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Window } = require("happy-dom");
const { freshRequire } = require("../helpers/browser-harness.js");

const dialog = require("../../../../src/modules/ui/macro-concat-dialog.js");
const REPO_ROOT = path.resolve(__dirname, "../../../..");

function setup() {
  const win = new Window({ url: "https://example.test/" });
  global.window = win;
  global.document = win.document;
  global.DOMParser = win.DOMParser;
  global.HTMLElement = win.HTMLElement;
  global.chrome = {
    runtime: {
      getURL(filePath) {
        return `moz-extension://webmatic-test/${String(filePath || "")}`;
      }
    }
  };
  const panel = win.document.createElement("div");
  panel.id = "webmatic-panel-root";
  win.document.body.appendChild(panel);
  return { win, panel };
}

test("macro concat UI: abre, filtra, selecciona varias, quita y confirma", async () => {
  const { panel } = setup();
  const macros = [
    { id: "base", name: "Base" },
    { id: "login", name: "Login usuario" },
    { id: "fecha", name: "Fecha nacimiento" },
    { id: "final", name: "Finalizar" }
  ];

  const promise = dialog.openMacroConcatDialog({ panel, baseMacro: macros[0], macros });
  assert.equal(panel.querySelector("[data-macro-concat-dialog]"), null);
  assert.ok(document.body.querySelector("[data-macro-concat-dialog]"));
  assert.equal(document.body.querySelectorAll("[data-macro-concat-option]").length, 3);

  const modal = document.body.querySelector("[data-macro-concat-dialog]");
  const search = modal.querySelector("[data-macro-concat-search]");
  search.value = "fe";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.deepEqual(
    Array.from(modal.querySelectorAll("[data-macro-concat-option]")).map((btn) => btn.textContent),
    ["Fecha nacimiento"]
  );

  modal.querySelector('[data-macro-concat-option="fecha"]').click();
  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  modal.querySelector('[data-macro-concat-option="login"]').click();

  assert.deepEqual(
    Array.from(modal.querySelectorAll("[data-macro-concat-chip]")).map((chip) => chip.getAttribute("data-macro-concat-chip")),
    ["fecha", "login"]
  );
  assert.equal(modal.querySelector('[data-macro-concat-option="fecha"]').disabled, true);

  modal.querySelector('[data-macro-concat-remove="fecha"]').click();
  assert.deepEqual(
    Array.from(modal.querySelectorAll("[data-macro-concat-chip]")).map((chip) => chip.getAttribute("data-macro-concat-chip")),
    ["login"]
  );

  const name = modal.querySelector("[data-macro-concat-name]");
  name.value = "Macro final";
  name.dispatchEvent(new window.Event("input", { bubbles: true }));
  modal.querySelector("[data-macro-concat-ok]").click();

  const result = await promise;
  assert.equal(result.name, "Macro final");
  assert.deepEqual(result.macros.map((macro) => macro.id), ["login"]);
  assert.equal(document.body.querySelector("[data-macro-concat-dialog]"), null);
});

test("macro concat UI: cancela sin seleccionar", async () => {
  const { panel } = setup();
  const macros = [{ id: "base", name: "Base" }, { id: "a", name: "A" }];
  const promise = dialog.openMacroConcatDialog({ panel, baseMacro: macros[0], macros });
  document.body.querySelector("[data-macro-concat-cancel]").click();
  assert.equal(await promise, null);
});

test("macro concat UI: el panel principal solo conserva el boton y no controles permanentes", () => {
  setup();
  global.WebMaticUiComponents = freshRequire("../../../../src/modules/ui/components/ui-components.js");
  global.WebMaticMacroListState = freshRequire("../../../../src/modules/ui/macro-list-state.js");
  const uiShell = freshRequire("../../../../src/modules/ui/ui-shell.js");
  const panel = uiShell.mount();

  uiShell.render({
    ui: {
      panelVisible: true,
      panelSide: "left",
      panelWidth: 320,
      isFloatingRecorderVisible: false,
      mode: "play",
      saveModal: { open: false, script: "" },
      scriptEditor: { open: false }
    },
    settings: { panelOpacity: 1, themeMode: "light", themeVariant: 1 },
    playback: { isPlaying: false, repeatCount: 5, currentStepIndex: -1, currentSteps: [] },
    recorder: { isRecording: false },
    draft: { stepsCount: 0, steps: [] },
    library: {
      macros: [
        { id: "m1", name: "Base", steps: [] },
        { id: "m2", name: "Otra", steps: [] }
      ],
      selectedMacroId: "m1",
      searchQuery: ""
    },
    runtime: { statusMessage: "" }
  });

  assert.ok(panel.querySelector('[data-action="macro-concat"]'));
  assert.equal(panel.querySelector("[data-macro-concat-dialog]"), null);
  assert.equal(panel.querySelector("[data-macro-concat-search]"), null);
  assert.equal(panel.querySelector("[data-macro-concat-list]"), null);
  assert.equal(panel.querySelector("[data-macro-concat-selected]"), null);
});

test("macro concat UI: muchas macros usan modal acotado con scroll interno", () => {
  const css = fs.readFileSync(path.resolve(REPO_ROOT, "src/modules/ui/ui-shell.css"), "utf8");

  assert.match(css, /\.webmatic-concat-overlay\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(css, /\.webmatic-concat-dialog\s*\{[\s\S]*height:\s*min\(560px,\s*calc\(100vh - 24px\)\);/);
  assert.match(css, /\.webmatic-concat-dialog\s*\{[\s\S]*max-height:\s*calc\(100vh - 24px\);/);
  assert.match(css, /\.webmatic-concat-list\s*\{[\s\S]*min-height:\s*120px;/);
  assert.match(css, /\.webmatic-concat-list\s*\{[\s\S]*overflow:\s*auto;/);
  assert.match(css, /\.webmatic-concat-selected\s*\{[\s\S]*max-height:\s*84px;/);
  assert.match(css, /\.webmatic-concat-selected\s*\{[\s\S]*overflow:\s*auto;/);
});
