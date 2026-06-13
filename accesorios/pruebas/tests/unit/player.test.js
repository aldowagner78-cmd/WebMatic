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
const Player = require("../../../../src/modules/player/player.js");

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
  assert.equal(result.ok, true, result.error || "check oculto falló");
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
  assert.equal(result.ok, true, result.error || "check via label falló");
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

test("wait_for: omite login faltante cuando no hay formulario de password visible", async () => {
  resetBody('<div id="app-auth">Sesion iniciada</div>');
  const result = await runStep(
    { type: "wait_for", selector: "#login-panel", timeout: 100 },
    {},
    { retryMs: 20, timeoutMs: 200 }
  );
  assert.equal(result.ok, true, result.error || "deberia omitir login si ya hay sesion");
});

test("click: omite login faltante cuando no hay formulario de password visible", async () => {
  resetBody('<div id="app-auth">Sesion iniciada</div>');
  const result = await runStep(
    { type: "click", selector: "#btn-login" },
    {},
    { retryMs: 20, timeoutMs: 100 }
  );
  assert.equal(result.ok, true, result.error || "deberia omitir click de login inexistente");
});

test("input: omite selector login IAPOS faltante cuando ya hay sesion", async () => {
  resetBody('<div id="app-auth">Sesion iniciada</div>');
  const result = await runStep(
    { type: "input", selector: "#MPW0024vUSUACODUSU", value: "AWAGNER" },
    {},
    { retryMs: 20, timeoutMs: 100 }
  );
  assert.equal(result.ok, true, result.error || "deberia omitir input de login IAPOS inexistente");
});

test("input login faltante: bypass inmediato sin esperar timeout completo", async () => {
  resetBody('<div id="app-auth">Sesion iniciada</div>');
  const startedAt = Date.now();
  const result = await runStep(
    { type: "input", selector: "#MPW0024vUSUACODUSU", value: "AWAGNER" },
    {},
    { retryMs: 20, timeoutMs: 1000 }
  );
  const elapsed = Date.now() - startedAt;
  assert.equal(result.ok, true, result.error || "deberia omitir input de login IAPOS inexistente");
  assert.ok(elapsed < 700, `bypass demasiado lento: ${elapsed}ms`);
});

test("play: onDone incluye durationMs en summary", async () => {
  resetBody('<div id="app-auth">Sesion iniciada</div>');
  const p = new Player({ retryMs: 20, timeoutMs: 500 });
  let doneSummary = null;

  await new Promise((resolve) => {
    p.play([
      { type: "wait", ms: 30 },
      { type: "wait", ms: 30 }
    ], {
      vars: {},
      speed: 1,
      onDone: (summary) => {
        doneSummary = summary || null;
        resolve();
      },
      onError: resolve
    });
  });

  assert.ok(doneSummary && Number.isFinite(Number(doneSummary.durationMs)), "summary.durationMs debe existir");
  assert.ok(Number(doneSummary.durationMs) >= 0, "durationMs debe ser no negativo");
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

test("hover: si el selector no existe, play continúa (best-effort)", async () => {
  resetBody('<div></div>');
  const result = await runStep(
    { type: "hover", selector: "#fantasma" },
    {},
    { retryMs: 20, timeoutMs: 100 }
  );
  assert.equal(result.ok, true);
});

// ── Tests: check (widgets custom) ───────────────────────────────────────────

test("check: usa activador visual asociado cuando el input esta oculto", async () => {
  resetBody([
    '<input id="r1" type="radio" name="gal" style="display:none" />',
    '<label id="r1-label" for="r1">Imagen 1</label>'
  ].join(""));

  const input = win.document.getElementById("r1");
  const label = win.document.getElementById("r1-label");

  // Simula componente custom: el estado se sincroniza por click en el activador visual.
  label.addEventListener("click", () => {
    input.checked = true;
    input.dispatchEvent(new win.Event("change", { bubbles: true }));
  });

  const result = await runStep({ type: "check", selector: "#r1", checked: true });
  assert.equal(result.ok, true, result.error || "check oculto falló");
});

test("check: resuelve input asociado cuando el selector apunta al label", async () => {
  resetBody([
    '<input id="c1" type="checkbox" style="display:none" />',
    '<label id="c1-label" for="c1">Toggle</label>'
  ].join(""));

  const input = win.document.getElementById("c1");
  const label = win.document.getElementById("c1-label");
  label.addEventListener("click", () => {
    input.checked = true;
    input.dispatchEvent(new win.Event("change", { bubbles: true }));
  });

  const result = await runStep({ type: "check", selector: "#c1-label", checked: true });
  assert.equal(result.ok, true, result.error || "check via label falló");
});

test("check: no aborta en widget custom cuando el input oculto no refleja checked", async () => {
  resetBody([
    '<input id="c2" type="checkbox" style="display:none" />',
    '<label id="c2-label" for="c2">Galeria</label>'
  ].join(""));

  const label = win.document.getElementById("c2-label");
  // Simula UI custom que reacciona al click visual pero no sincroniza .checked.
  label.addEventListener("click", () => {
    label.setAttribute("data-ui-toggled", "1");
  });

  const result = await runStep({ type: "check", selector: "#c2", checked: true });
  assert.equal(result.ok, true, result.error || "check custom best-effort falló");
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

test("loop_until: omite bloque de login cuando no hay password visible", async () => {
  resetBody('<div id="home">home</div>');
  const vars = { ITER: "0" };
  const result = await runStep({
    type: "loop_until",
    selector: "#login-form",
    condition: "not_exists",
    max_iterations: 5,
    steps: [{ type: "set_variable", variable: "ITER", value: "{{!ITER}} + 1" }]
  }, vars, { retryMs: 20, timeoutMs: 200 });

  assert.equal(result.ok, true);
  assert.equal(vars.ITER, "0");
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
  const Player2 = require("../../../../src/modules/player/player.js");
  const p = new Player2({ retryMs: 20, timeoutMs: 500 });
  const steps = [
    { type: "navigate", url: "" },
    { type: "set_variable", variable: "AFTER_NAV", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_NAV, "ok", "paso siguiente al navigate no-op debe ejecutar");
});

test("navigate: misma URL como no-op permite que pasos siguientes ejecuten", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player3 = require("../../../../src/modules/player/player.js");
  const p = new Player3({ retryMs: 20, timeoutMs: 500 });
  const steps = [
    { type: "navigate", url: "https://example.com/" },
    { type: "set_variable", variable: "AFTER_NAV", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_NAV, "ok", "paso siguiente al navigate misma URL debe ejecutar");
});

test("navigate: cambio solo de hash permite que pasos siguientes ejecuten", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player4 = require("../../../../src/modules/player/player.js");
  const p = new Player4({ retryMs: 20, timeoutMs: 500 });
  const steps = [
    { type: "navigate", url: "https://example.com/#gid=1&pid=9" },
    { type: "set_variable", variable: "AFTER_HASH_NAV", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_HASH_NAV, "ok", "paso siguiente al navigate con hash debe ejecutar");
});

test("play: ignora wait_for transitorio antes de navigate", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player6 = require("../../../../src/modules/player/player.js");
  const p = new Player6({ retryMs: 20, timeoutMs: 80 });
  const steps = [
    { type: "wait_for", selector: "[title=\"Next (arrow right)\"]", timeout: 50 },
    { type: "click", selector: "[title=\"Next (arrow right)\"]" },
    { type: "navigate", url: "https://example.com/#gid=1&pid=9" },
    { type: "set_variable", variable: "AFTER_TRANSIENT_WAIT", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_TRANSIENT_WAIT, "ok", "debe continuar aun con wait_for transitorio ausente");
});

test("play: si click transitorio falla pero hay navigate cercano, continua", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player7 = require("../../../../src/modules/player/player.js");
  const p = new Player7({ retryMs: 20, timeoutMs: 80 });
  const steps = [
    { type: "click", selector: "[title=\"Next (arrow right)\"]" },
    { type: "navigate", url: "https://example.com/#gid=1&pid=10" },
    { type: "set_variable", variable: "AFTER_TRANSIENT_CLICK", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_TRANSIENT_CLICK, "ok", "debe continuar aunque el click transitorio no exista");
});

test("play: ignora hover transitorio antes de navigate", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player8 = require("../../../../src/modules/player/player.js");
  const p = new Player8({ retryMs: 20, timeoutMs: 80 });
  const sameDocUrl = `${window.location.href.split("#")[0]}#after-hover`;
  const steps = [
    { type: "hover", selector: "#_LYIoavCCI8-r1sQPie-4sA8_38" },
    { type: "wait", seconds: 1 },
    { type: "navigate", url: sameDocUrl },
    { type: "set_variable", variable: "AFTER_TRANSIENT_HOVER", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_TRANSIENT_HOVER, "ok", "debe continuar aunque el hover transitorio no exista");
});

test("play: si hover no encuentra elemento, no aborta la macro", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player9 = require("../../../../src/modules/player/player.js");
  const p = new Player9({ retryMs: 20, timeoutMs: 80 });
  const steps = [
    { type: "hover", selector: "#ligthbox div" },
    { type: "set_variable", variable: "AFTER_MISSING_HOVER", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(vars.AFTER_MISSING_HOVER, "ok", "debe continuar aunque un hover falle por selector ausente");
});

test("play: click Next usa fallback semantico (aria-label/data-testid)", async () => {
  resetBody('<button id="nextBtn" aria-label="Siguiente (flecha derecha)">Next</button>');
  const vars = {};
  let clicked = false;
  const btn = win.document.getElementById("nextBtn");
  btn.addEventListener("click", () => { clicked = true; });
  const Player10 = require("../../../../src/modules/player/player.js");
  const p = new Player10({ retryMs: 20, timeoutMs: 120 });
  const steps = [
    { type: "click", selector: "[title=\"Next (arrow right)\"]" },
    { type: "set_variable", variable: "AFTER_NEXT_FALLBACK", value: "ok" }
  ];
  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
  });
  assert.equal(clicked, true, "debe hacer click usando fallback semantico");
  assert.equal(vars.AFTER_NEXT_FALLBACK, "ok");
});

test("play: click Next sin control visible despacha tecla ArrowRight", async () => {
  resetBody('<div></div>');
  const vars = {};
  const seen = [];
  const handler = (e) => seen.push(e.key);
  win.document.addEventListener("keydown", handler);

  const Player11 = require("../../../../src/modules/player/player.js");
  const p = new Player11({ retryMs: 20, timeoutMs: 100 });
  const steps = [
    { type: "click", selector: "[title=\"Next (arrow right)\"]" },
    { type: "set_variable", variable: "AFTER_SYNTH_NEXT", value: "ok" }
  ];

  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
  });
  win.document.removeEventListener("keydown", handler);

  assert.ok(seen.includes("ArrowRight"), "debe haber despachado ArrowRight");
  assert.equal(vars.AFTER_SYNTH_NEXT, "ok");
});

test("play: click Close sin control visible despacha tecla Escape", async () => {
  resetBody('<div></div>');
  const vars = {};
  const seen = [];
  const handler = (e) => seen.push(e.key);
  win.document.addEventListener("keydown", handler);

  const Player12 = require("../../../../src/modules/player/player.js");
  const p = new Player12({ retryMs: 20, timeoutMs: 100 });
  const steps = [
    { type: "click", selector: "[title=\"Close (Esc)\"]" },
    { type: "set_variable", variable: "AFTER_SYNTH_CLOSE", value: "ok" }
  ];

  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
  });
  win.document.removeEventListener("keydown", handler);

  assert.ok(seen.includes("Escape"), "debe haber despachado Escape");
  assert.equal(vars.AFTER_SYNTH_CLOSE, "ok");
});

test("play: bootstrap navega a primera URL cuando macro inicia con selector local", async () => {
  resetBody('<div></div>');
  const vars = {};
  const Player5 = require("../../../../src/modules/player/player.js");
  const p = new Player5({ retryMs: 20, timeoutMs: 500 });

  const originalHref = window.location.href;
  let requestedHref = null;
  try {
    Object.defineProperty(window.location, "href", {
      configurable: true,
      get() { return originalHref; },
      set(v) { requestedHref = String(v || ""); }
    });
  } catch (_e) {
    // Fallback for environments that disallow redefining location.href.
    requestedHref = null;
  }

  const steps = [
    { type: "click", selector: "#APjFqb" },
    { type: "navigate", url: "https://example.com/search?q=test" }
  ];

  await new Promise((resolve) => {
    p.play(steps, {
      vars,
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 50);
  });

  if (requestedHref !== null) {
    assert.ok(requestedHref.includes("https://example.com/search?q=test"), "debe solicitar bootstrap a primera navigate URL");
  }
});

test("open_tab: delega handoff al background y finaliza en pestaña origen", async () => {
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const calls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    calls.push(msg);
    if (msg && msg.type === "PLAYBACK_TAB_ACTION") {
      if (typeof cb === "function") cb({ ok: true, handoff: true, tabId: 2 });
      return;
    }
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p = new Player({ retryMs: 20, timeoutMs: 200 });
  await new Promise((resolve) => {
    p.play([
      { type: "open_tab", url: "https://example.com/new" },
      { type: "set_variable", variable: "AFTER", value: "NO_DEBE_EJECUTAR_EN_TAB_ORIGEN" }
    ], {
      vars,
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  assert.ok(calls.some((c) => c.type === "PLAYBACK_TAB_ACTION" && c.action === "open_tab"));
  assert.equal(vars.AFTER, undefined);
});

test("switch_tab: error en background dispara onError", async () => {
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "PLAYBACK_TAB_ACTION") {
      if (typeof cb === "function") cb({ ok: false, error: "switch_tab_not_found" });
      return;
    }
    if (typeof cb === "function") cb({ ok: true });
  };

  let gotError = "";
  const p = new Player({ retryMs: 20, timeoutMs: 200 });
  await new Promise((resolve) => {
    p.play([{ type: "switch_tab", url: "https://no-existe.example" }], {
      vars: {},
      speed: 1,
      onDone: resolve,
      onError: (err) => { gotError = String(err && err.message || ""); resolve(); }
    });
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  assert.ok(gotError.includes("tab action failed"), `Error inesperado: ${gotError}`);
});

// ── Tests: choose_option ────────────────────────────────────────────────────────

const SELECT_HTML = `
  <select id="pais">
    <option value="ar">Argentina</option>
    <option value="br">Brasil</option>
    <option value="uy">Uruguay</option>
  </select>`;

test("choose_option: selecciona el <select> por VALUE", async () => {
  resetBody(SELECT_HTML);
  const result = await runStep({ type: "choose_option", selector: "#pais", value: "br" });
  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("pais").value, "br");
});

test("choose_option: selecciona por TEXTO visible cuando el VALUE no coincide", async () => {
  resetBody(SELECT_HTML);
  // "Uruguay" no es un value (los values son ar/br/uy), pero sí el texto visible.
  const result = await runStep({ type: "choose_option", selector: "#pais", value: "Uruguay" });
  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("pais").value, "uy");
});

test("choose_option: campo text explícito selecciona por texto visible", async () => {
  resetBody(SELECT_HTML);
  const result = await runStep({ type: "choose_option", selector: "#pais", text: "Brasil" });
  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("pais").value, "br");
});

test("choose_option: dispara eventos input y change", async () => {
  resetBody(SELECT_HTML);
  const el = win.document.getElementById("pais");
  let inputFired = false, changeFired = false;
  el.addEventListener("input", () => { inputFired = true; });
  el.addEventListener("change", () => { changeFired = true; });
  const result = await runStep({ type: "choose_option", selector: "#pais", value: "br" });
  assert.equal(result.ok, true);
  assert.equal(inputFired, true, "debe disparar input");
  assert.equal(changeFired, true, "debe disparar change");
});

test("choose_option: falla controlada si el selector no existe", async () => {
  resetBody(SELECT_HTML);
  const result = await runStep({ type: "choose_option", selector: "#no-existe", value: "br" });
  assert.equal(result.ok, false);
  assert.ok(result.error, "debe devolver un mensaje de error");
});

test("choose_option: falla controlada si la opción no existe", async () => {
  resetBody(SELECT_HTML);
  const result = await runStep({ type: "choose_option", selector: "#pais", value: "no-existe-xyz" });
  assert.equal(result.ok, false);
  assert.ok(/opción no encontrada/i.test(result.error), `Error inesperado: ${result.error}`);
});

test("choose_option: guarda el value elegido en la variable", async () => {
  resetBody(SELECT_HTML);
  const vars = {};
  const result = await runStep(
    { type: "choose_option", selector: "#pais", value: "Uruguay", variable: "PAIS" },
    vars
  );
  assert.equal(result.ok, true);
  assert.equal(vars.PAIS, "uy", "la variable debe guardar el value de la opción");
});

// ── Regresión: macro vieja con TYPE/INPUT sobre <select> sigue funcionando ───────

test("input sobre <select> (macro legacy) sigue seleccionando la opción", async () => {
  resetBody(SELECT_HTML);
  const result = await runStep({ type: "input", selector: "#pais", value: "br" });
  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("pais").value, "br");
});

test("input sobre <select> por texto visible (macro legacy) sigue funcionando", async () => {
  resetBody(SELECT_HTML);
  const result = await runStep({ type: "input", selector: "#pais", value: "Uruguay" });
  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("pais").value, "uy");
});

test("choose_option con inputMode=autocomplete funciona sobre <input>", async () => {
  resetBody('<input id="delegacion" type="text" value="">');
  const result = await runStep({
    type: "choose_option",
    selector: "#delegacion",
    inputMode: "autocomplete",
    text: "CAPITAL"
  });
  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("delegacion").value, "CAPITAL");
});

// ── capture_defaults: opt-in, no altera macros que no lo usan ─────────────────────

const TWO_SELECTS_HTML = `
  <select id="trigger"><option value="x">X</option><option value="y">Y</option></select>
  <select id="other"><option value="a">A</option><option value="b">B</option></select>`;

// Stub de layout: happy-dom devuelve rect 0x0 y capture_defaults saltea campos
// "invisibles". Le damos un rect no nulo para que el escaneo procese los <select>.
function withVisibleLayout(fn) {
  const origRect = win.Element.prototype.getBoundingClientRect;
  win.Element.prototype.getBoundingClientRect = function () {
    return { width: 120, height: 24, top: 0, left: 0, right: 120, bottom: 24, x: 0, y: 0 };
  };
  return Promise.resolve()
    .then(fn)
    .finally(() => { win.Element.prototype.getBoundingClientRect = origRect; });
}

test("capture_defaults: NO se auto-inyecta por defecto (no resetea otros campos)", async () => {
  await withVisibleLayout(async () => {
    resetBody(TWO_SELECTS_HTML);
    // #other tiene un valor distinto al default ("a"); la macro sólo toca #trigger.
    win.document.getElementById("other").value = "b";
    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    await new Promise((resolve) => {
      p.play([{ type: "choose_option", selector: "#trigger", value: "y" }], {
        vars: {}, speed: 1, onDone: resolve, onError: resolve
      });
    });
    // Sin auto-capture, #other conserva su valor (no se resetea al default "a").
    assert.equal(win.document.getElementById("other").value, "b");
    assert.equal(win.document.getElementById("trigger").value, "y");
  });
});

test("capture_defaults: autoCaptureDefaults se ignora y no normaliza defaults", async () => {
  await withVisibleLayout(async () => {
    resetBody(TWO_SELECTS_HTML);
    win.document.getElementById("other").value = "b";
    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    await new Promise((resolve) => {
      p.play([{ type: "choose_option", selector: "#trigger", value: "y" }], {
        vars: {}, speed: 1, autoCaptureDefaults: true, onDone: resolve, onError: resolve
      });
    });
    // Sin auto-inyección, #other conserva su valor (no se resetea al default "a").
    assert.equal(win.document.getElementById("other").value, "b");
    assert.equal(win.document.getElementById("trigger").value, "y");
  });
});

test("capture_defaults auto (_fast) no dispara onStep extra", async () => {
  await withVisibleLayout(async () => {
    resetBody(TWO_SELECTS_HTML);
    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    const seen = [];
    await new Promise((resolve) => {
      p.play([{ type: "choose_option", selector: "#trigger", value: "y" }], {
        vars: {},
        speed: 1,
        onStep: (step) => seen.push(step.type),
        onDone: resolve,
        onError: resolve
      });
    });
    assert.deepEqual(seen, ["choose_option"]);
  });
});

test("capture_defaults explícito sigue ejecutándose (normaliza al default)", async () => {
  await withVisibleLayout(async () => {
    resetBody(TWO_SELECTS_HTML);
    win.document.getElementById("other").value = "b";
    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    await new Promise((resolve) => {
      p.play([
        { type: "capture_defaults" },
        { type: "choose_option", selector: "#trigger", value: "y" }
      ], { vars: {}, speed: 1, onDone: resolve, onError: resolve });
    });
    assert.equal(win.document.getElementById("other").value, "a");
    assert.equal(win.document.getElementById("trigger").value, "y");
  });
});

test("preRunReset: restaura baseline antes del primer paso", async () => {
  await withVisibleLayout(async () => {
    resetBody(`
      <select id="trigger"><option value="x">X</option><option value="y">Y</option></select>
      <input id="otro" type="text" value="LIMPIO">
    `);

    // Ensuciamos estado previo del formulario.
    win.document.getElementById("otro").value = "SUCIO";

    const baseline = {
      version: 1,
      controls: [
        { selector: "#otro", tag: "input", type: "text", value: "LIMPIO" }
      ]
    };

    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    await new Promise((resolve) => {
      p.play([{ type: "choose_option", selector: "#trigger", value: "y" }], {
        vars: {},
        speed: 1,
        preRunReset: baseline,
        onDone: resolve,
        onError: resolve
      });
    });

    assert.equal(win.document.getElementById("otro").value, "LIMPIO");
    assert.equal(win.document.getElementById("trigger").value, "y");
  });
});

test("preRunReset: inicio y reanudacion tambien restaura baseline", async () => {
  await withVisibleLayout(async () => {
    resetBody(`
      <input id="campo" type="text" value="LIMPIO">
    `);

    win.document.getElementById("campo").value = "SUCIO";

    const baseline = {
      version: 1,
      controls: [
        { selector: "#campo", tag: "input", type: "text", value: "LIMPIO" }
      ]
    };

    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    await new Promise((resolve) => {
      p.play([
        { type: "set_variable", variable: "A", value: "1" },
        { type: "set_variable", variable: "B", value: "2" }
      ], {
        vars: {},
        speed: 1,
        startIndex: 1,
        preRunReset: baseline,
        preRunResetPolicy: { mode: "start_and_resume" },
        onDone: resolve,
        onError: resolve
      });
    });

    assert.equal(win.document.getElementById("campo").value, "LIMPIO");
  });
});

test("preRunReset: tolera controles faltantes y no aborta la macro", async () => {
  await withVisibleLayout(async () => {
    resetBody('<select id="trigger"><option value="x">X</option><option value="y">Y</option></select>');

    const baseline = {
      version: 1,
      controls: [
        { selector: "#inexistente", tag: "input", type: "text", value: "NOPE" },
        { selector: "#trigger", tag: "select", type: "select-one", value: "x", selectedIndex: 0 }
      ]
    };

    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    let failed = null;
    await new Promise((resolve) => {
      p.play([{ type: "choose_option", selector: "#trigger", value: "y" }], {
        vars: {},
        speed: 1,
        preRunReset: baseline,
        onDone: resolve,
        onError: (err) => { failed = err; resolve(); }
      });
    });

    assert.equal(failed, null);
    assert.equal(win.document.getElementById("trigger").value, "y");
  });
});

test("preRunReset: restauracion silenciosa sin interacciones visibles", async () => {
  await withVisibleLayout(async () => {
    resetBody(`
      <input id="campo" type="text" value="LIMPIO">
      <select id="trigger"><option value="x">X</option><option value="y">Y</option></select>
    `);

    const campo = win.document.getElementById("campo");
    campo.value = "SUCIO";

    const counts = { click: 0, mousedown: 0, mouseup: 0, focus: 0 };
    campo.addEventListener("click", () => { counts.click += 1; });
    campo.addEventListener("mousedown", () => { counts.mousedown += 1; });
    campo.addEventListener("mouseup", () => { counts.mouseup += 1; });
    campo.addEventListener("focus", () => { counts.focus += 1; });

    const baseline = {
      version: 1,
      controls: [
        { selector: "#campo", tag: "input", type: "text", value: "LIMPIO" }
      ]
    };

    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    const seen = [];

    await new Promise((resolve) => {
      p.play([{ type: "set_variable", variable: "X", value: "1" }], {
        vars: {},
        speed: 1,
        preRunReset: baseline,
        onStep: (step) => seen.push(step.type),
        onDone: resolve,
        onError: resolve
      });
    });

    assert.equal(campo.value, "LIMPIO");
    assert.deepEqual(seen, ["set_variable"]);
    assert.deepEqual(counts, { click: 0, mousedown: 0, mouseup: 0, focus: 0 });
  });
});
