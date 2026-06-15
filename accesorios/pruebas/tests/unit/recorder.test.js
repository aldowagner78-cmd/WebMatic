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

test("dedupeFieldRuns: inserta WAIT=2 tras click si pasan 1500ms antes de input", () => {
  const steps = [
    { type: "click", selector: "#btn-modal-delay", _ts: 1000 },
    { type: "input", selector: "#modal-motivo", value: "ok", _ts: 2500 }
  ];

  const out = Recorder.dedupeFieldRuns(steps);
  assert.deepEqual(out.map((s) => s.type), ["click", "wait", "input"]);
  assert.equal(out[1].seconds, 2);
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
