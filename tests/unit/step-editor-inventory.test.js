/**
 * Tests unitarios: editor visual usando el inventario de la macro.
 * Verifica que VALUE se ofrezca como dropdown desde macro.meta.pageInventories
 * para choose_option e input, que el editor manual siga disponible, y que el
 * valor escrito no se borre si no está en las opciones.
 * DOM simulado con happy-dom.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const win = new Window({ url: "https://example.com/" });
globalThis.document = win.document;
globalThis.window = win;
globalThis.Element = win.Element;
globalThis.HTMLElement = win.HTMLElement;
globalThis.HTMLInputElement = win.HTMLInputElement;
globalThis.HTMLSelectElement = win.HTMLSelectElement;
globalThis.Event = win.Event;

// page-inventory se registra en globalThis y lo usa step-editor internamente.
require("../../src/modules/inventory/page-inventory.js");
const iimAdapter = require("../../src/modules/storage/iim-adapter.js");
const StepEditor = require("../../src/modules/editor/step-editor.js");

function resetBody(html) {
  win.document.body.innerHTML = html || "";
}

// Inventario con un select cuyo control NO está en el DOM vivo (fuerza el uso
// del inventario, no del <select> real).
const SELECT_INVENTORY = [{
  url: "https://example.com/",
  title: "Form",
  capturedAt: Date.now(),
  controls: [{
    selector: "#estado",
    altSelectors: ['select[name="estado"]'],
    id: "estado",
    name: "estado",
    label: "Estado",
    tag: "select",
    controlKind: "native-select",
    options: [
      { index: 0, value: "1", text: "Activo", selected: false, disabled: false },
      { index: 1, value: "2", text: "Inactivo", selected: false, disabled: false }
    ]
  }]
}];

const DATALIST_INVENTORY = [{
  url: "https://example.com/",
  title: "Form",
  capturedAt: Date.now(),
  controls: [{
    selector: "#ciudad",
    altSelectors: [],
    id: "ciudad",
    name: "ciudad",
    label: "Ciudad",
    tag: "input",
    controlKind: "datalist",
    options: [
      { index: 0, value: "Cordoba", text: "Cordoba", selected: false, disabled: false },
      { index: 1, value: "Rosario", text: "Rosario", selected: false, disabled: false }
    ]
  }]
}];

function buildFields(fields, values) {
  const fieldsDiv = win.document.createElement("div");
  const made = {};
  fields.forEach((name) => {
    const lbl = win.document.createElement("label");
    const inp = win.document.createElement("input");
    inp.type = "text";
    inp.dataset.field = name;
    if (values && values[name] != null) inp.value = values[name];
    lbl.appendChild(inp);
    fieldsDiv.appendChild(lbl);
    made[name] = inp;
  });
  win.document.body.appendChild(fieldsDiv);
  return { fieldsDiv, inputs: made };
}

test("editor: choose_option muestra dropdown VALUE desde el inventario", () => {
  resetBody(""); // selector NO existe en el DOM → usa inventario
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value", "text"], { selector: "#estado" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.ok(combo, "debe mostrarse el combo desde el inventario");
  assert.equal(combo.options.length, 2);
});

test("editor: input también muestra dropdown VALUE desde el inventario", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(DATALIST_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value"], { selector: "#ciudad" });
  ed._syncOptionPicker(fieldsDiv, "input");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.ok(combo, "input con opciones de inventario debe ofrecer dropdown");
  assert.deepEqual(Array.from(combo.options).map((o) => o.value), ["Cordoba", "Rosario"]);
});

test("editor: elegir opción del inventario actualiza value (y text en choose_option)", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv, inputs } = buildFields(["selector", "value", "text"], { selector: "#estado" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  combo.value = "2";
  combo.dispatchEvent(new win.Event("change", { bubbles: true }));
  assert.equal(inputs.value.value, "2");
  assert.equal(inputs.text.value, "Inactivo");
});

test("editor: sin opciones (ni DOM ni inventario) NO inserta combo (editor manual)", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value"], { selector: "#desconocido" });
  ed._syncOptionPicker(fieldsDiv, "input");
  assert.equal(fieldsDiv.querySelector("[data-wm-optcombo]"), null);
});

test("editor: no borra el value escrito si no está entre las opciones del inventario", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv, inputs } = buildFields(["selector", "value", "text"], { selector: "#estado", value: "99" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  // El combo se muestra pero el value manual "99" se conserva intacto.
  assert.ok(fieldsDiv.querySelector("[data-wm-optcombo]"));
  assert.equal(inputs.value.value, "99");
});

test("editor: el DOM vivo tiene prioridad sobre el inventario", () => {
  resetBody(`<select id="estado">
    <option value="X">SoloDom</option>
  </select>`);
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value", "text"], { selector: "#estado" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.equal(combo.options.length, 1, "debe usar el <select> real, no el inventario");
  assert.equal(combo.options[0].value, "X");
});

test("editor: inventario importado desde WM_JSON habilita dropdown VALUE", () => {
  resetBody("");
  const macro = {
    steps: [{ type: "choose_option", selector: "#estado", value: "2" }],
    meta: {
      pageInventories: [{
        url: "https://example.com/",
        controls: [{
          selector: "#estado",
          controlKind: "native-select",
          options: [
            { index: 0, value: "1", text: "Activo", selected: false, disabled: false },
            { index: 1, value: "2", text: "Inactivo", selected: false, disabled: false }
          ]
        }]
      }]
    }
  };
  const script = iimAdapter.exportToIim(macro);
  const imported = iimAdapter.importFromIim(script);

  const ed = new StepEditor();
  ed.setInventory(imported.meta.pageInventories);
  const { fieldsDiv } = buildFields(["selector", "value", "text"], { selector: "#estado", value: "2" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.ok(combo);
  assert.equal(combo.options.length, 2);
  assert.equal(combo.value, "2");
});
