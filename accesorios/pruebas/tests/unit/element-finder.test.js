const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const finder = require("../../../../src/common/dom/element-finder.js");

function setup(html) {
  const win = new Window({ url: "https://example.test/" });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.Element = win.Element;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.HTMLInputElement = win.HTMLInputElement;
  globalThis.HTMLTextAreaElement = win.HTMLTextAreaElement;
  globalThis.HTMLSelectElement = win.HTMLSelectElement;
  win.document.body.innerHTML = html;
  return win.document;
}

test("element-finder: si dos elementos coinciden, elige el visible sobre el hidden", () => {
  const doc = setup(`
    <button class="save" hidden id="hidden-save">Guardar</button>
    <button class="save" id="visible-save">Guardar</button>
  `);

  const found = finder.findElement(".save", { document: doc, actionType: "click" });

  assert.equal(found.id, "visible-save");
});

test("element-finder: descarta candidato con ancestro aria-hidden cuando hay alternativa visible", () => {
  const doc = setup(`
    <div aria-hidden="true"><button class="next" id="hidden-next">Siguiente</button></div>
    <button class="next" id="visible-next">Siguiente</button>
  `);

  const found = finder.findElement(".next", { document: doc, actionType: "click" });

  assert.equal(found.id, "visible-next");
});

test("element-finder: para TYPE prefiere input editable sobre readonly", () => {
  const doc = setup(`
    <input class="email" id="readonly-email" readonly value="viejo">
    <input class="email" id="editable-email">
  `);

  const found = finder.findElement(".email", { document: doc, actionType: "input" });

  assert.equal(found.id, "editable-email");
});

test("element-finder: para CLICK prefiere boton enabled sobre disabled", () => {
  const doc = setup(`
    <button class="send" id="disabled-send" disabled>Enviar</button>
    <button class="send" id="enabled-send">Enviar</button>
  `);

  const found = finder.findElement(".send", { document: doc, actionType: "click" });

  assert.equal(found.id, "enabled-send");
});

test("element-finder: selector unico visible conserva comportamiento esperado", () => {
  const doc = setup('<button id="solo">Listo</button>');

  const found = finder.findElement("#solo", { document: doc, actionType: "click" });

  assert.equal(found.id, "solo");
});

test("element-finder: fallbackSelectors conserva altSelectors cuando el primario no existe", () => {
  const doc = setup('<input id="mat-input-8" placeholder="Buscar Nro. de Expediente:">');

  const found = finder.findElement("#mat-input-3", {
    document: doc,
    actionType: "input",
    fallbackSelectors: ['input[placeholder="Buscar Nro. de Expediente:"]']
  });

  assert.equal(found.id, "mat-input-8");
});

test("element-finder: dos inputs visibles con mismo selector elige por placeholder", () => {
  const doc = setup(`
    <input class="field" id="first" placeholder="Nombre">
    <input class="field" id="second" placeholder="Email">
  `);

  const found = finder.findElement(".field", {
    document: doc,
    actionType: "input",
    controlRef: { placeholder: "Email", controlKind: "text-input" }
  });

  assert.equal(found.id, "second");
});

test("element-finder: dos botones visibles elige por texto y role exactos", () => {
  const doc = setup(`
    <button class="action" role="button" id="cancel">Cancelar</button>
    <button class="action" role="button" id="save">Guardar</button>
  `);

  const found = finder.findElement(".action", {
    document: doc,
    actionType: "click",
    intent: { text: "Guardar", role: "button", controlKind: "button" }
  });

  assert.equal(found.id, "save");
});

test("element-finder: readonly vs editable con misma intencion elige editable", () => {
  const doc = setup(`
    <input class="email" id="readonly-email" placeholder="Email" readonly>
    <input class="email" id="editable-email" placeholder="Email">
  `);

  const found = finder.findElement(".email", {
    document: doc,
    actionType: "input",
    controlRef: { placeholder: "Email", controlKind: "text-input" }
  });

  assert.equal(found.id, "editable-email");
});

test("element-finder: caso legacy sin alternativa devuelve el unico candidato aunque no sea accionable", () => {
  const doc = setup('<button id="legacy-hidden" hidden>Viejo</button>');

  const found = finder.findElement("#legacy-hidden", { document: doc, actionType: "click" });
  const best = finder.findBestElement("#legacy-hidden", { document: doc, actionType: "click" });

  assert.equal(found.id, "legacy-hidden");
  assert.equal(best.candidates[0].visible, false);
});
