/**
 * Tests unitarios: editor visual usando el inventario de la macro.
 * Verifica que VALUE se ofrezca como <select> real desde macro.meta.pageInventories
 * para choose_option, input y text; que el matching cruzado GeneXus-like funcione;
 * que el editor manual siga disponible; y que el valor previo no se pierda.
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
const invApi = require("../../src/modules/inventory/page-inventory.js");
const iimAdapter = require("../../src/modules/storage/iim-adapter.js");
const StepEditor = require("../../src/modules/editor/step-editor.js");

function resetBody(html) {
  win.document.body.innerHTML = html || "";
}

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

/**
 * Inventario GeneXus-like:
 *   #vDELEGACION -> input autocomplete visible (sin opciones propias)
 *   #vDELEGCOMBO -> select nativo oculto (misma label, mismo prefijo de id)
 */
const GENEXUS_INVENTORY = [{
  url: "https://example.com/delegacion",
  title: "Delegacion",
  capturedAt: Date.now(),
  controls: [
    {
      selector: "#vDELEGACION",
      altSelectors: ['input[name="vDELEGACION"]'],
      id: "vDELEGACION",
      name: "vDELEGACION",
      label: "Delegacion",
      tag: "input",
      type: "text",
      controlKind: "text-input",
      options: []
    },
    {
      selector: "#vDELEGCOMBO",
      altSelectors: ['select[name="vDELEGCOMBO"]'],
      id: "vDELEGCOMBO",
      name: "vDELEGCOMBO",
      label: "Delegacion",
      tag: "select",
      controlKind: "native-select",
      options: [
        { index: 0, value: "0", text: "Seleccionar", selected: false, disabled: false },
        { index: 1, value: "1", text: "IAPOS SANTA FE", selected: false, disabled: false },
        { index: 2, value: "2", text: "ROSARIO", selected: false, disabled: false },
        { index: 3, value: "3", text: "RAFAELA", selected: false, disabled: false }
      ]
    }
  ]
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

// Tests del editor con inventario

test("editor: choose_option muestra dropdown VALUE desde el inventario", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value", "text"], { selector: "#estado" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.ok(combo, "debe mostrarse el combo desde el inventario");
  // 1 opcion manual + 2 opciones reales = 3 total.
  assert.equal(combo.options.length, 3);
  // [data-field="value"] debe ser el propio <select>.
  const valueEl = fieldsDiv.querySelector("[data-field='value']");
  assert.equal(valueEl.tagName.toLowerCase(), "select", "VALUE debe ser un <select> real");
});

test("editor: input tambien muestra dropdown VALUE desde el inventario", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(DATALIST_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value"], { selector: "#ciudad" });
  ed._syncOptionPicker(fieldsDiv, "input");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.ok(combo, "input con opciones de inventario debe ofrecer dropdown");
  const realOpts = Array.from(combo.options).filter((o) => !o.dataset.wmManual);
  assert.deepEqual(realOpts.map((o) => o.value), ["Cordoba", "Rosario"]);
});

test("editor: elegir opcion del inventario actualiza value (y text en choose_option)", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv, inputs } = buildFields(["selector", "value", "text"], { selector: "#estado" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  combo.value = "2";
  combo.dispatchEvent(new win.Event("change", { bubbles: true }));
  // combo ES [data-field="value"], su value refleja la seleccion directamente.
  assert.equal(combo.value, "2");
  // El campo text debe sincronizarse con el texto de la opcion elegida.
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

test("editor: no borra el value escrito si no esta entre las opciones del inventario", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value", "text"], { selector: "#estado", value: "99" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  assert.ok(fieldsDiv.querySelector("[data-wm-optcombo]"));
  const valueEl = fieldsDiv.querySelector("[data-field='value']");
  assert.equal(valueEl.value, "99", "el valor previo debe preservarse en la opcion manual");
});

test("editor: el DOM vivo tiene prioridad sobre el inventario", () => {
  resetBody('<select id="estado"><option value="X">SoloDom</option></select>');
  const ed = new StepEditor();
  ed.setInventory(SELECT_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value", "text"], { selector: "#estado" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  // 1 opcion manual + 1 opcion real del DOM = 2 total.
  assert.equal(combo.options.length, 2, "debe usar el <select> real, no el inventario");
  const realOpts = Array.from(combo.options).filter((o) => !o.dataset.wmManual);
  assert.equal(realOpts[0].value, "X");
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
  // 1 opcion manual + 2 opciones reales = 3.
  assert.equal(combo.options.length, 3);
  assert.equal(combo.value, "2");
});

// findOptionsForStep: cross-control GeneXus-like

test("findOptionsForStep: cross-control por prefijo de id (GeneXus-like)", () => {
  const step = { selector: "#vDELEGACION" };
  const opts = invApi.findOptionsForStep(step, GENEXUS_INVENTORY);
  assert.ok(opts && opts.length === 4, "debe encontrar las 4 opciones de #vDELEGCOMBO");
  assert.deepEqual(opts.map((o) => o.text), ["Seleccionar", "IAPOS SANTA FE", "ROSARIO", "RAFAELA"]);
});

test("findOptionsForStep: cross-control por label igual (GeneXus-like)", () => {
  const step = { selector: "#vDELEGACION" };
  const opts = invApi.findOptionsForStep(step, GENEXUS_INVENTORY);
  assert.ok(opts && opts.length > 0, "debe resolver opciones via label igual");
});

test("findOptionsForStep: null si el step no existe en ningun inventario", () => {
  const opts = invApi.findOptionsForStep({ selector: "#noExiste" }, GENEXUS_INVENTORY);
  assert.equal(opts, null);
});

test("findOptionsForStep: encuentra opciones por controlRef.selector", () => {
  const step = {
    selector: "#campo-custom",
    controlRef: { selector: "#vDELEGCOMBO" }
  };
  const opts = invApi.findOptionsForStep(step, GENEXUS_INVENTORY);
  assert.ok(opts && opts.length === 4, "debe encontrar opciones por controlRef.selector");
});

test("editor: VALUE es <select> con opciones GeneXus-like por cross-control", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(GENEXUS_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value", "text"], { selector: "#vDELEGACION" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const valueEl = fieldsDiv.querySelector("[data-field='value']");
  assert.ok(valueEl, "[data-field='value'] debe existir");
  assert.equal(valueEl.tagName.toLowerCase(), "select", "VALUE debe ser un <select>");
  const realOpts = Array.from(valueEl.options).filter((o) => !o.dataset.wmManual);
  assert.deepEqual(
    realOpts.map((o) => o.text),
    ["Seleccionar", "IAPOS SANTA FE", "ROSARIO", "RAFAELA"]
  );
});

test("editor: VALUE es <select> con opciones GeneXus-like por step.controlRef", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory(GENEXUS_INVENTORY);
  const { fieldsDiv } = buildFields(["selector", "value", "text"], { selector: "#vDELEGACION" });
  const pseudoStep = { selector: "#vDELEGACION", controlRef: { selector: "#vDELEGCOMBO" } };
  ed._syncOptionPicker(fieldsDiv, "input", pseudoStep);
  const valueEl = fieldsDiv.querySelector("[data-field='value']");
  assert.equal(valueEl.tagName.toLowerCase(), "select");
  const realOpts = Array.from(valueEl.options).filter((o) => !o.dataset.wmManual);
  assert.ok(realOpts.some((o) => o.text === "RAFAELA"), "debe incluir RAFAELA");
});

test("editor: macros antiguas sin inventario siguen funcionando (no hay dropdown)", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setInventory([]);
  const { fieldsDiv, inputs } = buildFields(["selector", "value", "text"], { selector: "#cualquierCampo", value: "valorAntiguo" });
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const valueEl = fieldsDiv.querySelector("[data-field='value']");
  assert.equal(valueEl.tagName.toLowerCase(), "input", "sin inventario VALUE debe seguir siendo <input>");
  assert.equal(valueEl.value, "valorAntiguo", "el valor manual no debe borrarse");
});
