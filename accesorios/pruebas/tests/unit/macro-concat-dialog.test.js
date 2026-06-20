const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const dialog = require("../../../../src/modules/ui/macro-concat-dialog.js");

function setup() {
  const win = new Window({ url: "https://example.test/" });
  global.window = win;
  global.document = win.document;
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
  assert.ok(panel.querySelector("[data-macro-concat-dialog]"));
  assert.equal(panel.querySelectorAll("[data-macro-concat-option]").length, 3);

  const search = panel.querySelector("[data-macro-concat-search]");
  search.value = "fe";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.deepEqual(
    Array.from(panel.querySelectorAll("[data-macro-concat-option]")).map((btn) => btn.textContent),
    ["Fecha nacimiento"]
  );

  panel.querySelector('[data-macro-concat-option="fecha"]').click();
  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  panel.querySelector('[data-macro-concat-option="login"]').click();

  assert.deepEqual(
    Array.from(panel.querySelectorAll("[data-macro-concat-chip]")).map((chip) => chip.getAttribute("data-macro-concat-chip")),
    ["fecha", "login"]
  );
  assert.equal(panel.querySelector('[data-macro-concat-option="fecha"]').disabled, true);

  panel.querySelector('[data-macro-concat-remove="fecha"]').click();
  assert.deepEqual(
    Array.from(panel.querySelectorAll("[data-macro-concat-chip]")).map((chip) => chip.getAttribute("data-macro-concat-chip")),
    ["login"]
  );

  const name = panel.querySelector("[data-macro-concat-name]");
  name.value = "Macro final";
  name.dispatchEvent(new window.Event("input", { bubbles: true }));
  panel.querySelector("[data-macro-concat-ok]").click();

  const result = await promise;
  assert.equal(result.name, "Macro final");
  assert.deepEqual(result.macros.map((macro) => macro.id), ["login"]);
  assert.equal(panel.querySelector("[data-macro-concat-dialog]"), null);
});

test("macro concat UI: cancela sin seleccionar", async () => {
  const { panel } = setup();
  const macros = [{ id: "base", name: "Base" }, { id: "a", name: "A" }];
  const promise = dialog.openMacroConcatDialog({ panel, baseMacro: macros[0], macros });
  panel.querySelector("[data-macro-concat-cancel]").click();
  assert.equal(await promise, null);
});
