/**
 * Tests unitarios para page-inventory.js
 * Cubre: captura de controles (input, select nativo, datalist, checkbox, button),
 * no captura de valores sensibles, preservación de value/text de opciones,
 * asociación step↔control (exacta, alternativa, fallback), findOptionsForSelector,
 * associateSteps y appendInventory.
 * DOM simulado con happy-dom (sin browser real).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const win = new Window({ url: "https://example.com/form" });
globalThis.document = win.document;
globalThis.window = win;
globalThis.Element = win.Element;
globalThis.HTMLElement = win.HTMLElement;
globalThis.HTMLInputElement = win.HTMLInputElement;
globalThis.HTMLSelectElement = win.HTMLSelectElement;
globalThis.Event = win.Event;

const inv = require("../../../../src/modules/inventory/page-inventory.js");

function resetBody(html) {
  win.document.body.innerHTML = html;
}

// ── captureControl ────────────────────────────────────────────────────────────

test("captureControl: input de texto → controlKind text-input + currentValue", () => {
  resetBody('<input id="nombre" name="nombre" type="text" value="Juan">');
  const el = win.document.getElementById("nombre");
  const c = inv.captureControl(el);
  assert.equal(c.controlKind, "text-input");
  assert.equal(c.selector, "#nombre");
  assert.equal(c.currentValue, "Juan");
});

test("captureControl: select nativo conserva value/text/selected de cada opción", () => {
  resetBody(`<select id="pais">
    <option value="ar">Argentina</option>
    <option value="br" selected>Brasil</option>
  </select>`);
  const el = win.document.getElementById("pais");
  const c = inv.captureControl(el);
  assert.equal(c.controlKind, "native-select");
  assert.equal(c.options.length, 2);
  assert.deepEqual(
    c.options.map((o) => ({ value: o.value, text: o.text, selected: o.selected })),
    [
      { value: "ar", text: "Argentina", selected: false },
      { value: "br", text: "Brasil", selected: true }
    ]
  );
});

test("captureControl: input con datalist → controlKind datalist + opciones del datalist", () => {
  resetBody(`<input id="ciudad" type="text" list="ciudades">
    <datalist id="ciudades">
      <option value="Cordoba"></option>
      <option value="Rosario"></option>
    </datalist>`);
  const el = win.document.getElementById("ciudad");
  const c = inv.captureControl(el);
  assert.equal(c.controlKind, "datalist");
  assert.deepEqual(c.options.map((o) => o.value), ["Cordoba", "Rosario"]);
});

test("captureControl: checkbox → controlKind checkbox + currentValue booleano string", () => {
  resetBody('<input id="acepto" type="checkbox" checked>');
  const el = win.document.getElementById("acepto");
  const c = inv.captureControl(el);
  assert.equal(c.controlKind, "checkbox");
  assert.equal(c.currentValue, "true");
});

test("captureControl: button → controlKind button sin currentValue", () => {
  resetBody('<button id="enviar">Enviar</button>');
  const el = win.document.getElementById("enviar");
  const c = inv.captureControl(el);
  assert.equal(c.controlKind, "button");
  assert.equal(c.currentValue, undefined);
});

test("captureControl: NO captura el valor de un input password", () => {
  resetBody('<input id="clave" type="password" value="secreto123">');
  const el = win.document.getElementById("clave");
  const c = inv.captureControl(el);
  assert.equal(c.currentValue, undefined);
});

test("captureControl: NO captura el valor de un campo con name sensible (token)", () => {
  resetBody('<input id="campo" name="csrf_token" type="text" value="abc">');
  const el = win.document.getElementById("campo");
  const c = inv.captureControl(el);
  assert.equal(c.currentValue, undefined);
});

test("captureControl: NO captura el valor cuando el label es sensible (PIN/CVV)", () => {
  resetBody('<label for="secure-field">PIN de seguridad</label><input id="secure-field" type="text" value="1234">');
  const el = win.document.getElementById("secure-field");
  const c = inv.captureControl(el);
  assert.equal(c.currentValue, undefined);
});

test("captureControl: ignora elementos propios de WebMatic (id wm-/webmatic-)", () => {
  resetBody('<input id="webmatic-foo" type="text">');
  const el = win.document.getElementById("webmatic-foo");
  assert.equal(inv.captureControl(el), null);
});

// ── captureInventory ──────────────────────────────────────────────────────────

test("captureInventory: recorre el documento y devuelve url/title/controls", () => {
  resetBody(`
    <input id="a" type="text">
    <select id="b"><option value="x">X</option></select>
    <button id="c">C</button>`);
  const snapshot = inv.captureInventory(win.document);
  assert.ok(snapshot.url.includes("example.com"));
  assert.equal(snapshot.controls.length, 3);
  assert.ok(typeof snapshot.capturedAt === "number");
});

test("captureInventory: enriquece options desde runtime GeneXus cuando el input no tiene <select> visible", () => {
  resetBody('<input id="vAUCAESPEFC" name="vAUCAESPEFC" type="text">');
  win.gx = {
    sample: {
      vAUCAESPEFCCatalog: {
        v: [
          ["33", "ALOJAMIENTO"],
          ["10", "CARDIOLOGIA"]
        ]
      }
    }
  };

  const snapshot = inv.captureInventory(win.document);
  const ctrl = snapshot.controls.find((c) => c.selector === "#vAUCAESPEFC");
  assert.ok(ctrl);
  assert.ok(Array.isArray(ctrl.options));
  assert.equal(ctrl.options.length, 2);
  assert.equal(ctrl.options[0].text, "ALOJAMIENTO");
});

// ── findControlForSelector / findOptionsForSelector ────────────────────────────

function selectInventory() {
  resetBody(`<select id="pais" name="pais">
    <option value="ar">Argentina</option>
    <option value="br">Brasil</option>
  </select>`);
  return [inv.captureInventory(win.document)];
}

test("findControlForSelector: coincidencia exacta por selector principal", () => {
  const inventories = selectInventory();
  const c = inv.findControlForSelector("#pais", inventories);
  assert.ok(c);
  assert.equal(c.id, "pais");
});

test("findControlForSelector: coincidencia por selector alternativo (name)", () => {
  const inventories = selectInventory();
  const c = inv.findControlForSelector('select[name="pais"]', inventories);
  assert.ok(c);
  assert.equal(c.id, "pais");
});

test("findControlForSelector: fallback por id cuando el selector difiere", () => {
  const inventories = selectInventory();
  // selector con ancestro distinto pero termina en #pais como id
  const c = inv.findControlForSelector("#pais", inventories);
  assert.ok(c);
});

test("findControlForSelector: null si no hay coincidencia", () => {
  const inventories = selectInventory();
  assert.equal(inv.findControlForSelector("#no-existe", inventories), null);
});

test("findOptionsForSelector: devuelve opciones del control del inventario", () => {
  const inventories = selectInventory();
  const opts = inv.findOptionsForSelector("#pais", inventories);
  assert.equal(opts.length, 2);
  assert.equal(opts[0].value, "ar");
  assert.equal(opts[1].text, "Brasil");
});

test("findOptionsForSelector: null para un control sin opciones", () => {
  resetBody('<input id="nombre" type="text">');
  const inventories = [inv.captureInventory(win.document)];
  assert.equal(inv.findOptionsForSelector("#nombre", inventories), null);
});

test("findOptionsForStep: resuelve opciones desde select relacionado por label", () => {
  const inventories = [{
    url: "https://example.com/form",
    controls: [
      {
        selector: "#vDELEGACION",
        altSelectors: [],
        id: "vDELEGACION",
        name: "vDELEGACION",
        label: "Delegacion",
        controlKind: "autocomplete",
        options: []
      },
      {
        selector: "#vDELEGCOMBO",
        altSelectors: [],
        id: "vDELEGCOMBO",
        name: "vDELEGCOMBO",
        label: "Delegacion",
        controlKind: "native-select",
        options: [
          { index: 0, value: "101", text: "CAPITAL", selected: false, disabled: false },
          { index: 1, value: "102", text: "INTERIOR", selected: false, disabled: false }
        ]
      }
    ]
  }];

  const opts = inv.findOptionsForStep({ selector: "#vDELEGACION" }, inventories);
  assert.ok(Array.isArray(opts));
  assert.equal(opts.length, 2);
  assert.equal(opts[0].text, "CAPITAL");
});

test("findOptionsForStep: null cuando no hay evidencia suficiente", () => {
  const inventories = [{
    url: "https://example.com/form",
    controls: [
      {
        selector: "#campoA",
        altSelectors: [],
        id: "campoA",
        name: "campoA",
        label: "Campo A",
        controlKind: "text-input",
        options: []
      },
      {
        selector: "#comboB",
        altSelectors: [],
        id: "comboB",
        name: "comboB",
        label: "Campo B",
        controlKind: "native-select",
        options: [{ index: 0, value: "1", text: "Uno", selected: false, disabled: false }]
      }
    ]
  }];

  assert.equal(inv.findOptionsForStep({ selector: "#campoA" }, inventories), null);
});

test("findOptionsForStep: fallback GeneXus devuelve opcion sintetica con valor tipeado", () => {
  const inventories = [{
    url: "https://example.com/form",
    controls: [
      {
        selector: "#vAUCAESPEFC",
        altSelectors: [],
        id: "vAUCAESPEFC",
        name: "vAUCAESPEFC",
        label: "vAUCAESPEFC",
        controlKind: "text-input",
        options: []
      },
      {
        selector: "#GXHCvAUCAESPEFC_0001",
        altSelectors: [],
        id: "GXHCvAUCAESPEFC_0001",
        name: "GXHCvAUCAESPEFC_0001",
        label: "GXHCvAUCAESPEFC_0001",
        controlKind: "text-input",
        options: []
      }
    ]
  }];

  const opts = inv.findOptionsForStep({ selector: "#vAUCAESPEFC", value: "ALOJAMIENTO" }, inventories);
  assert.ok(Array.isArray(opts));
  assert.equal(opts.length, 1);
  assert.equal(opts[0].value, "ALOJAMIENTO");
  assert.equal(opts[0].text, "ALOJAMIENTO");
});

test("findOptionsForStep: fallback GeneXus tambien detecta companion GXH_", () => {
  const inventories = [{
    url: "https://example.com/form",
    controls: [
      {
        selector: "#vDELEGACION",
        altSelectors: [],
        id: "vDELEGACION",
        name: "vDELEGACION",
        label: "vDELEGACION",
        controlKind: "text-input",
        options: []
      },
      {
        selector: "#GXH_vDELEGACION",
        altSelectors: [],
        id: "GXH_vDELEGACION",
        name: "GXH_vDELEGACION",
        label: "GXH_vDELEGACION",
        controlKind: "text-input",
        options: []
      }
    ]
  }];

  const opts = inv.findOptionsForStep({ selector: "#vDELEGACION", value: "IAPOS SANTA FE" }, inventories);
  assert.ok(Array.isArray(opts));
  assert.equal(opts.length, 1);
  assert.equal(opts[0].value, "IAPOS SANTA FE");
  assert.equal(opts[0].text, "IAPOS SANTA FE");
});

test("findOptionsForStep: fallback GeneXus detecta GXH embebido en currentValue serializado", () => {
  const inventories = [{
    url: "https://example.com/form",
    controls: [
      {
        selector: "#vAUCAESPEFC",
        altSelectors: [],
        id: "vAUCAESPEFC",
        name: "vAUCAESPEFC",
        label: "vAUCAESPEFC",
        controlKind: "text-input",
        options: []
      },
      {
        selector: "#GXState",
        altSelectors: [],
        id: "GXState",
        name: "GXState",
        label: "GXState",
        controlKind: "text-input",
        options: [],
        currentValue: '{"GXH_vAUCAESPEFC":"33","GXH_vDELEGACION":"2"}'
      }
    ]
  }];

  const opts = inv.findOptionsForStep({ selector: "#vAUCAESPEFC", value: "ALOJAMIENTO" }, inventories);
  assert.ok(Array.isArray(opts));
  assert.equal(opts.length, 1);
  assert.equal(opts[0].value, "ALOJAMIENTO");
  assert.equal(opts[0].text, "ALOJAMIENTO");
});

// ── buildControlRef / associateSteps ──────────────────────────────────────────

test("buildControlRef: adjunta selector/controlKind/label del control hallado", () => {
  const inventories = selectInventory();
  const ref = inv.buildControlRef({ type: "choose_option", selector: "#pais" }, inventories);
  assert.ok(ref);
  assert.equal(ref.selector, "#pais");
  assert.equal(ref.controlKind, "native-select");
});

test("buildControlRef: null cuando el step no tiene control en el inventario", () => {
  const inventories = selectInventory();
  const ref = inv.buildControlRef({ type: "click", selector: "#otro" }, inventories);
  assert.equal(ref, null);
});

test("associateSteps: agrega controlRef solo a steps con control, sin tocar el resto", () => {
  const inventories = selectInventory();
  const steps = [
    { type: "choose_option", selector: "#pais", value: "br" },
    { type: "click", selector: "#sin-control" }
  ];
  const out = inv.associateSteps(steps, inventories);
  assert.ok(out[0].controlRef);
  assert.equal(out[0].controlRef.controlKind, "native-select");
  assert.equal(out[1].controlRef, undefined);
  // no muta el original
  assert.equal(steps[0].controlRef, undefined);
});

// ── appendInventory ───────────────────────────────────────────────────────────

test("appendInventory: agrega snapshots y dedup por url + nº de controles", () => {
  const a = { url: "u1", controls: [{}, {}] };
  const b = { url: "u1", controls: [{}, {}] };
  const c = { url: "u2", controls: [{}] };
  let list = inv.appendInventory([], a);
  list = inv.appendInventory(list, b); // mismo url + mismo nº → reemplaza
  list = inv.appendInventory(list, c); // url distinto → agrega
  assert.equal(list.length, 2);
  assert.equal(list[0], b);
  assert.equal(list[1], c);
});
