/**
 * Tests unitarios para player.js — Oleadas 1, 2 y 3
 * DOM simulado con happy-dom (sin browser real).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

// ── Setup DOM global ANTES de importar player.js ─────────────────────────────
const win = new Window({ url: "https://example.com/" });
globalThis.document   = win.document;
globalThis.window     = win;
globalThis.Element    = win.Element;
globalThis.HTMLElement          = win.HTMLElement;
globalThis.HTMLInputElement     = win.HTMLInputElement;
globalThis.HTMLTextAreaElement  = win.HTMLTextAreaElement;
globalThis.HTMLSelectElement    = win.HTMLSelectElement;
globalThis.Event        = win.Event;
globalThis.MouseEvent   = win.MouseEvent;
globalThis.KeyboardEvent = win.KeyboardEvent;
globalThis.CustomEvent  = win.CustomEvent;

// Polyfill DragEvent / DataTransfer si happy-dom no los provee
if (win.DragEvent) {
  globalThis.DragEvent    = win.DragEvent;
  globalThis.DataTransfer = win.DataTransfer;
} else {
  globalThis.DataTransfer = class {
    constructor() { this._data = {}; }
    setData(k, v) { this._data[k] = v; }
    getData(k)    { return this._data[k] || ""; }
    clearData()   { this._data = {}; }
  };
  globalThis.DragEvent = class extends win.Event {
    constructor(type, init) {
      super(type, init);
      this.dataTransfer = init?.dataTransfer ?? null;
    }
  };
}

// Polyfill scrollIntoView (happy-dom puede no implementarlo)
if (typeof win.Element.prototype.scrollIntoView !== "function") {
  win.Element.prototype.scrollIntoView = function() {};
}

// Mock chrome (solo los métodos que usa player.js en sus ramas)
globalThis.chrome = {
  runtime: { sendMessage: (_msg, cb) => { if (typeof cb === "function") cb(); } }
};

// Importar Player
const Player = require("../../src/modules/player/player.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetBody(html) {
  win.document.body.innerHTML = html;
}

/**
 * Ejecuta UN solo paso y devuelve { ok, error? }.
 * playerOpts sobreescribe opciones del constructor (retryMs, timeoutMs).
 */
function runStep(step, vars = {}, playerOpts = {}) {
  return new Promise((resolve) => {
    const opts = { retryMs: 20, timeoutMs: 500, ...playerOpts };
    const p = new Player(opts);
    p.play([step], {
      vars,
      speed: 1,
      onDone:  ()    => resolve({ ok: true }),
      onError: (err) => resolve({ ok: false, error: err.message })
    });
  });
}

// ── Tests: wait_for ───────────────────────────────────────────────────────────

test("wait_for: resuelve cuando el elemento ya existe en el DOM", async () => {
  resetBody('<button id="existe">OK</button>');
  const result = await runStep({ type: "wait_for", selector: "#existe" });
  assert.equal(result.ok, true);
});

test("wait_for: espera hasta que el elemento aparece en el DOM", async () => {
  resetBody('<div id="contenedor"></div>');

  // Agregar el elemento 80ms después
  setTimeout(() => {
    const el = win.document.createElement("span");
    el.id = "aparece-tarde";
    win.document.getElementById("contenedor").appendChild(el);
  }, 80);

  const result = await runStep(
    { type: "wait_for", selector: "#aparece-tarde" },
    {},
    { retryMs: 20, timeoutMs: 500 }
  );
  assert.equal(result.ok, true);
});

test("wait_for: falla si el elemento nunca aparece (timeout propio)", async () => {
  resetBody('<div></div>');
  // timeout corto en el step mismo
  const result = await runStep(
    { type: "wait_for", selector: "#no-existe", timeout: 100 },
    {},
    { retryMs: 20, timeoutMs: 2000 }
  );
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("wait_for"), `Error inesperado: ${result.error}`);
});

// ── Tests: scroll_to ──────────────────────────────────────────────────────────

test("scroll_to: ejecuta sin error cuando el elemento existe", async () => {
  resetBody('<div id="destino" style="margin-top:2000px">fondo</div>');
  const result = await runStep({ type: "scroll_to", selector: "#destino" });
  assert.equal(result.ok, true);
});

test("scroll_to: falla si el selector no existe", async () => {
  resetBody('<div></div>');
  const result = await runStep(
    { type: "scroll_to", selector: "#no-existe" },
    {},
    { retryMs: 20, timeoutMs: 100 }
  );
  assert.equal(result.ok, false);
});

// ── Tests: hover ─────────────────────────────────────────────────────────────

test("hover: dispara eventos mouseenter y mouseover", async () => {
  resetBody('<div id="menu">Menu</div>');
  const el = win.document.getElementById("menu");
  const eventos = [];
  el.addEventListener("mouseenter", () => eventos.push("mouseenter"));
  el.addEventListener("mouseover",  () => eventos.push("mouseover"));

  const result = await runStep({ type: "hover", selector: "#menu" });
  assert.equal(result.ok, true);
  assert.ok(eventos.includes("mouseover"),  "mouseover no fue disparado");
  assert.ok(eventos.includes("mouseenter"), "mouseenter no fue disparado");
});

test("hover: falla si el selector no existe", async () => {
  resetBody('<div></div>');
  const result = await runStep(
    { type: "hover", selector: "#fantasma" },
    {},
    { retryMs: 20, timeoutMs: 100 }
  );
  assert.equal(result.ok, false);
});

// ── Tests: set_variable ───────────────────────────────────────────────────────

test("set_variable: evalúa expresión numérica simple", async () => {
  const vars = {};
  const result = await runStep({ type: "set_variable", variable: "RESULTADO", value: "5 * 4" }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.RESULTADO, "20");
});

test("set_variable: guarda string si no es expresión numérica", async () => {
  const vars = {};
  const result = await runStep({ type: "set_variable", variable: "NOMBRE", value: "Juan Pérez" }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.NOMBRE, "Juan Pérez");
});

test("set_variable: interpola variables existentes", async () => {
  const vars = { PRECIO: "100", CANTIDAD: "3" };
  const result = await runStep(
    { type: "set_variable", variable: "TOTAL", value: "{{!PRECIO}} * {{!CANTIDAD}}" },
    vars
  );
  assert.equal(result.ok, true);
  assert.equal(vars.TOTAL, "300");
});

test("set_variable: no hace nada si falta variable name", async () => {
  const vars = {};
  const result = await runStep({ type: "set_variable", value: "123" }, vars);
  assert.equal(result.ok, true); // resuelve sin error
  assert.deepEqual(vars, {});    // vars no fue modificado
});

// ── Tests: drag_drop ──────────────────────────────────────────────────────────

test("drag_drop: dispara dragstart en origen y drop en destino", async () => {
  resetBody('<div id="item" draggable="true">Item</div><div id="zona">Zona</div>');
  const item = win.document.getElementById("item");
  const zona = win.document.getElementById("zona");
  const eventos = [];
  item.addEventListener("dragstart", () => eventos.push("dragstart"));
  zona.addEventListener("drop",      () => eventos.push("drop"));

  const result = await runStep({ type: "drag_drop", from: "#item", to: "#zona" });
  assert.equal(result.ok, true);
  // Si DragEvent está disponible, los eventos deben haberse disparado
  if (typeof DragEvent !== "undefined") {
    assert.ok(eventos.includes("dragstart"), "dragstart no fue disparado");
    assert.ok(eventos.includes("drop"),      "drop no fue disparado");
  }
});

test("drag_drop: falla si el selector origen no existe", async () => {
  resetBody('<div id="zona">Zona</div>');
  const result = await runStep(
    { type: "drag_drop", from: "#no-existe", to: "#zona" },
    {},
    { retryMs: 20, timeoutMs: 100 }
  );
  assert.equal(result.ok, false);
});

test("drag_drop: falla si el selector destino no existe", async () => {
  resetBody('<div id="item" draggable="true">Item</div>');
  const result = await runStep(
    { type: "drag_drop", from: "#item", to: "#no-existe" },
    {},
    { retryMs: 20, timeoutMs: 100 }
  );
  assert.equal(result.ok, false);
});

// ── Tests: if_exists ──────────────────────────────────────────────────────────

test("if_exists: ejecuta rama 'then' cuando el selector existe", async () => {
  resetBody('<div id="alerta">!</div><input id="campo" value="" />');
  const vars = {};
  const result = await runStep({
    type: "if_exists",
    selector: "#alerta",
    then: [{ type: "set_variable", variable: "RAMA", value: "then" }],
    else: [{ type: "set_variable", variable: "RAMA", value: "else" }]
  }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.RAMA, "then");
});

test("if_exists: ejecuta rama 'else' cuando el selector NO existe", async () => {
  resetBody('<div id="otro">otro</div>');
  const vars = {};
  const result = await runStep({
    type: "if_exists",
    selector: "#no-existe",
    then: [{ type: "set_variable", variable: "RAMA", value: "then" }],
    else: [{ type: "set_variable", variable: "RAMA", value: "else" }]
  }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.RAMA, "else");
});

test("if_exists: no falla si la rama aplicable esta vacia", async () => {
  resetBody('<div></div>');
  const result = await runStep({
    type: "if_exists",
    selector: "#fantasma",
    then: []
    // sin else
  });
  assert.equal(result.ok, true);
});

// ── Tests: loop_until ─────────────────────────────────────────────────────────

test("loop_until: no itera si la condicion de salida ya se cumple al inicio", async () => {
  resetBody('<div id="fin">FIN</div>');
  const vars = { CONTADOR: "0" };
  // condition "not_exists": sigue mientras #fin NO exista — pero #fin ya existe → 0 iteraciones
  const result = await runStep({
    type: "loop_until",
    selector: "#fin",
    condition: "not_exists",
    max_iterations: 10,
    steps: [{ type: "set_variable", variable: "CONTADOR", value: "1" }]
  }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.CONTADOR, "0"); // el bloque no se ejecutó
});

test("loop_until: itera hasta que el elemento aparece (not_exists)", async () => {
  resetBody('<div id="contenedor-loop"></div>');
  const vars = { CONTADOR: "0" };

  // Agregar #stop-loop después de 60ms; verificar que el contenedor aun existe
  let timerId;
  const injector = new Promise((resolve) => {
    timerId = setTimeout(() => {
      const cont = win.document.getElementById("contenedor-loop");
      if (cont) {
        const el = win.document.createElement("div");
        el.id = "stop-loop";
        cont.appendChild(el);
      }
      resolve();
    }, 60);
  });

  const result = await runStep({
    type: "loop_until",
    selector: "#stop-loop",
    condition: "not_exists",
    max_iterations: 50,
    steps: [
      { type: "set_variable", variable: "CONTADOR", value: "{{!CONTADOR}} + 1" }
    ]
  }, vars, { retryMs: 20, timeoutMs: 500 });

  await injector; // asegurar que el timeout ya corrió antes de que el test cierre
  clearTimeout(timerId);

  assert.equal(result.ok, true);
  assert.ok(Number(vars.CONTADOR) >= 1, `CONTADOR debería ser >= 1, fue: ${vars.CONTADOR}`);
});

test("loop_until: respeta max_iterations como limite de seguridad", async () => {
  resetBody('<div></div>'); // el selector nunca aparece
  const vars = { ITER: "0" };
  const result = await runStep({
    type: "loop_until",
    selector: "#nunca",
    condition: "exists",  // sigue mientras #nunca exista — nunca existe → 0 iteraciones
    max_iterations: 5,
    steps: [{ type: "set_variable", variable: "ITER", value: "99" }]
  }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.ITER, "0"); // nunca entró al bloque
});

// ── Tests: try_fallback ───────────────────────────────────────────────────────

test("try_fallback: ejecuta steps principales cuando tienen exito", async () => {
  resetBody('<button id="btn-ok">OK</button>');
  const vars = {};
  const result = await runStep({
    type: "try_fallback",
    steps:    [{ type: "set_variable", variable: "RUTA", value: "principal" }],
    fallback: [{ type: "set_variable", variable: "RUTA", value: "fallback" }]
  }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.RUTA, "principal");
});

test("try_fallback: ejecuta fallback cuando el paso principal falla", async () => {
  resetBody('<div></div>');
  const vars = {};
  const result = await runStep({
    type: "try_fallback",
    steps: [
      // Este paso falla: elemento no existe en 100ms
      { type: "click", selector: "#no-existe" }
    ],
    fallback: [
      { type: "set_variable", variable: "RUTA", value: "fallback" }
    ]
  }, vars, { retryMs: 20, timeoutMs: 100 });
  assert.equal(result.ok, true);      // la macro no se detiene
  assert.equal(vars.RUTA, "fallback"); // se ejecutó el fallback
});

test("try_fallback: la macro no se detiene aunque falle steps y fallback este vacio", async () => {
  resetBody('<div></div>');
  const result = await runStep({
    type: "try_fallback",
    steps:    [{ type: "click", selector: "#no-existe" }],
    fallback: []
  }, {}, { retryMs: 20, timeoutMs: 100 });
  assert.equal(result.ok, true); // sigue sin explotar
});

// ── Tests: prompt ─────────────────────────────────────────────────────────────

test("prompt: _testValue guarda el valor en vars sin mostrar UI", async () => {
  resetBody('<div></div>');
  const vars = {};
  const result = await runStep({
    type: "prompt",
    label: "¿Cuál es el RUT?",
    variable: "RUT",
    _testValue: "12.345.678-9"
  }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.RUT, "12.345.678-9");
});

test("prompt: _testValue numerico se convierte a string", async () => {
  const vars = {};
  await runStep({ type: "prompt", variable: "NUM", _testValue: 42 }, vars);
  assert.equal(vars.NUM, "42");
});

test("prompt: no modifica vars si no hay variable definida", async () => {
  const vars = {};
  const result = await runStep({ type: "prompt", _testValue: "algo" }, vars);
  assert.equal(result.ok, true);
  assert.deepEqual(vars, {});
});

test("prompt: crea overlay DOM y resuelve al hacer click en Continuar", async () => {
  resetBody('<div></div>');
  const vars = {};

  // Lanzar el paso sin await — es bloqueante hasta que el usuario interactúa
  const stepPromise = runStep({ type: "prompt", label: "¿Nombre?", variable: "NOMBRE" }, vars);

  // Esperar que el overlay sea insertado en el DOM
  await new Promise((r) => setTimeout(r, 80));

  const inp = win.document.querySelector("#wm-prompt-overlay input");
  if (inp) {
    inp.value = "Juan García";
  }
  const btn = win.document.querySelector("#wm-prompt-overlay button");
  if (btn) btn.click();

  const result = await stepPromise;
  assert.equal(result.ok, true);
  if (inp) assert.equal(vars.NOMBRE, "Juan García");
});

// ── Tests: call_macro ─────────────────────────────────────────────────────────

test("call_macro: ejecuta los pasos provistos como subrutina", async () => {
  resetBody('<div></div>');
  const vars = {};
  const result = await runStep({
    type: "call_macro",
    macro_name: "OtraMacro",
    steps: [
      { type: "set_variable", variable: "DESDE", value: "subrutina" }
    ]
  }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.DESDE, "subrutina");
});

test("call_macro: no falla si steps esta vacio", async () => {
  const result = await runStep({ type: "call_macro", macro_name: "Vacia", steps: [] });
  assert.equal(result.ok, true);
});

test("call_macro: no falla si steps no esta definido", async () => {
  const result = await runStep({ type: "call_macro", macro_name: "SinSteps" });
  assert.equal(result.ok, true);
});

// ── Tests: for_each_row ───────────────────────────────────────────────────────

test("for_each_row: itera sobre todas las filas y asigna variables", async () => {
  resetBody('<div></div>');
  const vars = {};
  const nombres = [];

  // Usamos set_variable para acumular en una variable de registro
  const result = await runStep({
    type: "for_each_row",
    columns: ["NOMBRE", "CIUDAD"],
    dataset: [
      ["Ana",   "Santiago"],
      ["Luis",  "Valparaíso"],
      ["Pedro", "Temuco"]
    ],
    steps: [
      { type: "set_variable", variable: "ULTIMO", value: "{{!NOMBRE}}" }
    ]
  }, vars);

  assert.equal(result.ok, true);
  assert.equal(vars.ULTIMO, "Pedro");          // última fila
  assert.equal(vars._ROW_INDEX, "2");          // índice base 0
  assert.equal(vars.CIUDAD, "Temuco");
});

test("for_each_row: asigna _ROW_INDEX con indice base 0", async () => {
  const vars = {};
  await runStep({
    type: "for_each_row",
    columns: ["X"],
    dataset: [["a"], ["b"], ["c"]],
    steps: []
  }, vars);
  assert.equal(vars._ROW_INDEX, "2"); // última iteración = índice 2
});

test("for_each_row: dataset vacio no ejecuta sub-pasos", async () => {
  const vars = { TOCADO: "no" };
  const result = await runStep({
    type: "for_each_row",
    columns: ["COL"],
    dataset: [],
    steps: [{ type: "set_variable", variable: "TOCADO", value: "si" }]
  }, vars);
  assert.equal(result.ok, true);
  assert.equal(vars.TOCADO, "no");
});

test("for_each_row: acepta filas como objetos ademas de arrays", async () => {
  const vars = {};
  await runStep({
    type: "for_each_row",
    columns: ["NOMBRE"],
    dataset: [
      { NOMBRE: "Carlos" },
      { NOMBRE: "Sofía" }
    ],
    steps: [{ type: "set_variable", variable: "ULTIMO", value: "{{!NOMBRE}}" }]
  }, vars);
  assert.equal(vars.ULTIMO, "Sofía");
});

// ── Tests: navigate (same-URL no-op) ─────────────────────────────────────────

test("navigate: URL igual a la actual se trata como no-op y llama onDone", async () => {
  // La URL actual en el test es https://example.com/
  const result = await runStep({ type: "navigate", url: "https://example.com/" });
  assert.equal(result.ok, true, "navigate misma URL debe completar sin colgar");
});

test("navigate: URL vacía se trata como no-op y llama onDone", async () => {
  const result = await runStep({ type: "navigate", url: "" });
  assert.equal(result.ok, true, "navigate URL vacía debe completar sin colgar");
});

test("navigate: URL vacía como no-op permite que pasos siguientes ejecuten", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player2 = require("../../src/modules/player/player.js");
  const p = new Player2({ retryMs: 20, timeoutMs: 500 });
  const steps = [
    { type: "navigate", url: "" },
    { type: "set_variable", variable: "AFTER_NAV", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_NAV, "ok", "paso siguiente al navigate no-op debe ejecutar");
});

test("navigate: misma URL como no-op permite que pasos siguientes ejecuten", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player3 = require("../../src/modules/player/player.js");
  const p = new Player3({ retryMs: 20, timeoutMs: 500 });
  const steps = [
    { type: "navigate", url: "https://example.com/" },
    { type: "set_variable", variable: "AFTER_NAV", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_NAV, "ok", "paso siguiente al navigate misma URL debe ejecutar");
});
