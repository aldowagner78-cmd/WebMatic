const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const win = new Window({ url: "https://example.com/" });
globalThis.window = win;
globalThis.document = win.document;
globalThis.Element = win.Element;
globalThis.HTMLElement = win.HTMLElement;
globalThis.HTMLInputElement = win.HTMLInputElement;
globalThis.HTMLTextAreaElement = win.HTMLTextAreaElement;
globalThis.HTMLSelectElement = win.HTMLSelectElement;

const Recorder = require("../../../../src/modules/recorder/recorder.js");

function resetBody(html) {
  win.document.body.innerHTML = html;
}

test("buildSelector: usa #id cuando el id resuelve al mismo elemento", () => {
  resetBody('<button id="btn_abc_123_20260613" data-testid="approve-button">Authorize</button>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), "#btn_abc_123_20260613");
});

test("buildSelector: usa #id por encima de aria-label cuando es válido", () => {
  resetBody('<button id="x9f8a7_20260613" aria-label="Authorize request">OK</button>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), "#x9f8a7_20260613");
});

test("buildSelector: usa #id por encima de title cuando es válido", () => {
  resetBody('<button id="btn_random_998877" title="Authorize">A</button>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), "#btn_random_998877");
});

test("buildSelector: duplicate names use stable parent context", () => {
  resetBody(`
    <div id="form-a"><input name="codigo"></div>
    <div id="form-b"><input name="codigo"></div>
  `);
  const el = win.document.querySelector("#form-a input");
  assert.equal(Recorder.buildSelector(el), '#form-a input[name="codigo"]');
});

test("buildSelector: gxrow + title for GeneXus row actions", () => {
  resetBody('<table><tr gxrow="0001"><td><button title="Authorize">Authorize</button></td></tr></table>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), '[gxrow="0001"] [title="Authorize"]');
});

test("buildSelector: avoids dynamic data-* and falls back to visible text", () => {
  resetBody('<button data-reactid=".0.1" data-v-f3a9b0="x">Approve now</button>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), 'button[text="Approve now"]');
});

test("buildSelector: avoids text fallback when duplicated and keeps controlled fallback", () => {
  resetBody(`
    <div id="box">
      <button>Confirm</button>
      <button>Confirm</button>
    </div>
  `);
  const second = win.document.querySelectorAll("button")[1];
  const selector = Recorder.buildSelector(second);
  assert.ok(!selector.includes('[text="Confirm"]'));
  assert.equal(selector, "#box button:nth-of-type(2)");
});

test("buildSelector: dom mutation keeps stable selector", () => {
  resetBody('<button id="btn_123_20260613" data-testid="approve-button">Authorize</button>');
  const first = win.document.querySelector("button");
  const firstSelector = Recorder.buildSelector(first);

  win.document.body.innerHTML = '<button id="btn_889_20260614" data-testid="approve-button">Authorize</button>';
  const second = win.document.querySelector("button");
  const secondSelector = Recorder.buildSelector(second);

  assert.equal(firstSelector, "#btn_123_20260613");
  assert.equal(secondSelector, "#btn_889_20260614");
});

test("buildSelector: keeps stable simple id", () => {
  resetBody('<input id="login" type="text">');
  const el = win.document.querySelector("input");
  assert.equal(Recorder.buildSelector(el), "#login");
});

test("buildSelector: keeps unique name selector", () => {
  resetBody('<input name="email" type="text">');
  const el = win.document.querySelector("input");
  assert.equal(Recorder.buildSelector(el), 'input[type="text"][name="email"]');
});

test("buildSelector: keeps short stable href", () => {
  resetBody('<a href="/orders/active">Open</a>');
  const el = win.document.querySelector("a");
  assert.equal(Recorder.buildSelector(el), 'a[href="/orders/active"]');
});

test("buildSelector: keeps final class+nth fallback", () => {
  resetBody(`
    <section>
      <button class="cta"> </button>
      <button class="cta"> </button>
    </section>
  `);
  const second = win.document.querySelectorAll("button")[1];
  assert.equal(Recorder.buildSelector(second), "button.cta:nth-of-type(2)");
});

test("buildSelector: dynamic id is used only as last resort when no stable alternative exists", () => {
  resetBody('<div><button id="btn_9a8b7c_20260613"></button></div>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), "#btn_9a8b7c_20260613");
});

test("buildSelector: salta id dinamico Angular Material si hay placeholder estable", () => {
  resetBody('<input id="mat-input-3" placeholder="Buscar Nro. de Expediente:">');
  const el = win.document.querySelector("input");
  assert.equal(Recorder.buildSelector(el), 'input[placeholder="Buscar Nro. de Expediente:"]');
});

test("dedupeFieldRuns: conserva primer input si hay otra edicion posterior separada", () => {
  const steps = [
    { type: "navigate", url: "file:///pagina-a.html" },
    { type: "click", selector: "#afiliado" },
    { type: "input", selector: "#afiliado", value: "111111" },
    { type: "click", selector: "#estado" },
    { type: "choose_option", selector: "#estado", value: "autorizado" },
    { type: "navigate", url: "file:///pagina-b.html" },
    { type: "input", selector: "#observacion", value: "ok" },
    { type: "navigate", url: "file:///pagina-a.html" },
    { type: "input", selector: "#afiliado", value: "222222" }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  const afiliadoInputs = out.filter((s) => s.type === "input" && s.selector === "#afiliado");
  assert.equal(afiliadoInputs.length, 2);
  assert.equal(afiliadoInputs[0].value, "111111");
  assert.equal(afiliadoInputs[1].value, "222222");
});

test("dedupeFieldRuns: deduplica rafaga local input/change y conserva ultimo valor", () => {
  const steps = [
    { type: "click", selector: "#afiliado" },
    { type: "text", selector: "#afiliado", value: "111111" },
    { type: "wait", seconds: 1 },
    { type: "input", selector: "#afiliado", value: "111111" },
    { type: "click", selector: "#estado" }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  const fieldSteps = out.filter((s) => (s.type === "input" || s.type === "text") && s.selector === "#afiliado");
  assert.equal(fieldSteps.length, 1);
  assert.equal(fieldSteps[0].type, "input");
  assert.equal(fieldSteps[0].value, "111111");
});



test("dedupeFieldRuns: conserva filtro escrito y luego borrado tras pausa aunque haya rafaga de teclas", () => {
  const steps = [
    { type: "input", selector: "#filtro-tabla", value: "a", _ts: 1000 },
    { type: "input", selector: "#filtro-tabla", value: "an", _ts: 1050 },
    { type: "input", selector: "#filtro-tabla", value: "ana", _ts: 1100 },
    { type: "input", selector: "#filtro-tabla", value: "", _ts: 3300 }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  assert.deepEqual(out.map((s) => s.type), ["input", "wait", "input"]);
  assert.equal(out[0].selector, "#filtro-tabla");
  assert.equal(out[0].value, "ana");
  assert.equal(out[1].seconds, 1);
  assert.equal(out[1]._autoWait, true);
  assert.equal(out[2].selector, "#filtro-tabla");
  assert.equal(out[2].value, "");
});

test("dedupeFieldRuns: conserva estados intermedios de un filtro separados por pausa real", () => {
  const steps = [
    { type: "input", selector: "#filtro-tabla", value: "ana", _ts: 1000 },
    { type: "input", selector: "#filtro-tabla", value: "", _ts: 3200 }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  assert.deepEqual(out.map((s) => s.type), ["input", "wait", "input"]);
  assert.equal(out[0].value, "ana");
  assert.equal(out[1].seconds, 1);
  assert.equal(out[1]._autoWait, true);
  assert.equal(out[2].value, "");
});

test("dedupeFieldRuns: limita WAIT automatico tras click a 1 segundo", () => {
  const steps = [
    { type: "click", selector: "#btn-modal-delay", _ts: 1000 },
    { type: "input", selector: "#modal-motivo", value: "ok", _ts: 2500 }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  assert.deepEqual(out.map((s) => s.type), ["click", "wait", "input"]);
  assert.equal(out[1].seconds, 1);
  assert.equal(out[1]._autoWait, true);
});

test("dedupeFieldRuns: no inserta WAIT si pasan menos de 1200ms", () => {
  const steps = [
    { type: "click", selector: "#btn-modal-delay", _ts: 1000 },
    { type: "input", selector: "#modal-motivo", value: "ok", _ts: 2100 }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  assert.deepEqual(out.map((s) => s.type), ["click", "input"]);
});

test("dedupeFieldRuns: no inserta WAIT entre _baselineDefault y paso real", () => {
  const steps = [
    { type: "click", selector: "#btn-modal-delay", _ts: 1000, _baselineDefault: true, _fast: true },
    { type: "input", selector: "#modal-motivo", value: "ok", _ts: 3200 }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  assert.deepEqual(out.map((s) => s.type), ["click", "input"]);
});

test("dedupeFieldRuns: no duplica WAIT si luego ya existe wait_for o wait", () => {
  const withWaitFor = [
    { type: "click", selector: "#btn-modal-delay", _ts: 1000 },
    { type: "wait_for", selector: "#modal-motivo", timeout: 10000, _ts: 1100 },
    { type: "input", selector: "#modal-motivo", value: "ok", _ts: 3500 }
  ];
  const outWaitFor = Recorder.dedupeFieldRuns(withWaitFor);
  assert.deepEqual(outWaitFor.map((s) => s.type), ["click", "wait_for", "input"]);

  const withWait = [
    { type: "click", selector: "#btn-modal-delay", _ts: 1000 },
    { type: "wait", seconds: 2, _ts: 1200 },
    { type: "input", selector: "#modal-motivo", value: "ok", _ts: 3500 }
  ];
  const outWait = Recorder.dedupeFieldRuns(withWait);
  assert.deepEqual(outWait.map((s) => s.type), ["click", "wait", "input"]);
});



test("normalizeRecordedSteps: no compacta snapshots separados por WAIT manual largo", () => {
  const steps = [
    { type: "wait", seconds: 10 },
    { type: "input", selector: "#ce-diagnostico", value: "DIA" },
    { type: "wait", seconds: 3 },
    { type: "input", selector: "#ce-diagnostico", value: "DIAGNOSTICO" },
    { type: "wait", seconds: 3 },
    { type: "input", selector: "#ce-diagnostico", value: "DIAGNOSTICO EJ" },
    { type: "wait", seconds: 2 },
    { type: "input", selector: "#ce-diagnostico", value: "DIAGNOSTICO EJ 12 FIM" },
    { type: "wait", seconds: 4 },
    { type: "input", selector: "#ce-diagnostico", value: "DIAGNOSTICO EJ 12 FINAL" },
    { type: "wait", seconds: 1 },
    { type: "input", selector: "#ce-observaciones", value: "OBSERVACIONES EJ 12 FINAL" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out, steps);
});

test("normalizeRecordedSteps: compacta correccion rapida antes de KEY Enter", () => {
  const steps = [
    { type: "input", selector: "#busqueda", value: "TET" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#busqueda", value: "TEST ENTER" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "key", key: "Enter", selector: "#busqueda" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out, [
    { type: "input", selector: "#busqueda", value: "TEST ENTER" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "key", key: "Enter", selector: "#busqueda" }
  ]);
});

test("normalizeRecordedSteps: compacta correccion rapida simple del mismo campo", () => {
  const steps = [
    { type: "input", selector: "#nombre", value: "ALD" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#nombre", value: "ALDO" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out, [
    { type: "input", selector: "#nombre", value: "ALDO" }
  ]);
});

test("normalizeRecordedSteps: conserva input escrito y luego borrado aunque haya WAIT", () => {
  const steps = [
    { type: "input", selector: "#filtro-tabla", value: "ana" },
    { type: "wait", seconds: 3 },
    { type: "input", selector: "#filtro-tabla", value: "" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out, steps);
});

test("normalizeRecordedSteps: limita solo WAIT automaticos de grabacion", () => {
  assert.deepEqual(
    Recorder.normalizeRecordedSteps([{ type: "wait", seconds: 6, _autoWait: true }]),
    [{ type: "wait", seconds: 1, _autoWait: true }]
  );
  assert.deepEqual(
    Recorder.normalizeRecordedSteps([{ type: "wait", seconds: 10, _autoWait: true }]),
    [{ type: "wait", seconds: 1, _autoWait: true }]
  );
  assert.deepEqual(
    Recorder.normalizeRecordedSteps([{ type: "wait", seconds: 1, _autoWait: true }]),
    [{ type: "wait", seconds: 1, _autoWait: true }]
  );
  assert.deepEqual(
    Recorder.normalizeRecordedSteps([{ type: "wait", seconds: 10 }]),
    [{ type: "wait", seconds: 10 }]
  );
  assert.deepEqual(
    Recorder.normalizeRecordedSteps([{ type: "wait_for", selector: "#modal", timeout: 10000 }]),
    [{ type: "wait_for", selector: "#modal", timeout: 10000 }]
  );
});

test("normalizeRecordedSteps: conserva TYPE reales y limita waits automaticos entre filtros", () => {
  const steps = [
    { type: "input", selector: "#filtro-tabla", value: "ana" },
    { type: "wait", seconds: 10, _autoWait: true },
    { type: "input", selector: "#filtro-tabla", value: "" },
    { type: "wait", seconds: 6, _autoWait: true },
    { type: "input", selector: "#filtro-tabla", value: "mariel" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out.map((s) => s.type), ["input", "wait", "input", "wait", "input"]);
  assert.deepEqual(out.filter((s) => s.type === "input").map((s) => s.value), ["ana", "", "mariel"]);
  assert.deepEqual(out.filter((s) => s.type === "wait").map((s) => s.seconds), [1, 1]);
  assert.deepEqual(out.filter((s) => s.type === "wait").map((s) => s._autoWait), [true, true]);
});

test("normalizeRecordedSteps: no compacta correcciones si hay click entre medio", () => {
  const steps = [
    { type: "input", selector: "#filtro-tabla", value: "ANA" },
    { type: "click", selector: 'button[text="+ Agregar fila"]' },
    { type: "input", selector: "#filtro-tabla", value: "" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no compacta correcciones si hay navigate entre medio", () => {
  const steps = [
    { type: "input", selector: "#busqueda", value: "TEST" },
    { type: "navigate", url: "https://example.test/otra" },
    { type: "input", selector: "#busqueda", value: "TEST ENTER" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no compacta correcciones si hay wait_for entre medio", () => {
  const steps = [
    { type: "input", selector: "#busqueda", value: "TEST" },
    { type: "wait_for", selector: "#resultado", timeout: 10000 },
    { type: "input", selector: "#busqueda", value: "TEST ENTER" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no compacta inputs de selectores distintos", () => {
  const steps = [
    { type: "input", selector: "#campoA", value: "uno" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#campoB", value: "dos" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no compacta checkbox radio ni select", () => {
  const steps = [
    { type: "check", selector: "#chk-tecnologia", checked: true },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "check", selector: "#chk-tecnologia", checked: false },
    { type: "choose_option", selector: "#pais", value: "ar" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "choose_option", selector: "#pais", value: "uy" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "check", selector: "#chk-tecnologia", checked: true },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "check", selector: "#chk-tecnologia", checked: false },
    { type: "wait_for", selector: "#pais", timeout: 10000, _autoWait: true },
    { type: "choose_option", selector: "#pais", value: "ar" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "choose_option", selector: "#pais", value: "uy" }
  ]);
});

test("normalizeRecordedSteps: agrega wait_for automatico antes de choose_option", () => {
  const steps = [
    { type: "navigate", url: "https://a.local/" },
    { type: "choose_option", selector: "#pais", value: "ar" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "navigate", url: "https://a.local/" },
    { type: "wait_for", selector: "#pais", timeout: 10000, _autoWait: true },
    { type: "choose_option", selector: "#pais", value: "ar" }
  ]);
});

test("normalizeRecordedSteps: no duplica wait_for antes de choose_option", () => {
  const steps = [
    { type: "wait_for", selector: "#pais", timeout: 10000 },
    { type: "choose_option", selector: "#pais", value: "ar" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no duplica wait manual antes de choose_option", () => {
  const steps = [
    { type: "wait", seconds: 2 },
    { type: "choose_option", selector: "#pais", value: "ar" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: select nativo compactado conserva choose_option con wait_for previo", () => {
  const steps = [
    { type: "click", selector: "#pais" },
    { type: "choose_option", selector: "#pais", value: "ar" },
    { type: "click", selector: "#pais > option:nth-of-type(2)" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "wait_for", selector: "#pais", timeout: 10000, _autoWait: true },
    { type: "choose_option", selector: "#pais", value: "ar" }
  ]);
});

test("normalizeRecordedSteps: conserva wait_for posterior a click dinamico", () => {
  const steps = [
    { type: "navigate", url: "https://the-internet.herokuapp.com/dynamic_loading/1" },
    { type: "click", selector: "#start button", _ts: 1000 },
    { type: "wait", seconds: 5, _autoWait: true, _ts: 6000 },
    { type: "wait_for", selector: "#finish", timeout: 10000, _autoWait: true }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "navigate", url: "https://the-internet.herokuapp.com/dynamic_loading/1" },
    { type: "click", selector: "#start button", _ts: 1000 },
    { type: "wait_for", selector: "#finish", timeout: 10000, _autoWait: true }
  ]);
});

test("normalizeRecordedSteps: no duplica wait_for inmediato despues de click", () => {
  const steps = [
    { type: "click", selector: "#start button" },
    { type: "wait_for", selector: "#finish", timeout: 10000, _autoWait: true }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no agrega wait_for si despues del click hay accion real", () => {
  const steps = [
    { type: "click", selector: "#start button" },
    { type: "wait", seconds: 5, _autoWait: true },
    { type: "input", selector: "#name", value: "Ada" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "click", selector: "#start button" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#name", value: "Ada" }
  ]);
});

test("normalizeRecordedSteps: conserva pausa automatica larga terminal despues de click", () => {
  const steps = [
    { type: "click", selector: "#start button" },
    { type: "wait", seconds: 5, _autoWait: true }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: compacta texto confirmado por KEY Enter del mismo selector", () => {
  const steps = [
    { type: "input", selector: "#campo", value: "abc", controlRef: { selector: "#campo", tag: "input", type: "text", controlKind: "text-input" } },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#campo", value: "abcdef", controlRef: { selector: "#campo", tag: "input", type: "text", controlKind: "text-input" } },
    { type: "key", key: "Enter", selector: "#campo" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "input", selector: "#campo", value: "abcdef", controlRef: { selector: "#campo", tag: "input", type: "text", controlKind: "text-input" } },
    { type: "key", key: "Enter", selector: "#campo" }
  ]);
});

test("normalizeRecordedSteps: compacta reemplazo confirmado por Enter sin hardcodear busqueda", () => {
  const steps = [
    { type: "input", selector: "#busqueda", value: "test", controlRef: { selector: "#busqueda", tag: "input", type: "search", controlKind: "text-input" } },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#busqueda", value: "probando enter", controlRef: { selector: "#busqueda", tag: "input", type: "search", controlKind: "text-input" } },
    { type: "key", key: "Enter", selector: "#busqueda" },
    { type: "wait", seconds: 1, _autoWait: true }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "input", selector: "#busqueda", value: "probando enter", controlRef: { selector: "#busqueda", tag: "input", type: "search", controlKind: "text-input" } },
    { type: "key", key: "Enter", selector: "#busqueda" },
    { type: "wait", seconds: 1, _autoWait: true }
  ]);
});

test("normalizeRecordedSteps: conserva wait automatico entre ultimo texto y Enter", () => {
  const steps = [
    { type: "input", selector: "#campo", value: "uno" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#campo", value: "dos" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "key", key: "Enter", selector: "#campo" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "input", selector: "#campo", value: "dos" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "key", key: "Enter", selector: "#campo" }
  ]);
});

test("normalizeRecordedSteps: no compacta texto confirmado si Enter es de otro selector", () => {
  const steps = [
    { type: "input", selector: "#campoA", value: "uno" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#campoA", value: "dos" },
    { type: "key", key: "Enter", selector: "#campoB" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no compacta texto confirmado si hay key intermedia distinta", () => {
  const steps = [
    { type: "input", selector: "#campo", value: "uno" },
    { type: "key", key: "Tab", selector: "#campo" },
    { type: "input", selector: "#campo", value: "dos" },
    { type: "key", key: "Enter", selector: "#campo" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no compacta native-select aunque termine con Enter", () => {
  const steps = [
    { type: "input", selector: "#pais", value: "ar", controlRef: { selector: "#pais", tag: "select", controlKind: "native-select" } },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#pais", value: "uy", controlRef: { selector: "#pais", tag: "select", controlKind: "native-select" } },
    { type: "key", key: "Enter", selector: "#pais" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no compacta checkbox ni radio aunque terminen con Enter", () => {
  const steps = [
    { type: "input", selector: "#chk", value: "true", controlRef: { selector: "#chk", tag: "input", type: "checkbox", controlKind: "checkbox" } },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#chk", value: "false", controlRef: { selector: "#chk", tag: "input", type: "checkbox", controlKind: "checkbox" } },
    { type: "key", key: "Enter", selector: "#chk" },
    { type: "input", selector: "#rad", value: "a", controlRef: { selector: "#rad", tag: "input", type: "radio", controlKind: "radio" } },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#rad", value: "b", controlRef: { selector: "#rad", tag: "input", type: "radio", controlKind: "radio" } },
    { type: "key", key: "Enter", selector: "#rad" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: no compacta flujo choose_option antes de Enter", () => {
  const steps = [
    { type: "input", selector: "#combo", value: "san" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#combo", value: "santa" },
    { type: "choose_option", selector: "#combo", value: "sf", text: "Santa Fe" },
    { type: "key", key: "Enter", selector: "#combo" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), [
    { type: "input", selector: "#combo", value: "san" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#combo", value: "santa" },
    { type: "wait_for", selector: "#combo", timeout: 10000, _autoWait: true },
    { type: "choose_option", selector: "#combo", value: "sf", text: "Santa Fe" },
    { type: "key", key: "Enter", selector: "#combo" }
  ]);
});

test("normalizeRecordedSteps: no compacta combobox listbox ni autocomplete antes de Enter", () => {
  const cases = [
    { selector: "#combo", controlRef: { selector: "#combo", tag: "input", type: "text", role: "combobox", controlKind: "text-input" } },
    { selector: "#lista", controlRef: { selector: "#lista", tag: "input", type: "text", role: "listbox", controlKind: "text-input" } },
    { selector: "#auto", controlRef: { selector: "#auto", tag: "input", type: "text", ariaAutocomplete: "list", controlKind: "text-input" } },
    { selector: "#inventario", controlRef: { selector: "#inventario", tag: "input", type: "text", controlKind: "autocomplete" } }
  ];

  for (const item of cases) {
    const steps = [
      { type: "input", selector: item.selector, value: "san", controlRef: item.controlRef },
      { type: "wait", seconds: 1, _autoWait: true },
      { type: "input", selector: item.selector, value: "santa", controlRef: item.controlRef },
      { type: "key", key: "Enter", selector: item.selector }
    ];
    assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
  }
});

test("selectorResolvesToElement: rechaza selector que apunta a descendiente inválido", () => {
  resetBody('<input id="chk-tecnologia" name="generos" type="checkbox">');
  const el = win.document.getElementById("chk-tecnologia");
  const ok = Recorder.selectorResolvesToElement(win.document, '#chk-tecnologia input[name="generos"]', el);
  assert.equal(ok, false);
});

test("buildSelector general: checkbox con id propio y name compartido -> #id", () => {
  resetBody('<input id="chk-tecnologia" name="generos" type="checkbox"><input id="chk-musica" name="generos" type="checkbox">');
  const el = win.document.getElementById("chk-tecnologia");
  assert.equal(Recorder.buildSelector(el), "#chk-tecnologia");
});

test("buildSelector general: radio con id propio y name compartido -> #id", () => {
  resetBody('<input id="rad-casado" name="estadoCivil" type="radio"><input id="rad-soltero" name="estadoCivil" type="radio">');
  const el = win.document.getElementById("rad-casado");
  assert.equal(Recorder.buildSelector(el), "#rad-casado");
});

test("buildSelector general: select con id propio -> #id", () => {
  resetBody('<select id="pais"><option value="ar">Argentina</option></select>');
  const el = win.document.getElementById("pais");
  assert.equal(Recorder.buildSelector(el), "#pais");
});

test("buildSelector general: textarea con id propio -> #id", () => {
  resetBody('<textarea id="notas"></textarea>');
  const el = win.document.getElementById("notas");
  assert.equal(Recorder.buildSelector(el), "#notas");
});

test("buildSelector general: input dentro de label con id propio -> #id", () => {
  resetBody('<label>Genero<input id="gen-id" name="genero" type="checkbox"></label>');
  const el = win.document.getElementById("gen-id");
  assert.equal(Recorder.buildSelector(el), "#gen-id");
});

test("buildSelector general: input sin id y name único usa selector por name válido", () => {
  resetBody('<input name="correo" type="text">');
  const el = win.document.querySelector('input[name="correo"]');
  const selector = Recorder.buildSelector(el);
  assert.equal(selector, 'input[type="text"][name="correo"]');
  assert.equal(win.document.querySelector(selector), el);
});

test("buildSelector general: input sin id y name duplicado usa fallback validado", () => {
  resetBody('<div id="form-a"><input name="codigo"></div><div id="form-b"><input name="codigo"></div>');
  const el = win.document.querySelector("#form-a input");
  const selector = Recorder.buildSelector(el);
  assert.equal(selector, '#form-a input[name="codigo"]');
  assert.equal(win.document.querySelector(selector), el);
});

test("preRunReset: captura selectores canónicos #id para checkbox/radio/select/text", () => {
  resetBody([
    '<input id="txt-nombre" type="text" value="Juan">',
    '<input id="chk-tecnologia" type="checkbox" checked>',
    '<input id="rad-casado" name="estadoCivil" type="radio" checked>',
    '<select id="pais"><option value="ar" selected>Argentina</option></select>'
  ].join(""));

  const pre = Recorder.captureInitialPreRunReset(win.document, "https://example.com", "T", Recorder.buildSelector);
  assert.ok(pre && Array.isArray(pre.controls));

  const selectors = pre.controls.map((c) => c.selector);
  assert.ok(selectors.includes("#txt-nombre"));
  assert.ok(selectors.includes("#chk-tecnologia"));
  assert.ok(selectors.includes("#rad-casado"));
  assert.ok(selectors.includes("#pais"));

  selectors.forEach((s) => {
    assert.equal(/#\w[\w-]*\s+(input|select|textarea)\[/.test(s), false);
  });
});

test("normalizeRecordedSteps: elimina TYPE duplicado identico y conserva borrado real", () => {
  const steps = [
    { type: "input", selector: "#filtro-tabla", value: "ana" },
    { type: "wait", seconds: 5 },
    { type: "input", selector: "#filtro-tabla", value: "ana" },
    { type: "wait", seconds: 2 },
    { type: "input", selector: "#filtro-tabla", value: "" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out.map((s) => s.type), ["input", "wait", "input"]);
  assert.equal(out[0].value, "ana");
  assert.equal(out[1].seconds, 7);
  assert.equal(out[2].value, "");
});

test("normalizeRecordedSteps: elimina flush redundante despues de Enter", () => {
  const steps = [
    { type: "input", selector: "#busqueda", value: "test enter" },
    { type: "wait", seconds: 4 },
    { type: "input", selector: "#busqueda", value: "test enter" },
    { type: "key", key: "Enter" },
    { type: "input", selector: "#busqueda", value: "test enter" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out.map((s) => s.type), ["input", "wait", "key"]);
  assert.equal(out[0].selector, "#busqueda");
  assert.equal(out[0].value, "test enter");
  assert.equal(out[1].seconds, 4);
  assert.equal(out[2].key, "Enter");
});

test("normalizeRecordedSteps: elimina TYPE igual despues de KEY Enter aunque haya WAIT", () => {
  const steps = [
    { type: "input", selector: "#busqueda", value: "test enter" },
    { type: "wait", seconds: 2, _autoWait: true },
    { type: "key", key: "Enter" },
    { type: "wait", seconds: 2, _autoWait: true },
    { type: "input", selector: "#busqueda", value: "test enter" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out.map((s) => s.type), ["input", "wait", "key", "wait"]);
  assert.equal(out[0].selector, "#busqueda");
  assert.equal(out[0].value, "test enter");
  assert.equal(out[1].seconds, 1);
  assert.equal(out[2].key, "Enter");
  assert.equal(out[3].seconds, 1);
});

test("normalizeRecordedSteps: no compacta inputs si hay KEY Enter entre medio", () => {
  const steps = [
    { type: "input", selector: "#busqueda", value: "TEST" },
    { type: "key", key: "Enter", selector: "#busqueda" },
    { type: "input", selector: "#busqueda", value: "TEST ENTER" }
  ];

  assert.deepEqual(Recorder.normalizeRecordedSteps(steps), steps);
});

test("normalizeRecordedSteps: conserva input distinto y borrado real en el mismo selector", () => {
  const typed = Recorder.normalizeRecordedSteps([
    { type: "input", selector: "#busqueda", value: "test" },
    { type: "input", selector: "#busqueda", value: "test enter" }
  ]);
  assert.deepEqual(typed, [
    { type: "input", selector: "#busqueda", value: "test enter" }
  ]);

  const cleared = Recorder.normalizeRecordedSteps([
    { type: "input", selector: "#filtro-tabla", value: "ana" },
    { type: "input", selector: "#filtro-tabla", value: "" }
  ]);
  assert.deepEqual(cleared, [
    { type: "input", selector: "#filtro-tabla", value: "ana" },
    { type: "input", selector: "#filtro-tabla", value: "" }
  ]);
});

test("normalizeRecordedSteps: no elimina defaults _baselineDefault", () => {
  const steps = [
    { type: "input", selector: "#busqueda", value: "test enter", _baselineDefault: true },
    { type: "input", selector: "#busqueda", value: "test enter" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.equal(out.length, 2);
  assert.equal(out[0]._baselineDefault, true);
  assert.equal(out[1]._baselineDefault, undefined);
});

test("normalizeRecordedSteps: compacta escritura progresiva del mismo campo", () => {
  const steps = [
    { type: "input", selector: "#diagnostico", value: "D" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#diagnostico", value: "DIAGNOSTICO EJ12 FINAL" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out.map((s) => s.type), ["input"]);
  assert.equal(out[0].selector, "#diagnostico");
  assert.equal(out[0].value, "DIAGNOSTICO EJ12 FINAL");
});

test("normalizeRecordedSteps: compacta multiples parciales progresivos y conserva ultimo", () => {
  const steps = [
    { type: "input", selector: "#observaciones", value: "O" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#observaciones", value: "OBSERVACIONES" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#observaciones", value: "OBSERVACIONES EJ" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "input", selector: "#observaciones", value: "OBSERVACIONES EJ12 FINAL" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out.map((s) => s.type), ["input"]);
  assert.equal(out[0].selector, "#observaciones");
  assert.equal(out[0].value, "OBSERVACIONES EJ12 FINAL");
});

test("normalizeRecordedSteps: conserva cambio real no progresivo", () => {
  const steps = [
    { type: "input", selector: "#campo", value: "ABC" },
    { type: "wait", seconds: 2 },
    { type: "input", selector: "#campo", value: "XYZ" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out.map((s) => s.type), ["input", "wait", "input"]);
  assert.deepEqual(out.map((s) => s.value).filter((v) => v != null), ["ABC", "XYZ"]);
});

// ── Tests rc19: grabador principal – validación de flujos completos ────────────

test("main recorder: conserva selector en Enter (dedupeFieldRuns - flujo grabador principal)", () => {
  // Secuencia tal como llega desde el grabador principal (main frame con selector ya capturado)
  const steps = [
    { type: "navigate", url: "https://example.com" },
    { type: "input",  selector: "#busqueda", value: "probando enter" },
    { type: "wait",   seconds: 1, _autoWait: true },
    { type: "key",    key: "Enter", selector: "#busqueda", controlRef: { selector: "#busqueda", tag: "input" } }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  const keyStep = out.find((s) => s.type === "key");
  assert.ok(keyStep, "debe existir un step key");
  assert.equal(keyStep.selector, "#busqueda", "selector debe conservarse");
  assert.ok(keyStep.controlRef, "controlRef debe conservarse");
  assert.equal(keyStep.controlRef.tag, "input");
});

test("main recorder: compacta select nativo (dedupeFieldRuns - flujo grabador principal)", () => {
  // click + choose_option + click-option tal como llega del grabador principal
  const steps = [
    { type: "click",         selector: "#pais" },
    { type: "choose_option", selector: "#pais",     value: "AR" },
    { type: "click",         selector: "#pais option:nth-of-type(2)" },
    { type: "click",         selector: "#provincia" },
    { type: "choose_option", selector: "#provincia", value: "SF" },
    { type: "click",         selector: "#provincia option:nth-of-type(4)" }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  const chooseOpts = out.filter((s) => s.type === "choose_option");
  assert.equal(chooseOpts.length, 2, "deben quedar exactamente 2 choose_option");
  assert.equal(chooseOpts[0].selector, "#pais");
  assert.equal(chooseOpts[1].selector, "#provincia");
  assert.ok(!out.some((s) => s.type === "click" && s.selector === "#pais"),      "no debe haber click en #pais");
  assert.ok(!out.some((s) => s.type === "click" && s.selector === "#provincia"),  "no debe haber click en #provincia");
  assert.ok(!out.some((s) => s.type === "click" && /option/.test(s.selector)),   "no debe haber click en options");
});

test("main recorder: secuencia completa (Escenario A) - Enter + dos selects nativos dependientes", () => {
  // Escenario A completo: simula grabación desde cero con input, Enter y dos selects dependientes
  const steps = [
    { type: "navigate",      url: "https://example.com/form" },
    { type: "input",         selector: "#busqueda", value: "test" },
    { type: "wait",          seconds: 1, _autoWait: true },
    { type: "input",         selector: "#busqueda", value: "probando enter" },
    { type: "wait",          seconds: 1, _autoWait: true },
    { type: "key",           key: "Enter", selector: "#busqueda" },
    { type: "click",         selector: "#pais" },
    { type: "choose_option", selector: "#pais",      value: "AR" },
    { type: "click",         selector: "#pais option:nth-of-type(2)" },
    { type: "click",         selector: "#provincia" },
    { type: "choose_option", selector: "#provincia",  value: "SF" },
    { type: "click",         selector: "#provincia option:nth-of-type(4)" }
  ];

  const out = Recorder.dedupeFieldRuns(steps);

  // key Enter debe conservar su selector
  const keyStep = out.find((s) => s.type === "key");
  assert.ok(keyStep, "debe existir key step");
  assert.equal(keyStep.selector, "#busqueda", "key.selector debe conservarse");

  // Solo debe quedar el último valor del input (dedupeFieldRuns elimina el previo)
  const busquedaInputs = out.filter((s) => s.type === "input" && s.selector === "#busqueda");
  assert.equal(busquedaInputs.length, 1, "solo debe quedar un step input de #busqueda");
  assert.equal(busquedaInputs[0].value, "probando enter", "debe conservar el valor final");

  // Selects nativos deben ser atómicos
  const chooseOpts = out.filter((s) => s.type === "choose_option");
  assert.equal(chooseOpts.length, 2, "ambos choose_option deben estar presentes");
  assert.equal(chooseOpts[0].selector, "#pais");
  assert.equal(chooseOpts[0].value, "AR");
  assert.equal(chooseOpts[1].selector, "#provincia");
  assert.equal(chooseOpts[1].value, "SF");

  // Sin clicks ruidosos
  assert.ok(!out.some((s) => s.type === "click" && s.selector === "#pais"),     "sin click en #pais");
  assert.ok(!out.some((s) => s.type === "click" && s.selector === "#provincia"), "sin click en #provincia");
  assert.ok(!out.some((s) => s.type === "click" && /option/.test(s.selector)),  "sin click en option");
});

// ── Tests rc18: KEY Enter selector inference + select nativo atómico ──────────

test("normalizeRecordedSteps [B]: infiere selector de Enter cuando el input previo es editable", () => {
  const steps = [
    { type: "input", selector: "#campo", value: "abc" },
    { type: "wait", seconds: 1, _autoWait: true },
    { type: "key", key: "Enter" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  const keyStep = out.find((s) => s.type === "key");
  assert.ok(keyStep, "debe existir un step key");
  assert.equal(keyStep.selector, "#campo", "selector debe ser heredado del input previo");
  assert.ok(keyStep.controlRef, "debe tener controlRef");
  assert.equal(keyStep.controlRef.selector, "#campo");
});

test("normalizeRecordedSteps [D]: KEY Enter sin selector y sin input previo conserva comportamiento legacy", () => {
  const steps = [
    { type: "click", selector: "#btn" },
    { type: "key", key: "Enter" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  const keyStep = out.find((s) => s.type === "key");
  assert.ok(keyStep, "debe existir el step key");
  assert.equal(keyStep.selector, undefined, "no debe inferir selector si el paso previo no es un input editable");
});

test("normalizeRecordedSteps [E]: select nativo click+choose_option+click option se compacta a choose_option", () => {
  const steps = [
    { type: "click", selector: "#pais" },
    { type: "choose_option", selector: "#pais", value: "AR" },
    { type: "click", selector: "#pais option:nth-of-type(2)" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out, [
    { type: "wait_for", selector: "#pais", timeout: 10000, _autoWait: true },
    { type: "choose_option", selector: "#pais", value: "AR" }
  ]);
});

test("normalizeRecordedSteps [E2]: click+choose_option sin click option tambien se compacta", () => {
  const steps = [
    { type: "click", selector: "#provincia" },
    { type: "choose_option", selector: "#provincia", value: "SF" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out, [
    { type: "wait_for", selector: "#provincia", timeout: 10000, _autoWait: true },
    { type: "choose_option", selector: "#provincia", value: "SF" }
  ]);
});

test("normalizeRecordedSteps [F]: dos choose_option dependientes no se eliminan", () => {
  const steps = [
    { type: "choose_option", selector: "#pais", value: "AR" },
    { type: "choose_option", selector: "#provincia", value: "SF" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.deepEqual(out, [
    { type: "wait_for", selector: "#pais", timeout: 10000, _autoWait: true },
    { type: "choose_option", selector: "#pais", value: "AR" },
    { type: "wait_for", selector: "#provincia", timeout: 10000, _autoWait: true },
    { type: "choose_option", selector: "#provincia", value: "SF" }
  ]);
});

test("normalizeRecordedSteps [H]: custom combobox input+choose_option+click role NO se compacta", () => {
  const steps = [
    { type: "input", selector: "#combo", value: "san" },
    { type: "choose_option", selector: "#combo", value: "Santa Fe", text: "Santa Fe" },
    { type: "click", selector: "[role='option']" }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.equal(out.length, 4, "no debe compactar combobox custom con input previo");
  assert.equal(out[0].type, "input");
  assert.equal(out[1].type, "wait_for");
  assert.equal(out[1].selector, "#combo");
  assert.equal(out[2].type, "choose_option");
  assert.equal(out[3].type, "click");
});

test("normalizeRecordedSteps [H2]: choose_option con controlRef combobox no se compacta aunque tenga click previo", () => {
  const steps = [
    { type: "click", selector: "#autocomplete" },
    {
      type: "choose_option",
      selector: "#autocomplete",
      value: "op1",
      controlRef: { selector: "#autocomplete", tag: "input", role: "combobox" }
    }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.equal(out.length, 3, "combobox con controlRef.role=combobox no debe compactarse");
  assert.equal(out[0].type, "click");
  assert.equal(out[1].type, "wait_for");
  assert.equal(out[1].selector, "#autocomplete");
  assert.equal(out[2].type, "choose_option");
});

test("normalizeRecordedSteps [I]: checkbox y radio no son afectados por la compactacion de selects", () => {
  const steps = [
    { type: "check", selector: "#check-a", checked: true },
    { type: "choose_option", selector: "#pais", value: "AR" },
    { type: "check", selector: "#check-b", checked: false }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.equal(out.length, 4);
  assert.equal(out[0].type, "check");
  assert.equal(out[1].type, "wait_for");
  assert.equal(out[1].selector, "#pais");
  assert.equal(out[2].type, "choose_option");
  assert.equal(out[3].type, "check");
});

test("normalizeRecordedSteps [J]: waits automaticos siguen limitados a 1s con las nuevas pasadas", () => {
  const steps = [
    { type: "click", selector: "#pais" },
    { type: "wait", seconds: 5, _autoWait: true },
    { type: "choose_option", selector: "#pais", value: "AR" },
    { type: "wait", seconds: 8, _autoWait: true }
  ];

  const out = Recorder.normalizeRecordedSteps(steps);
  assert.ok(out.some((s) => s.type === "choose_option"), "choose_option debe estar presente");
  assert.ok(!out.some((s) => s.type === "click" && s.selector === "#pais"), "click del select no debe estar");
  const autoWaits = out.filter((s) => s.type === "wait" && s._autoWait === true);
  autoWaits.forEach((w) => assert.ok(Number(w.seconds) <= 1, `auto-wait debe ser <= 1s, fue ${w.seconds}`));
});
