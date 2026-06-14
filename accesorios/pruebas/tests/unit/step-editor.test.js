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

const StepEditor = require("../../../../src/modules/editor/step-editor.js");

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
  const mkInput = (field, val) => {
    const lbl = win.document.createElement("label");
    const inp = win.document.createElement("input");
    inp.type = "text";
    inp.dataset.field = field;
    if (val != null) inp.value = val;
    lbl.appendChild(inp);
    fieldsDiv.appendChild(lbl);
    return inp;
  };
  const selInput = mkInput("selector", "#pais");
  const valInput = mkInput("value", stepValue);
  const textInput = mkInput("text", stepText);
  win.document.body.appendChild(fieldsDiv);
  return { fieldsDiv, selInput, valInput, textInput };
}

test("_syncOptionPicker: inserta el combo cuando el selector resuelve a <select>", () => {
  resetBody(SIMPLE_SELECT);
  const ed = new StepEditor();
  const { fieldsDiv } = buildFields("ar", "");
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  assert.ok(combo, "debe insertarse el combo amigable");
  assert.equal(combo.options.length, 2);
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

test("_syncOptionPicker: elegir una opción sincroniza value y text del paso", () => {
  resetBody(SIMPLE_SELECT);
  const ed = new StepEditor();
  const { fieldsDiv, valInput, textInput } = buildFields("ar", "");
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const combo = fieldsDiv.querySelector("[data-wm-optcombo]");
  combo.value = "br";
  combo.dispatchEvent(new win.Event("change", { bubbles: true }));
  assert.equal(valInput.value, "br");
  assert.equal(textInput.value, "Brasil");
});

test("_syncOptionPicker: combo con muchas opciones agrega filtro local", () => {
  let html = '<select id="grande">';
  for (let i = 0; i < 100; i++) html += `<option value="v${i}">Opcion ${i}</option>`;
  html += "</select>";
  resetBody(html);
  const ed = new StepEditor();
  const fieldsDiv = win.document.createElement("div");
  const lbl = win.document.createElement("label");
  const sel = win.document.createElement("input");
  sel.dataset.field = "selector";
  sel.value = "#grande";
  lbl.appendChild(sel);
  fieldsDiv.appendChild(lbl);
  win.document.body.appendChild(fieldsDiv);
  ed._syncOptionPicker(fieldsDiv, "choose_option");
  const block = fieldsDiv.querySelector("[data-wm-optpicker]");
  assert.ok(block);
  const filter = block.querySelector("input");
  assert.ok(filter, "selects grandes deben mostrar un filtro de texto");
});

test("reordenado: el paso movido queda resaltado hasta limpiar", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "click", selector: "#a" },
    { type: "open_tab", url: "https://example.com", activate: "true" },
    { type: "click", selector: "#b" }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  ed._move(0, 1, "button");
  assert.equal(ed.hasPendingReorderChanges(), true);
  assert.ok(container.querySelector(".wm-sved-reorder-pending"));
  assert.ok(container.querySelector(".wm-sved-row-moved"));
  assert.ok(container.querySelector(".wm-sved-row-moved-button"));

  // El resaltado persiste en renders posteriores hasta limpiar explícitamente.
  ed._render();
  assert.ok(container.querySelector(".wm-sved-row-moved"));

  ed.clearReorderHighlights();
  assert.equal(ed.hasPendingReorderChanges(), false);
  assert.equal(container.querySelector(".wm-sved-row-moved"), null);
  assert.equal(container.querySelector(".wm-sved-reorder-pending"), null);
});

test("reordenado por arrastre: aplica estilo visual especifico", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "click", selector: "#base" },
    { type: "open_tab", url: "https://example.com", activate: "true" },
    { type: "click", selector: "#b" },
    { type: "switch_tab", url: "https://origin.example", openIfMissing: "true" },
    { type: "click", selector: "#c" }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  // Arrastrar el lider del bloque (idx=1) mueve el bloque completo.
  ed._moveToIndex(1, 0, "drag");
  assert.equal(ed.hasPendingReorderChanges(), true);
  assert.ok(container.querySelector(".wm-sved-row-moved-drag"));
});

test("bloques por macro concatenada: separa por marca y colapsa por defecto", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "click", selector: "#m1-a", _wmBlockStart: true, _wmCollapsed: true },
    { type: "click", selector: "#m1-b" },
    { type: "click", selector: "#m2-a", _wmBlockStart: true, _wmCollapsed: true },
    { type: "click", selector: "#m2-b" }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  const blocks = container.querySelectorAll(".wm-sved-block");
  assert.equal(blocks.length, 2);

  const collapsedBlocks = container.querySelectorAll(".wm-sved-block-collapsed");
  assert.equal(collapsedBlocks.length, 2);

  blocks.forEach((block) => {
    assert.equal(block.querySelectorAll(".wm-sved-row").length, 1);
  });
});

test("editor visual: abre con bloques colapsados por defecto", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "open_tab", url: "https://a.example" },
    { type: "click", selector: "#a" },
    { type: "switch_tab", url: "https://b.example" },
    { type: "click", selector: "#b" }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  const collapsedBlocks = container.querySelectorAll(".wm-sved-block-collapsed");
  assert.equal(collapsedBlocks.length, 2);
  collapsedBlocks.forEach((block) => {
    assert.equal(block.querySelectorAll(".wm-sved-row").length, 1);
  });
});

test("bloques colapsados muestran accion contextual de agregar bloque", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "open_tab", url: "https://a.example" },
    { type: "click", selector: "#a" }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  const actionButtons = Array.from(container.querySelectorAll(".wm-sved-block-actions .wm-sved-add-btn"));
  assert.equal(actionButtons.length, 1);
  assert.ok(actionButtons[0].textContent.includes("Agregar bloque"), `Esperado "Agregar bloque" en "${actionButtons[0].textContent}"`);
});

test("bloques por contexto: A -> B -> A marca reingreso sin fusionar bloques", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "navigate", url: "https://a.local", _wmBlockKey: "a.local/", _wmBlockStart: true },
    { type: "click", selector: "#a1", _wmBlockKey: "a.local/" },
    { type: "switch_tab", url: "https://b.local", _wmBlockKey: "b.local/", _wmBlockStart: true },
    { type: "click", selector: "#b1", _wmBlockKey: "b.local/" },
    { type: "switch_tab", url: "https://a.local", _wmBlockKey: "a.local/", _wmBlockStart: true },
    { type: "click", selector: "#a2", _wmBlockKey: "a.local/" }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  const blocks = Array.from(container.querySelectorAll(".wm-sved-block"));
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].dataset.blockVisit, "1");
  assert.equal(blocks[1].dataset.blockVisit, "1");
  assert.equal(blocks[2].dataset.blockVisit, "2");
  assert.equal(blocks[2].dataset.blockReentry, "true");
  assert.ok(blocks[2].classList.contains("wm-sved-block-reentry"));
  assert.equal(container.querySelectorAll(".wm-sved-block-reentry-badge").length, 1);
  assert.equal(container.querySelectorAll(".wm-sved-row").length, 3);
  const contexts = Array.from(container.querySelectorAll(".wm-sved-block-context")).map((node) => node.textContent);
  assert.deepEqual(contexts, ["a.local/", "b.local/", "a.local/"]);
});

test("bloques por contexto: mismo contexto consecutivo no marca reingreso falso", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "navigate", url: "https://a.local", _wmBlockKey: "a.local/", _wmBlockStart: true },
    { type: "click", selector: "#a1", _wmBlockKey: "a.local/" },
    { type: "input", selector: "#a2", value: "hola", _wmBlockKey: "a.local/" }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  const blocks = container.querySelectorAll(".wm-sved-block");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].dataset.blockVisit, "1");
  assert.equal(blocks[0].dataset.blockReentry, undefined);
  assert.equal(container.querySelectorAll(".wm-sved-block-reentry-badge").length, 0);
});

test("bloques por contexto: defaults mantienen estilo aunque haya reingreso posterior", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "capture_defaults", _wmBlockKey: "a.local/", _wmBlockStart: true, _baselineDefault: true },
    { type: "click", selector: "#b", _wmBlockKey: "b.local/", _wmBlockStart: true },
    { type: "switch_tab", url: "https://a.local", _wmBlockKey: "a.local/", _wmBlockStart: true },
    { type: "click", selector: "#a2", _wmBlockKey: "a.local/" }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  const blocks = Array.from(container.querySelectorAll(".wm-sved-block"));
  assert.ok(blocks[0].classList.contains("wm-sved-block-defaults"));
  assert.equal(blocks[0].dataset.blockVisit, "1");
  assert.ok(blocks[2].classList.contains("wm-sved-block-reentry"));
});

test("bloques por contexto: macros viejas sin _wmBlockKey siguen renderizando", () => {
  resetBody("");
  const ed = new StepEditor();
  ed.setSteps([
    { type: "click", selector: "#a", _wmBlockStart: true },
    { type: "click", selector: "#b" },
    { type: "click", selector: "#c", _wmBlockStart: true }
  ]);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  ed.mount(container, () => {});

  const blocks = container.querySelectorAll(".wm-sved-block");
  assert.equal(blocks.length, 2);
  assert.equal(container.querySelectorAll(".wm-sved-block-context").length, 0);
  assert.equal(container.querySelectorAll(".wm-sved-block-reentry-badge").length, 0);
});
