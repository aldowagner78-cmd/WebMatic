/**
 * Tests unitarios para step-editor.js
 * Cubre: getSelectOptionsForSelector (función pura) y la sincronización del
 * combo amigable de opciones reales sobre el editor visual.
 * DOM simulado con happy-dom (sin browser real).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

// ── Setup DOM global ANTES de importar step-editor.js ────────────────────────
const win = new Window({ url: "https://example.com/" });
globalThis.document = win.document;
globalThis.window = win;
globalThis.Element = win.Element;
globalThis.HTMLElement = win.HTMLElement;
globalThis.HTMLInputElement = win.HTMLInputElement;
globalThis.HTMLSelectElement = win.HTMLSelectElement;
globalThis.Event = win.Event;
globalThis.CustomEvent = win.CustomEvent;

const StepEditor = require("../../src/modules/editor/step-editor.js");

function resetBody(html) {
  win.document.body.innerHTML = html;
}

const SIMPLE_SELECT = `
  <select id="pais">
    <option value="ar">Argentina</option>
    <option value="br">Brasil</option>
  </select>`;

// ── getSelectOptionsForSelector ───────────────────────────────────────────────

test("getSelectOptionsForSelector: devuelve opciones de un <select> simple", () => {
  resetBody(SIMPLE_SELECT);
  const opts = StepEditor.getSelectOptionsForSelector("#pais", win.document);
  assert.ok(Array.isArray(opts));
  assert.equal(opts.length, 2);
  assert.equal(opts[0].value, "ar");
  assert.equal(opts[0].text, "Argentina");
  assert.equal(opts[1].value, "br");
  assert.equal(opts[1].text, "Brasil");
});

test("getSelectOptionsForSelector: null si el selector no existe", () => {
  resetBody(SIMPLE_SELECT);
  const opts = StepEditor.getSelectOptionsForSelector("#no-existe", win.document);
  assert.equal(opts, null);
});

test("getSelectOptionsForSelector: null si el selector apunta a un input común", () => {
  resetBody('<input id="nombre" type="text">');
  const opts = StepEditor.getSelectOptionsForSelector("#nombre", win.document);
  assert.equal(opts, null);
});

test("getSelectOptionsForSelector: null si el selector es inválido", () => {
  resetBody(SIMPLE_SELECT);
  const opts = StepEditor.getSelectOptionsForSelector("###(", win.document);
  assert.equal(opts, null);
});

test("getSelectOptionsForSelector: preserva index/value/text/selected/disabled", () => {
  resetBody(`
    <select id="estado">
      <option value="a">Activo</option>
      <option value="b" selected>Baja</option>
      <option value="c" disabled>Cancelado</option>
    </select>`);
  const opts = StepEditor.getSelectOptionsForSelector("#estado", win.document);
  assert.equal(opts.length, 3);
  assert.equal(opts[0].index, 0);
  assert.equal(opts[1].index, 1);
  assert.equal(opts[1].selected, true);
  assert.equal(opts[0].selected, false);
  assert.equal(opts[2].disabled, true);
  assert.equal(opts[0].disabled, false);
});

test("getSelectOptionsForSelector: no falla con un <select> grande (>1200 opciones)", () => {
  let html = '<select id="grande">';
  for (let i = 0; i < 1300; i++) html += `<option value="v${i}">Opcion ${i}</option>`;
  html += "</select>";
  resetBody(html);
  const opts = StepEditor.getSelectOptionsForSelector("#grande", win.document);
  assert.equal(opts.length, 1300);
  assert.equal(opts[1299].value, "v1299");
});

// ── Sincronización con el editor visual ───────────────────────────────────────

/**
 * Construye un fieldsDiv mínimo (selector + value + text) como el que arma el
 * editor visual, llama a _syncOptionPicker y devuelve los elementos relevantes.
 */
function buildFields(stepValue, stepText) {
  const fieldsDiv = win.document.createElement("div");
  const mkInput = (field) => {
    const lbl = win.document.createElement("label");
    const inp = win.document.createElement("input");
    inp.type = "text";
    inp.dataset.field = field;
    lbl.appendChild(inp);
    fieldsDiv.appendChild(lbl);
    return inp;
  };
  const selInput = mkInput("selector");
  const valInput = mkInput("value");
  const textInput = mkInput("text");
  // Insertar ANTES de asignar valores: happy-dom resetea .value al conectar al DOM.
  win.document.body.appendChild(fieldsDiv);
  selInput.value = "#pais";
  if (stepValue != null) valInput.value = stepValue;
  if (stepText != null) textInput.value = stepText;
  return { fieldsDiv, selInput, valInput, textInput };
}

test("_syncOptionPicker: inserta el combo cuando el selector resuelve a <select>", () => {
  resetBody(SIMPLE_SELECT);
  const ed = new StepEditor();
  const { fieldsDiv } = buildFields("ar", "");
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.ok(combo, "debe insertarse el combo amigable");
  // 1 opción manual + 2 opciones reales = 3 total.
  assert.equal(combo.options.length, 3);
});

test("_syncOptionPicker: NO inserta combo si el selector no existe (fallback manual)", () => {
  resetBody(SIMPLE_SELECT);
  const ed = new StepEditor();
  const { fieldsDiv, selInput } = buildFields("", "");
  selInput.value = "#no-existe";
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  assert.equal(fieldsDiv.querySelector("[data-wm-optcombo]"), null);
});

test("_syncOptionPicker: NO inserta combo si el elemento no es <select>", () => {
  resetBody('<input id="pais" type="text">');
  const ed = new StepEditor();
  const { fieldsDiv } = buildFields("", "");
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  assert.equal(fieldsDiv.querySelector("[data-wm-optcombo]"), null);
});

test("_syncOptionPicker: preselecciona el value actual del paso", () => {
  resetBody(SIMPLE_SELECT);
  const ed = new StepEditor();
  const { fieldsDiv } = buildFields("br", "");
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.equal(combo.value, "br");
});

test("_syncOptionPicker: [data-field='value'] es un <select> real cuando hay opciones", () => {
  resetBody(SIMPLE_SELECT);
  const ed = new StepEditor();
  const { fieldsDiv } = buildFields("ar", "");
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const valueEl = fieldsDiv.querySelector("[data-field='value']");
  assert.ok(valueEl, "debe existir [data-field='value']");
  assert.equal(valueEl.tagName.toLowerCase(), "select", "VALUE debe ser un <select>");
  assert.equal(valueEl.dataset.wmOptcombo, "1", "debe tener data-wm-optcombo=1");
});

test("_syncOptionPicker: value actual no está en opciones → opción manual preseleccionada", () => {
  resetBody(SIMPLE_SELECT);
  const ed = new StepEditor();
  const { fieldsDiv } = buildFields("ZZ", "");  // "ZZ" no es una opción
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const valueEl = fieldsDiv.querySelector("[data-field='value']");
  // La opción manual debe existir y conservar el valor previo.
  const manualOpt = Array.from(valueEl.options).find((o) => o.dataset.wmManual === "1");
  assert.ok(manualOpt, "debe haber una opción manual");
  assert.equal(manualOpt.value, "ZZ", "la opción manual debe preservar el valor previo");
  // El input compañero de entrada manual también muestra el valor.
  const manualInput = fieldsDiv.querySelector("[data-wm-manual-input]");
  assert.ok(manualInput, "debe haber input manual compañero");
  assert.equal(manualInput.value, "ZZ", "el input manual debe tener el valor previo");
});

test("_syncOptionPicker: elegir una opción sincroniza value y text del paso", () => {
  resetBody(SIMPLE_SELECT);
  const ed = new StepEditor();
  const { fieldsDiv, textInput } = buildFields("ar", "");
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  // combo ES [data-field="value"] — no hace falta sincronizar un input aparte.
  combo.value = "br";
  combo.dispatchEvent(new win.Event("change", { bubbles: true }));
  assert.equal(combo.value, "br");
  assert.equal(textInput.value, "Brasil");
});

test("_syncOptionPicker: combo con muchas opciones agrega filtro local", () => {
  let html = '<select id="grande">';
  for (let i = 0; i < 100; i++) html += `<option value="v${i}">Opcion ${i}</option>`;
  html += "</select>";
  resetBody(html);
  const ed = new StepEditor();
  const fieldsDiv = win.document.createElement("div");
  // Selector field
  const lblSel = win.document.createElement("label");
  const selInp = win.document.createElement("input");
  selInp.dataset.field = "selector";
  selInp.value = "#grande";
  lblSel.appendChild(selInp);
  fieldsDiv.appendChild(lblSel);
  // VALUE field (necesario para que _syncOptionPicker pueda reemplazarlo).
  const lblVal = win.document.createElement("label");
  const valInp = win.document.createElement("input");
  valInp.type = "text";
  valInp.dataset.field = "value";
  lblVal.appendChild(valInp);
  fieldsDiv.appendChild(lblVal);
  win.document.body.appendChild(fieldsDiv);
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const block = fieldsDiv.querySelector("[data-wm-optpicker]");
  assert.ok(block);
  const filter = block.querySelector("input");
  assert.ok(filter, "selects grandes deben mostrar un filtro de texto");
  // El VALUE debe ser ahora un <select>.
  const valueEl = fieldsDiv.querySelector("[data-field='value']");
  assert.equal(valueEl.tagName.toLowerCase(), "select", "VALUE debe ser un <select> real");
});
