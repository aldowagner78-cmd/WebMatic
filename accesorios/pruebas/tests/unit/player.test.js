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

function runSteps(steps, vars = {}, playerOpts = {}) {
  return new Promise((resolve) => {
    const opts = { retryMs: 20, timeoutMs: 500, ...playerOpts };
    const p = new Player(opts);
    p.play(steps, {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone:  ()    => resolve({ ok: true }),
      onError: (err) => resolve({ ok: false, error: err.message })
    });
  });
}

function placeOutsideViewport(el) {
  el.getBoundingClientRect = () => ({
    left: 0,
    top: 1200,
    right: 100,
    bottom: 1240,
    width: 100,
    height: 40
  });
}

function placeInsideViewport(el) {
  el.getBoundingClientRect = () => ({
    left: 460,
    top: 340,
    right: 560,
    bottom: 380,
    width: 100,
    height: 40
  });
}

function placeVisibleNearEdge(el) {
  el.getBoundingClientRect = () => ({
    left: 10,
    top: 10,
    right: 110,
    bottom: 50,
    width: 100,
    height: 40
  });
}

test("wait_for: usa controlRef.altSelectors si el selector primario dinamico no existe", async () => {
  resetBody('<input id="mat-input-8" placeholder="Buscar Nro. de Expediente:">');
  const result = await runStep({
    type: "wait_for",
    selector: "#mat-input-3",
    controlRef: {
      selector: "#mat-input-3",
      altSelectors: ['input[placeholder="Buscar Nro. de Expediente:"]']
    },
    timeout: 200
  });

  assert.equal(result.ok, true);
});

test("player: pasa controlRef al resolver sin romper altSelectors", async () => {
  resetBody(`
    <input class="campo" id="nombre" placeholder="Nombre">
    <input class="campo" id="email" placeholder="Email">
  `);

  const result = await runStep({
    type: "input",
    selector: ".campo",
    value: "ana@example.com",
    controlRef: {
      selector: ".campo",
      placeholder: "Email",
      controlKind: "text-input",
      altSelectors: ['input[placeholder="Email"]']
    }
  });

  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("email").value, "ana@example.com");
  assert.equal(win.document.getElementById("nombre").value, "");
});


test("playback visual focus: click fuera de viewport hace scroll antes del click", async () => {
  resetBody('<button id="target">Enviar</button>');
  const target = win.document.getElementById("target");
  const events = [];
  let scrollArgs = null;
  placeOutsideViewport(target);
  target.scrollIntoView = (args) => { scrollArgs = args; events.push("scroll"); };
  target.addEventListener("click", () => { events.push(target.hasAttribute("data-wm-hl") ? "highlighted-click" : "click"); });

  const startedAt = Date.now();
  const result = await runStep({ type: "click", selector: "#target" });
  const elapsed = Date.now() - startedAt;

  assert.equal(result.ok, true);
  assert.deepEqual(events, ["scroll", "highlighted-click"]);
  assert.deepEqual(scrollArgs, { block: "center", inline: "center", behavior: "auto" });
  assert.ok(elapsed >= 150);
});

test("playback visual focus: input fuera de viewport hace scroll antes de escribir", async () => {
  resetBody('<input id="name" type="text">');
  const input = win.document.getElementById("name");
  const events = [];
  let scrollArgs = null;
  placeOutsideViewport(input);
  input.scrollIntoView = (args) => { scrollArgs = args; events.push("scroll"); };
  input.addEventListener("input", () => { events.push(input.hasAttribute("data-wm-hl") ? "highlighted-input" : "input"); });

  const startedAt = Date.now();
  const result = await runStep({ type: "input", selector: "#name", value: "Ana" });
  const elapsed = Date.now() - startedAt;

  assert.equal(result.ok, true);
  assert.equal(input.value, "Ana");
  assert.equal(events[0], "scroll");
  assert.ok(events.slice(1).includes("highlighted-input"));
  assert.deepEqual(scrollArgs, { block: "center", inline: "center", behavior: "auto" });
  assert.ok(elapsed >= 150);
});

test("playback visual focus: centra elemento visible pero fuera del centro", async () => {
  resetBody('<button id="target">Enviar</button>');
  const target = win.document.getElementById("target");
  let scrolls = 0;
  placeVisibleNearEdge(target);
  target.scrollIntoView = () => { scrolls += 1; };

  const result = await runStep({ type: "click", selector: "#target" });

  assert.equal(result.ok, true);
  assert.equal(scrolls, 1);
});

test("playback visual focus: si ya esta centrado no hace scroll y espera breve", async () => {
  resetBody('<button id="target">Enviar</button>');
  const target = win.document.getElementById("target");
  let scrolls = 0;
  placeInsideViewport(target);
  target.scrollIntoView = () => { scrolls += 1; };

  const startedAt = Date.now();
  const result = await runStep({ type: "click", selector: "#target" });
  const elapsed = Date.now() - startedAt;

  assert.equal(result.ok, true);
  assert.equal(scrolls, 0);
  assert.ok(elapsed >= 60);
});

test("playback visual focus: wait, wait_for y navigate no enfocan elementos", async () => {
  resetBody('<button id="target">Enviar</button>');
  const target = win.document.getElementById("target");
  let scrolls = 0;
  placeOutsideViewport(target);
  target.scrollIntoView = () => { scrolls += 1; };

  const result = await runSteps([
    { type: "wait", ms: 1 },
    { type: "wait_for", selector: "#target", timeout: 50 },
    { type: "navigate", url: "https://example.com/" }
  ]);

  assert.equal(result.ok, true);
  assert.equal(scrolls, 0);
});

test("key: Enter con selector enfoca y despacha sobre el campo grabado", async () => {
  resetBody('<form id="f"><input id="busqueda" type="search"><input id="password" type="password"></form>');
  const busqueda = win.document.getElementById("busqueda");
  const password = win.document.getElementById("password");
  const seen = [];
  const passwordSeen = [];
  busqueda.addEventListener("keydown", (event) => seen.push({ key: event.key, target: event.target.id }));
  password.addEventListener("keydown", (event) => passwordSeen.push({ key: event.key, target: event.target.id }));
  password.focus();

  const result = await runStep({ type: "key", key: "Enter", selector: "#busqueda" });

  assert.equal(result.ok, true);
  assert.deepEqual(seen, [{ key: "Enter", target: "busqueda" }]);
  assert.deepEqual(passwordSeen, []);
});

test("key: Enter sin selector conserva fallback legacy hacia password visible", async () => {
  resetBody('<form id="f"><input id="busqueda" type="search"><input id="password" type="password"></form>');
  const password = win.document.getElementById("password");
  const seen = [];
  password.addEventListener("keydown", (event) => seen.push({ key: event.key, target: event.target.id }));

  const result = await runStep({ type: "key", key: "Enter" });

  assert.equal(result.ok, true);
  assert.deepEqual(seen, [{ key: "Enter", target: "password" }]);
});

test("play: TYPE busqueda + KEY Enter con selector no mueve foco a password ni fuerza submit", async () => {
  resetBody('<form id="f"><input id="busqueda" type="search"><input id="password" type="password"></form>');
  const busqueda = win.document.getElementById("busqueda");
  const password = win.document.getElementById("password");
  let submitted = false;
  const passwordSeen = [];
  password.addEventListener("keydown", (event) => passwordSeen.push({ key: event.key, target: event.target.id }));
  win.document.getElementById("f").addEventListener("submit", (event) => {
    submitted = true;
    event.preventDefault();
    password.focus();
  });

  await new Promise((resolve) => {
    const p = new Player({ retryMs: 20, timeoutMs: 500 });
    p.play([
      { type: "input", selector: "#busqueda", value: "test enter" },
      { type: "key", key: "Enter", selector: "#busqueda" }
    ], {
      speed: 1,
      bootstrapToFirstNavigate: false,
      loopReplay: { total: 3, remaining: 3 },
      onDone: resolve,
      onError: resolve
    });
  });

  assert.equal(busqueda.value, "test enter");
  assert.equal(submitted, false);
  assert.deepEqual(passwordSeen, []);
});

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

test("wait_for visible: no resuelve si el elemento existe pero esta oculto", async () => {
  resetBody('<div id="finish" style="display:none">Hello World!</div>');
  const finish = win.document.getElementById("finish");
  finish.getClientRects = () => [];

  const result = await runStep(
    { type: "wait_for", selector: "#finish", timeout: 100, visible: true },
    {},
    { retryMs: 20, timeoutMs: 500 }
  );

  assert.equal(result.ok, false);
  assert.ok(result.error.includes("wait_for"), `Error inesperado: ${result.error}`);
});

test("wait_for visible: resuelve cuando el elemento se vuelve visible", async () => {
  resetBody('<div id="finish" style="display:none">Hello World!</div>');
  const finish = win.document.getElementById("finish");
  finish.getClientRects = () => [];

  setTimeout(() => {
    finish.style.display = "block";
    finish.getClientRects = () => [{ left: 0, top: 0, right: 120, bottom: 30, width: 120, height: 30 }];
  }, 80);

  const result = await runStep(
    { type: "wait_for", selector: "#finish", timeout: 500, visible: true },
    {},
    { retryMs: 20, timeoutMs: 700 }
  );

  assert.equal(result.ok, true, result.error || "debe esperar visibilidad real");
});

test("wait_for legacy: sin visible resuelve aunque el elemento este oculto", async () => {
  resetBody('<div id="finish" style="display:none">Hello World!</div>');
  const finish = win.document.getElementById("finish");
  finish.getClientRects = () => [];

  const result = await runStep(
    { type: "wait_for", selector: "#finish", timeout: 100 },
    {},
    { retryMs: 20, timeoutMs: 500 }
  );

  assert.equal(result.ok, true, result.error || "legacy debe esperar solo existencia");
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

test("input: espera a que un selector existente quede visible antes de escribir", async () => {
  resetBody('<div id="modal" style="display:none"><input id="modal-motivo"></div>');
  const modal = win.document.getElementById("modal");
  const input = win.document.getElementById("modal-motivo");
  const writes = [];
  input.addEventListener("input", () => {
    writes.push({ value: input.value, visible: win.getComputedStyle(modal).display !== "none" });
  });

  setTimeout(() => {
    modal.style.display = "block";
  }, 80);

  const result = await runStep(
    { type: "input", selector: "#modal-motivo", value: "modal demorado EJ15" },
    {},
    { retryMs: 20, timeoutMs: 500 }
  );

  assert.equal(result.ok, true, result.error || "deberia esperar visibilidad antes de escribir");
  assert.equal(input.value, "modal demorado EJ15");
  assert.ok(writes.length > 0, "deberia disparar input al escribir");
  assert.equal(writes.every((entry) => entry.visible), true, "no debe escribir mientras el modal esta oculto");
});

test("play: modal demorado espera input visible antes de confirmar", async () => {
  resetBody(`
    <button id="btn-modal-delay">Abrir modal demorado</button>
    <div id="modal-delay" style="display:none">
      <input id="modal-motivo">
      <button id="btn-modal-confirmar">Confirmar</button>
    </div>
  `);
  const modal = win.document.getElementById("modal-delay");
  const input = win.document.getElementById("modal-motivo");
  let confirmedValue = null;

  win.document.getElementById("btn-modal-delay").addEventListener("click", () => {
    setTimeout(() => {
      modal.style.display = "block";
    }, 80);
  });
  win.document.getElementById("btn-modal-confirmar").addEventListener("click", () => {
    confirmedValue = input.value;
  });

  const result = await runSteps([
    { type: "click", selector: "#btn-modal-delay" },
    { type: "wait_for", selector: "#modal-motivo", timeout: 500 },
    { type: "input", selector: "#modal-motivo", value: "modal demorado EJ15" },
    { type: "click", selector: "#btn-modal-confirmar" }
  ], {}, { retryMs: 20, timeoutMs: 600 });

  assert.equal(result.ok, true, result.error || "deberia completar el flujo del modal demorado");
  assert.equal(confirmedValue, "modal demorado EJ15");
});

test("play: modal simple visible sigue escribiendo y confirmando", async () => {
  resetBody(`
    <div id="modal-simple">
      <input id="modal-motivo">
      <button id="btn-modal-confirmar">Confirmar</button>
    </div>
  `);
  const input = win.document.getElementById("modal-motivo");
  let confirmedValue = null;
  win.document.getElementById("btn-modal-confirmar").addEventListener("click", () => {
    confirmedValue = input.value;
  });

  const result = await runSteps([
    { type: "input", selector: "#modal-motivo", value: "modal simple" },
    { type: "click", selector: "#btn-modal-confirmar" }
  ]);

  assert.equal(result.ok, true, result.error || "modal simple no debe romperse");
  assert.equal(confirmedValue, "modal simple");
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

test("check legacy: fallback #id desde selector descendiente inválido en checkbox", async () => {
  resetBody('<input id="chk-tecnologia" name="generos" type="checkbox">');
  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  let failed = null;
  let summary = null;

  await new Promise((resolve) => {
    p.play([
      { type: "check", selector: '#chk-tecnologia input[name="generos"]', checked: true }
    ], {
      vars: {},
      speed: 1,
      onDone: (s) => { summary = s || null; resolve(); },
      onError: (err) => { failed = err; resolve(); }
    });
  });

  assert.equal(failed, null, failed && failed.message);
  assert.equal(win.document.getElementById("chk-tecnologia").checked, true);
  assert.ok(Array.isArray(summary && summary.fallbacks));
  assert.ok((summary.fallbacks || []).some((f) => f && f.kind === "legacy_descendant_selector"));
});

test("check legacy: fallback #id desde selector descendiente inválido en radio", async () => {
  resetBody('<input id="rad-divorciado" name="estadoCivil" type="radio">');
  const result = await runStep({ type: "check", selector: '#rad-divorciado input[name="estadoCivil"]', checked: true });
  assert.equal(result.ok, true, result.error || "radio legacy fallback falló");
  assert.equal(win.document.getElementById("rad-divorciado").checked, true);
});

test("check nuevo: selector #chk-tecnologia funciona sin fallback", async () => {
  resetBody('<input id="chk-tecnologia" name="generos" type="checkbox">');
  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  let summary = null;
  await new Promise((resolve) => {
    p.play([{ type: "check", selector: "#chk-tecnologia", checked: true }], {
      vars: {}, speed: 1,
      onDone: (s) => { summary = s || null; resolve(); },
      onError: resolve
    });
  });
  assert.equal(win.document.getElementById("chk-tecnologia").checked, true);
  assert.equal((summary && summary.fallbacks || []).some((f) => f && f.kind === "legacy_descendant_selector"), false);
});

test("check nuevo: selector #rad-casado funciona sin fallback", async () => {
  resetBody('<input id="rad-casado" name="estadoCivil" type="radio">');
  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  let summary = null;
  await new Promise((resolve) => {
    p.play([{ type: "check", selector: "#rad-casado", checked: true }], {
      vars: {}, speed: 1,
      onDone: (s) => { summary = s || null; resolve(); },
      onError: resolve
    });
  });
  assert.equal(win.document.getElementById("rad-casado").checked, true);
  assert.equal((summary && summary.fallbacks || []).some((f) => f && f.kind === "legacy_descendant_selector"), false);
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
      loopReplay: { total: 3, remaining: 3 },
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
      loopReplay: { total: 3, remaining: 3 },
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

test("navigate: hacia file:// delega en background y evita location.href directo", async () => {
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const calls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    calls.push(msg);
    if (msg && msg.type === "PLAYBACK_NAVIGATE") {
      if (typeof cb === "function") cb({ ok: true, handoff: true, tabId: 1 });
      return;
    }
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p = new Player({ retryMs: 20, timeoutMs: 300 });
  await new Promise((resolve) => {
    p.play([
      { type: "navigate", url: "file:///C:/Users/usuario/Desktop/Ejercicios/testindex.html" },
      { type: "set_variable", variable: "AFTER_FILE_NAV", value: "NO_DEBE_EJECUTAR" }
    ], {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      loopReplay: { total: 3, remaining: 3 },
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  const delegated = calls.find((c) => c && c.type === "PLAYBACK_NAVIGATE");
  assert.ok(delegated, "debe delegar navigate file:// al background");
  assert.equal(delegated.index, 1, "debe preservar continuation para resume");
  assert.equal(Array.isArray(delegated.steps), true, "debe enviar steps para pending playback");
  assert.deepEqual(delegated.loopReplay, { total: 3, remaining: 3 }, "debe preservar estado de bucle para reanudar tras navigate");
  assert.equal(vars.AFTER_FILE_NAV, undefined, "la continuación debe retomarse tras la navegación");
});

test("navigate: error del background en file:// dispara onError con detail propagado", async () => {
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "PLAYBACK_NAVIGATE") {
      if (typeof cb === "function") cb({
        ok: false,
        error: "navigate_tab_update_failed",
        detail: "tabs.update: Missing host permission for the tab; tabs.create: Cannot access file URL | SOLUCIÓN: En Firefox ve a about:addons → WebMatic"
      });
      return;
    }
    if (typeof cb === "function") cb({ ok: true });
  };

  let gotError = "";
  const p = new Player({ retryMs: 20, timeoutMs: 200 });
  await new Promise((resolve) => {
    p.play([{ type: "navigate", url: "file:///C:/Users/usuario/Desktop/Ejercicios/testindex.html" }], {
      vars: {},
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: (err) => { gotError = String(err && err.message || ""); resolve(); }
    });
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  assert.ok(gotError.includes("navigate failed"), `Error debe contener 'navigate failed': ${gotError}`);
  assert.ok(gotError.includes("Missing host permission"), `Error debe incluir detail real: ${gotError}`);
  assert.ok(gotError.includes("SOLUCIÓN"), `Error debe incluir hint accionable: ${gotError}`);
});

test("navigate: http/https mantiene flujo existente sin PLAYBACK_NAVIGATE", async () => {
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const calls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    calls.push(msg);
    if (typeof cb === "function") cb({ ok: true });
  };

  const originalHref = window.location.href;
  let requestedHref = null;
  try {
    Object.defineProperty(window.location, "href", {
      configurable: true,
      get() { return originalHref; },
      set(v) { requestedHref = String(v || ""); }
    });
  } catch (_e) {
    requestedHref = null;
  }

  const p = new Player({ retryMs: 20, timeoutMs: 200 });
  await new Promise((resolve) => {
    p.play([{ type: "navigate", url: "https://example.com/otra-ruta" }], {
      vars: {},
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  assert.equal(calls.some((c) => c && c.type === "PLAYBACK_NAVIGATE"), false, "no debe delegar http/https normal");
  if (requestedHref !== null) {
    assert.ok(requestedHref.includes("https://example.com/otra-ruta"), "debe seguir usando location.href en flujo normal");
  }
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

test("close_tab: delega handoff al background y corta ejecución en pestaña origen", async () => {
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const calls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    calls.push(msg);
    if (msg && msg.type === "PLAYBACK_TAB_ACTION") {
      if (typeof cb === "function") cb({ ok: true, handoff: true, tabId: 3 });
      return;
    }
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p = new Player({ retryMs: 20, timeoutMs: 200 });
  await new Promise((resolve) => {
    p.play([
      { type: "close_tab", target: "current" },
      { type: "set_variable", variable: "AFTER_CLOSE", value: "NO_DEBE_EJECUTAR_EN_TAB_ORIGEN" }
    ], {
      vars,
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  assert.ok(calls.some((c) => c.type === "PLAYBACK_TAB_ACTION" && c.action === "close_tab"));
  assert.equal(vars.AFTER_CLOSE, undefined);
});

test("play: al finalizar limpia pending playback con CLEAR_PENDING_PLAYBACK", async () => {
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const calls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    calls.push(msg);
    if (typeof cb === "function") cb({ ok: true });
  };

  const p = new Player({ retryMs: 20, timeoutMs: 200 });
  await new Promise((resolve) => {
    p.play([{ type: "wait", ms: 10 }], {
      vars: {},
      speed: 1,
      onDone: resolve,
      onError: resolve
    });
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  assert.ok(calls.some((c) => c && c.type === "CLEAR_PENDING_PLAYBACK"), "debe limpiar pending al terminar");
});

test("resume: if_exists con navigate en subpaso guarda continuacion del padre", async () => {
  resetBody('<div id="exists"></div>');
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const saveCalls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "SAVE_PLAYBACK_STATE") saveCalls.push(msg);
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p.play([
      {
        type: "if_exists",
        selector: "#exists",
        then: [{ type: "navigate", url: "https://example.com/inside-if" }],
        else: []
      },
      { type: "set_variable", variable: "AFTER_IF", value: "ok" }
    ], {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  const continuation = saveCalls.find((c) => Array.isArray(c.steps) && c.index === 0 && c.steps[0] && c.steps[0].type === "set_variable");
  assert.ok(continuation, "debe guardar continuacion hacia el paso posterior al if_exists");
});

test("resume: try_fallback con navigate en fallback guarda continuacion", async () => {
  resetBody('<div></div>');
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const saveCalls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "SAVE_PLAYBACK_STATE") saveCalls.push(msg);
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p = new Player({ retryMs: 20, timeoutMs: 60 });
  await new Promise((resolve) => {
    p.play([
      {
        type: "try_fallback",
        steps: [{ type: "click", selector: "#missing" }],
        fallback: [{ type: "navigate", url: "https://example.com/from-fallback" }]
      },
      { type: "set_variable", variable: "AFTER_FALLBACK", value: "ok" }
    ], {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  const continuation = saveCalls.find((c) => Array.isArray(c.steps) && c.index === 0 && c.steps[0] && c.steps[0].variable === "AFTER_FALLBACK");
  assert.ok(continuation, "debe guardar continuacion hacia el paso posterior al try_fallback");
});

test("resume: for_each_row con navigate en subpaso guarda continuacion por fila", async () => {
  resetBody('<div></div>');
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const saveCalls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "SAVE_PLAYBACK_STATE") saveCalls.push(msg);
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p.play([
      {
        type: "for_each_row",
        columns: ["VAL"],
        dataset: [["a"]],
        steps: [{ type: "navigate", url: "https://example.com/from-row" }]
      },
      { type: "set_variable", variable: "AFTER_ROWS", value: "ok" }
    ], {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  const continuation = saveCalls.find((c) => Array.isArray(c.steps) && c.index === 0 && c.steps[0] && c.steps[0].variable === "AFTER_ROWS");
  assert.ok(continuation, "debe guardar continuacion hacia el paso posterior al for_each_row");
});

test("resume: loop_until con navigate en subpaso guarda continuacion del padre", async () => {
  resetBody('<div></div>');
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const saveCalls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "SAVE_PLAYBACK_STATE") saveCalls.push(msg);
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p.play([
      {
        type: "loop_until",
        selector: "#missing-loop",
        condition: "not_exists",
        max_iterations: 1,
        steps: [{ type: "navigate", url: "https://example.com/from-loop" }]
      },
      { type: "set_variable", variable: "AFTER_LOOP", value: "ok" }
    ], {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  const continuation = saveCalls.find((c) => Array.isArray(c.steps) && c.index === 0 && c.steps[0] && c.steps[0].variable === "AFTER_LOOP");
  assert.ok(continuation, "debe guardar continuacion hacia el paso posterior al loop_until");
});

test("resume: call_macro con navigate en subpaso guarda continuacion del padre", async () => {
  resetBody('<div></div>');
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const saveCalls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "SAVE_PLAYBACK_STATE") saveCalls.push(msg);
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p.play([
      {
        type: "call_macro",
        macro_name: "SubmacroNav",
        steps: [{ type: "navigate", url: "https://example.com/from-call-macro" }]
      },
      { type: "set_variable", variable: "AFTER_CALL_MACRO", value: "ok" }
    ], {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  const continuation = saveCalls.find((c) => Array.isArray(c.steps) && c.index === 0 && c.steps[0] && c.steps[0].variable === "AFTER_CALL_MACRO");
  assert.ok(continuation, "debe guardar continuacion hacia el paso posterior al call_macro");
});

test("resume: for_each_row con 2 filas preserva filas restantes en la continuation", async () => {
  resetBody('<div></div>');
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const saveCalls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "SAVE_PLAYBACK_STATE") {
      saveCalls.push(JSON.parse(JSON.stringify(msg)));
    }
    if (typeof cb === "function") cb({ ok: true });
  };

  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p.play([
      {
        type: "for_each_row",
        columns: ["VAL"],
        dataset: [["a"], ["b"]],
        steps: [{ type: "navigate", url: "https://example.com/row/{{!VAL}}" }]
      },
      { type: "set_variable", variable: "AFTER_MULTI_ROWS", value: "ok" }
    ], {
      vars: {},
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  const continuation = saveCalls.find((c) =>
    Array.isArray(c.steps) &&
    c.index === 0 &&
    c.steps[0] &&
    c.steps[0].type === "for_each_row"
  );
  assert.ok(continuation, "debe persistir un for_each_row remanente al navegar en la primera fila");
  assert.equal(Array.isArray(continuation.steps[0].dataset), true, "dataset remanente esperado");
  assert.equal(continuation.steps[0].dataset.length, 1, "debe quedar una fila pendiente");
  assert.equal(continuation.steps[0].dataset[0][0], "b", "la fila pendiente debe ser la segunda");
});

test("resume: loop_until con múltiples iteraciones preserva iteraciones restantes en la continuation", async () => {
  resetBody('<div></div>');
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;
  const saveCalls = [];
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "SAVE_PLAYBACK_STATE") {
      saveCalls.push(JSON.parse(JSON.stringify(msg)));
    }
    if (typeof cb === "function") cb({ ok: true });
  };

  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p.play([
      {
        type: "loop_until",
        selector: "#missing-loop-multi",
        condition: "not_exists",
        max_iterations: 2,
        steps: [{ type: "navigate", url: "https://example.com/loop-multi" }]
      },
      { type: "set_variable", variable: "AFTER_LOOP_MULTI", value: "ok" }
    ], {
      vars: {},
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  const continuation = saveCalls.find((c) =>
    Array.isArray(c.steps) &&
    c.index === 0 &&
    c.steps[0] &&
    c.steps[0].type === "loop_until"
  );
  assert.ok(continuation, "debe persistir loop_until remanente al navegar en una iteración intermedia");
  assert.equal(Number(continuation.steps[0].max_iterations), 1, "debe quedar una iteración pendiente");
});

test("subflujos complejos: open_tab/switch_tab/close_tab quedan explícitamente no soportados", async () => {
  resetBody('<div id="exists"></div>');

  let gotError = "";
  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p.play([
      {
        type: "if_exists",
        selector: "#exists",
        then: [{ type: "open_tab", url: "https://example.com/new" }],
        else: []
      }
    ], {
      vars: {},
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: (err) => {
        gotError = String((err && err.message) || "");
        resolve();
      }
    });
  });

  assert.ok(/not supported yet/i.test(gotError), `mensaje inesperado: ${gotError}`);
});

test("resume real: SAVE -> QUERY_PENDING_PLAYBACK -> play de continuation preserva trabajo pendiente", async () => {
  resetBody('<div></div>');
  const prevSendMessage = globalThis.chrome.runtime.sendMessage;

  let pending = null;
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.type === "SAVE_PLAYBACK_STATE") {
      if (!pending) pending = JSON.parse(JSON.stringify(msg));
      if (typeof cb === "function") cb({ ok: true });
      return;
    }
    if (msg && msg.type === "QUERY_PENDING_PLAYBACK") {
      const out = pending ? { pending } : { pending: null };
      pending = null;
      if (typeof cb === "function") cb(out);
      return;
    }
    if (msg && msg.type === "CLEAR_PENDING_PLAYBACK") {
      // En navegador real, la navegación corta la ejecución antes del clear final.
      // Para simular ese handoff en unit test, conservamos pending hasta QUERY.
      if (typeof cb === "function") cb({ ok: true });
      return;
    }
    if (typeof cb === "function") cb({ ok: true });
  };

  const vars = {};
  const p1 = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p1.play([
      {
        type: "for_each_row",
        columns: ["VAL"],
        dataset: [["a"], ["b"]],
        steps: [{ type: "navigate", url: "https://example.com/#row-{{!VAL}}" }]
      },
      { type: "set_variable", variable: "AFTER_RESUME_CHAIN", value: "ok" }
    ], {
      vars,
      speed: 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 80);
  });

  const queried = await new Promise((resolve) => {
    globalThis.chrome.runtime.sendMessage({ type: "QUERY_PENDING_PLAYBACK" }, (resp) => resolve(resp || { pending: null }));
  });
  assert.ok(queried && queried.pending, "debe existir pending playback para simular reanudación real");

  const resumedVars = queried.pending.vars || {};
  const p2 = new Player({ retryMs: 20, timeoutMs: 120 });
  await new Promise((resolve) => {
    p2.play(queried.pending.steps || [], {
      vars: resumedVars,
      startIndex: Number(queried.pending.index) || 0,
      speed: Number(queried.pending.speed) || 1,
      bootstrapToFirstNavigate: false,
      onDone: resolve,
      onError: resolve
    });
    setTimeout(resolve, 120);
  });

  globalThis.chrome.runtime.sendMessage = prevSendMessage;
  assert.equal(resumedVars.AFTER_RESUME_CHAIN, "ok", "la continuation debe ejecutar pasos posteriores al subflujo");
  assert.equal(resumedVars.VAL, "b", "la continuation debe conservar y procesar la fila pendiente");
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

test("choose_option: value invalido usa fallback text exacto", async () => {
  resetBody(SELECT_HTML);
  const result = await runStep({ type: "choose_option", selector: "#pais", value: "47", text: "Brasil" });
  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("pais").value, "br");
});

test("choose_option: usa index si value/text no alcanzan", async () => {
  resetBody(SELECT_HTML);
  const result = await runStep({ type: "choose_option", selector: "#pais", value: "no-aplica", text: "No existe", index: 2 });
  assert.equal(result.ok, true);
  assert.equal(win.document.getElementById("pais").value, "uy");
});

test("choose_option: GeneXus/IAPOS #vERROR queda en value 47", async () => {
  resetBody(`
    <select id="vERROR">
      <option value="0">(Ninguno)</option>
      <option value="47">DETALLE AUTORIZADO</option>
    </select>
  `);
  const el = win.document.getElementById("vERROR");
  el.selectedIndex = 0;
  const result = await runStep({
    type: "choose_option",
    selector: "#vERROR",
    value: "47",
    text: "DETALLE AUTORIZADO",
    index: 1
  });
  assert.equal(result.ok, true);
  assert.equal(el.value, "47");
});

test("choose_option: dispara eventos input y change", async () => {
  resetBody(SELECT_HTML);
  const el = win.document.getElementById("pais");
  let inputFired = false, changeFired = false, blurFired = false, focusoutFired = false;
  el.addEventListener("input", () => { inputFired = true; });
  el.addEventListener("change", () => { changeFired = true; });
  el.addEventListener("blur", () => { blurFired = true; });
  el.addEventListener("focusout", () => { focusoutFired = true; });
  const result = await runStep({ type: "choose_option", selector: "#pais", value: "br" });
  assert.equal(result.ok, true);
  assert.equal(inputFired, true, "debe disparar input");
  assert.equal(changeFired, true, "debe disparar change");
  assert.equal(blurFired, true, "debe disparar blur");
  assert.equal(focusoutFired, true, "debe disparar focusout");
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



test("preRunReset: restaura checkbox ensuciado aunque la macro no lo toque", async () => {
  await withVisibleLayout(async () => {
    resetBody(`
      <input id="chk-extra" type="checkbox">
      <input id="real-step" type="text" value="">
    `);

    const chk = win.document.getElementById("chk-extra");
    chk.checked = true;

    const baseline = {
      version: 1,
      url: String(win.location.href || "https://example.com/"),
      controls: [
        { selector: "#chk-extra", tag: "input", type: "checkbox", checked: false }
      ]
    };

    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    let failed = null;

    await new Promise((resolve) => {
      p.play([{ type: "input", selector: "#real-step", value: "ok" }], {
        vars: {},
        speed: 1,
        preRunReset: baseline,
        onDone: resolve,
        onError: (err) => { failed = err; resolve(); }
      });
    });

    assert.equal(failed, null, failed && failed.message);
    assert.equal(win.document.getElementById("chk-extra").checked, false);
    assert.equal(win.document.getElementById("real-step").value, "ok");
  });
});

test("preRunReset: se reintenta despues de navigate y resetea controles renderizados tarde", async () => {
  await withVisibleLayout(async () => {
    resetBody('<div id="mount"></div>');

    const baseHref = String(win.location.href || "https://example.com/").split("#")[0];
    const baseline = {
      version: 1,
      url: baseHref + "#formulario",
      controls: [
        { selector: "#late-check", tag: "input", type: "checkbox", checked: false }
      ]
    };

    setTimeout(() => {
      const mount = win.document.getElementById("mount");
      if (mount) mount.innerHTML = '<input id="late-check" type="checkbox" checked>';
    }, 30);

    const vars = {};
    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    let failed = null;

    await new Promise((resolve) => {
      p.play([
        { type: "navigate", url: baseHref + "#tablas" },
        { type: "set_variable", variable: "AFTER_NAV_RESET", value: "ok" }
      ], {
        vars,
        speed: 1,
        bootstrapToFirstNavigate: false,
        preRunReset: baseline,
        onDone: resolve,
        onError: (err) => { failed = err; resolve(); }
      });
    });

    assert.equal(failed, null, failed && failed.message);
    assert.equal(vars.AFTER_NAV_RESET, "ok");
    assert.equal(win.document.getElementById("late-check").checked, false);
  });
});

test("preRunReset: en reanudacion tambien restaura checkbox default no tocado por la macro", async () => {
  await withVisibleLayout(async () => {
    resetBody(`
      <input id="resume-check" type="checkbox">
      <input id="resume-real" type="text" value="">
    `);

    win.document.getElementById("resume-check").checked = true;

    const baseline = {
      version: 1,
      url: String(win.location.href || "https://example.com/"),
      controls: [
        { selector: "#resume-check", tag: "input", type: "checkbox", checked: false }
      ]
    };

    const Player2 = require("../../../../src/modules/player/player.js");
    const p = new Player2({ retryMs: 20, timeoutMs: 500 });
    let failed = null;

    await new Promise((resolve) => {
      p.play([
        { type: "set_variable", variable: "SKIPPED", value: "0" },
        { type: "input", selector: "#resume-real", value: "resume-ok" }
      ], {
        vars: {},
        speed: 1,
        startIndex: 1,
        preRunReset: baseline,
        onDone: resolve,
        onError: (err) => { failed = err; resolve(); }
      });
    });

    assert.equal(failed, null, failed && failed.message);
    assert.equal(win.document.getElementById("resume-check").checked, false);
    assert.equal(win.document.getElementById("resume-real").value, "resume-ok");
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

test("player: ignora _baselineDefault faltante y continua con pasos reales", async () => {
  resetBody('<input id="ok" type="text" value="">');

  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  let failed = null;
  await new Promise((resolve) => {
    p.play([
      { type: "check", selector: '#chk-tecnologia input[name="generos"]', checked: false, _baselineDefault: true },
      { type: "input", selector: "#ok", value: "real" }
    ], {
      vars: {},
      speed: 1,
      onDone: resolve,
      onError: (err) => { failed = err; resolve(); }
    });
  });

  assert.equal(failed, null, failed && failed.message);
  assert.equal(win.document.getElementById("ok").value, "real");
});

test("player: _baselineDefault en subflujo if_exists tambien se ignora", async () => {
  resetBody('<div id="gate"></div><input id="ok2" type="text" value="">');

  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  let failed = null;
  await new Promise((resolve) => {
    p.play([
      {
        type: "if_exists",
        selector: "#gate",
        then: [
          { type: "check", selector: '#chk-tecnologia input[name="generos"]', checked: false, _baselineDefault: true },
          { type: "input", selector: "#ok2", value: "sub-real" }
        ]
      }
    ], {
      vars: {},
      speed: 1,
      onDone: resolve,
      onError: (err) => { failed = err; resolve(); }
    });
  });

  assert.equal(failed, null, failed && failed.message);
  assert.equal(win.document.getElementById("ok2").value, "sub-real");
});

test("player: mantiene preRunReset al inicio y luego ignora _baselineDefault", async () => {
  resetBody('<input id="campo" type="text" value="SUCIO"><input id="ok3" type="text" value="">');

  const baseline = {
    version: 1,
    controls: [{ selector: "#campo", tag: "input", type: "text", value: "LIMPIO" }]
  };

  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  let failed = null;
  await new Promise((resolve) => {
    p.play([
      { type: "check", selector: '#chk-tecnologia input[name="generos"]', checked: false, _baselineDefault: true },
      { type: "input", selector: "#ok3", value: "post" }
    ], {
      vars: {},
      speed: 1,
      preRunReset: baseline,
      onDone: resolve,
      onError: (err) => { failed = err; resolve(); }
    });
  });

  assert.equal(failed, null, failed && failed.message);
  assert.equal(win.document.getElementById("campo").value, "LIMPIO");
  assert.equal(win.document.getElementById("ok3").value, "post");
});

test("player: check real del usuario (sin _baselineDefault) si se ejecuta", async () => {
  resetBody('<input id="c-real" type="checkbox">');

  const p = new Player({ retryMs: 20, timeoutMs: 120 });
  let failed = null;
  await new Promise((resolve) => {
    p.play([{ type: "check", selector: "#c-real", checked: true }], {
      vars: {},
      speed: 1,
      onDone: resolve,
      onError: (err) => { failed = err; resolve(); }
    });
  });

  assert.equal(failed, null, failed && failed.message);
  assert.equal(win.document.getElementById("c-real").checked, true);
});

test("check idempotente: checked false no hace toggle si ya esta desmarcado", async () => {
  resetBody('<input id="cb-idem-1" type="checkbox">');

  const input = win.document.getElementById("cb-idem-1");
  let clickCount = 0;
  input.addEventListener("click", () => { clickCount++; });

  const result = await runStep({ type: "check", selector: "#cb-idem-1", checked: false });

  assert.equal(result.ok, true, result.error || "check false idempotente fallo");
  assert.equal(input.checked, false);
  assert.equal(clickCount, 0, "no debe hacer click si ya esta desmarcado");
});

test("check idempotente: checked true no hace toggle si ya esta marcado", async () => {
  resetBody('<input id="cb-idem-2" type="checkbox" checked>');

  const input = win.document.getElementById("cb-idem-2");
  let clickCount = 0;
  input.addEventListener("click", () => { clickCount++; });

  const result = await runStep({ type: "check", selector: "#cb-idem-2", checked: true });

  assert.equal(result.ok, true, result.error || "check true idempotente fallo");
  assert.equal(input.checked, true);
  assert.equal(clickCount, 0, "no debe hacer click si ya esta marcado");
});

test("check idempotente: checked false desmarca si estaba marcado", async () => {
  resetBody('<input id="cb-idem-3" type="checkbox" checked>');

  const input = win.document.getElementById("cb-idem-3");

  const result = await runStep({ type: "check", selector: "#cb-idem-3", checked: false });

  assert.equal(result.ok, true, result.error || "check false desde marcado fallo");
  assert.equal(input.checked, false);
});

test("check idempotente: checked true marca si estaba desmarcado", async () => {
  resetBody('<input id="cb-idem-4" type="checkbox">');

  const input = win.document.getElementById("cb-idem-4");

  const result = await runStep({ type: "check", selector: "#cb-idem-4", checked: true });

  assert.equal(result.ok, true, result.error || "check true desde desmarcado fallo");
  assert.equal(input.checked, true);
});
