const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const win = new Window({ url: "https://example.com/form" });
global.window = win;
global.document = win.document;
global.Element = win.Element;
global.HTMLElement = win.HTMLElement;
global.HTMLInputElement = win.HTMLInputElement;
global.HTMLTextAreaElement = win.HTMLTextAreaElement;
win.Element.prototype.getClientRects = function getClientRects() {
  const style = win.getComputedStyle(this);
  if (this.hidden || style.display === "none" || style.visibility === "hidden") return [];
  return [{ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 }];
};
win.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
  const rects = this.getClientRects();
  return rects[0] || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
};

const normalizer = require("../../../../src/modules/recorder/normalizer/recording-normalizer.js");
const defaultsCapture = require("../../../../src/modules/recorder/defaults/defaults-capture.js");
const recorderEvents = require("../../../../src/modules/recorder/events/recorder-events.js");

test("recorder helper modules preserve normalization, defaults and capture guards", () => {
  assert.deepEqual(
    normalizer.mergeKeySteps([
      { type: "text", selector: "#q", value: "a" },
      { type: "text", selector: "#q", value: "b" },
      { type: "text", selector: "#other", value: "c" }
    ]),
    [
      { type: "text", selector: "#q", value: "ab" },
      { type: "text", selector: "#other", value: "c" }
    ]
  );

  assert.deepEqual(
    normalizer.normalizeRecordedSteps([
      { type: "input", selector: "#q", value: "DIA" },
      { type: "wait", seconds: 1, _autoWait: true },
      { type: "input", selector: "#q", value: "DIAGNOSTICO" },
      { type: "click", selector: "#save" }
    ]),
    [
      { type: "input", selector: "#q", value: "DIAGNOSTICO" },
      { type: "click", selector: "#save" }
    ]
  );

  assert.deepEqual(
    normalizer.normalizeRecordedSteps([
      { type: "input", selector: "#q", value: "uno" },
      { type: "wait", seconds: 1 },
      { type: "input", selector: "#q", value: "dos" }
    ]),
    [
      { type: "input", selector: "#q", value: "uno" },
      { type: "wait", seconds: 1 },
      { type: "input", selector: "#q", value: "dos" }
    ]
  );

  document.body.innerHTML = `
    <input id="name" value="Ana">
    <input id="enabled" type="checkbox" checked>
    <input id="secret-token" value="abc123">
    <select id="city"><option value="ba" selected>BA</option></select>
    <div id="webmatic-panel-root"><input id="internal" value="no"></div>
  `;

  const reset = defaultsCapture.captureInitialPreRunReset(
    document,
    "https://example.com/form",
    "Formulario",
    (el) => "#" + el.id
  );

  assert.equal(reset.url, "https://example.com/form");
  assert.deepEqual(
    reset.controls.map((ctrl) => ctrl.selector),
    ["#name", "#enabled", "#secret-token", "#city"]
  );
  assert.equal(reset.controls.find((ctrl) => ctrl.selector === "#name").value, "Ana");
  assert.equal(reset.controls.find((ctrl) => ctrl.selector === "#enabled").checked, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      reset.controls.find((ctrl) => ctrl.selector === "#secret-token"),
      "value"
    ),
    false
  );

  const panelInput = document.getElementById("internal");
  assert.equal(recorderEvents.isInsideWebMaticUi(panelInput), true);
  assert.equal(recorderEvents.isTextEntryCaptureTarget(document.getElementById("name")), true);
  assert.equal(recorderEvents.isInvalidCapturedStep({ type: "click", selector: "" }), true);
  assert.equal(recorderEvents.isInvalidCapturedStep({ type: "drag_drop", from: "#a", to: "#b" }), false);

  document.body.insertAdjacentHTML("beforeend", `<button id="icon-button"><svg><path id="icon-path"></path></svg></button>`);
  assert.equal(
    recorderEvents.normalizeCaptureTarget(document.getElementById("icon-path")),
    document.getElementById("icon-button")
  );
});

test("capture target: promueve descendientes decorativos al boton clickeable", () => {
  document.body.innerHTML = `
    <button id="startAssistantButton"><strong>IMAGEN</strong><span>Crear pieza</span></button>
  `;

  assert.equal(
    recorderEvents.normalizeCaptureTarget(document.querySelector("#startAssistantButton strong")),
    document.getElementById("startAssistantButton")
  );
});

test("capture target: no considera interactuable un input dentro de ancestro oculto", () => {
  document.body.innerHTML = `<section style="display:none"><input id="email" value="qa@example.test"></section>`;

  assert.equal(recorderEvents.isInteractableCaptureTarget(document.getElementById("email")), false);
});

test("post-click dynamic observer: detecta elemento existente que pasa a visible", () => {
  document.body.innerHTML = `
    <button id="start">Start</button>
    <div id="finish" style="display:none"><h4>Hello World!</h4></div>
  `;

  const visibleAtClick = recorderEvents.collectVisiblePostClickSelectors(document, (el) => "#" + el.id);
  assert.equal(visibleAtClick.has("#finish"), false);

  const finish = document.getElementById("finish");
  finish.style.display = "block";
  const picked = recorderEvents.pickPostClickWaitForCandidate([finish], (el) => "#" + el.id, {
    clickedSelector: "#start",
    visibleAtClick
  });

  assert.equal(picked.selector, "#finish");
});

test("post-click dynamic observer: ignora loader y elige resultado final visible", () => {
  document.body.innerHTML = `
    <button id="start">Start</button>
    <div id="loading" style="display:none">Loading...</div>
    <div id="finish" style="display:none"><h4>Hello World!</h4></div>
  `;

  const visibleAtClick = recorderEvents.collectVisiblePostClickSelectors(document, (el) => "#" + el.id);
  const loading = document.getElementById("loading");
  const finish = document.getElementById("finish");
  loading.style.display = "block";
  finish.style.display = "block";

  const picked = recorderEvents.pickPostClickWaitForCandidate([loading, finish], (el) => "#" + el.id, {
    clickedSelector: "#start",
    visibleAtClick
  });

  assert.equal(picked.selector, "#finish");
});

test("post-click dynamic observer: ignora UI de WebMatic", () => {
  document.body.innerHTML = `
    <button id="start">Start</button>
    <div id="webmatic-panel-root"><div id="finish">Hello World!</div></div>
  `;

  const picked = recorderEvents.pickPostClickWaitForCandidate(
    [document.getElementById("finish")],
    (el) => "#" + el.id,
    { clickedSelector: "#start", visibleAtClick: new Set() }
  );

  assert.equal(picked, null);
});

test("post-click dynamic observer: no duplica candidato ya visible al click", () => {
  document.body.innerHTML = `
    <button id="start">Start</button>
    <div id="finish">Hello World!</div>
  `;

  const visibleAtClick = recorderEvents.collectVisiblePostClickSelectors(document, (el) => "#" + el.id);
  const picked = recorderEvents.pickPostClickWaitForCandidate(
    [document.getElementById("finish")],
    (el) => "#" + el.id,
    { clickedSelector: "#start", visibleAtClick }
  );

  assert.equal(picked, null);
});

test("normalizer GeneXus: no mezcla baseline/wait_for de listado dentro de detalle", () => {
  const steps = normalizer.sanitizePageContextSteps([
    {
      type: "navigate",
      url: "https://iapos.test/servlet/auauditdetalle_ww?token=" + "x".repeat(48),
      _wmBlockKey: "iapos.test/servlet/auauditdetalle_ww",
      _wmBlockStart: true
    },
    {
      type: "input",
      selector: "#vDETALLES_0001",
      value: "",
      _baselineDefault: true,
      _fast: true,
      _wmBlockKey: "iapos.test/servlet/auauditdetalle_ww"
    },
    {
      type: "click",
      selector: "#vDETALLES_0001",
      _wmBlockKey: "iapos.test/servlet/auauditcabe_ww",
      _wmEventUrl: "https://iapos.test/servlet/auauditcabe_ww"
    },
    {
      type: "wait_for",
      selector: "#vDETALLES_0001",
      _autoWait: true,
      _wmBlockKey: "iapos.test/servlet/auauditcabe_ww"
    }
  ]);

  assert.equal(steps[0].url, "https://iapos.test/servlet/auauditcabe_ww");
  assert.equal(steps.some((s) => s._baselineDefault && s._wmBlockKey !== "iapos.test/servlet/auauditcabe_ww"), false);
  assert.equal(steps.some((s) => s.type === "wait_for" && s.selector === "#vDETALLES_0001" && s._wmBlockKey !== "iapos.test/servlet/auauditcabe_ww"), false);
});

test("normalizer GeneXus: conserva pageKey de eventos reales listado y detalle", () => {
  const steps = normalizer.sanitizePageContextSteps([
    {
      type: "navigate",
      url: "https://iapos.test/servlet/auauditdetalle_ww?parm=" + "1".repeat(50),
      _wmBlockKey: "iapos.test/servlet/auauditdetalle_ww",
      _wmBlockStart: true
    },
    {
      type: "click",
      selector: "#vDETALLES_0001",
      _wmBlockKey: "iapos.test/servlet/auauditcabe_ww",
      _wmEventUrl: "https://iapos.test/servlet/auauditcabe_ww"
    },
    {
      type: "click",
      selector: "#vAUTORIZAR_0001",
      _wmBlockKey: "iapos.test/servlet/auauditdetalle_ww",
      _wmEventUrl: "https://iapos.test/servlet/auauditdetalle_ww?parm=" + "2".repeat(50)
    }
  ]);

  assert.equal(steps[0].url, "https://iapos.test/servlet/auauditcabe_ww");
  assert.equal(steps.find((s) => s.selector === "#vDETALLES_0001")._wmBlockKey, "iapos.test/servlet/auauditcabe_ww");
  assert.equal(steps.find((s) => s.selector === "#vAUTORIZAR_0001")._wmBlockKey, "iapos.test/servlet/auauditdetalle_ww");
});

test("normalizer GeneXus: detecta URLs dinamicas largas conservadoramente", () => {
  assert.equal(
    normalizer.isLikelyDynamicGeneXusUrl("https://iapos.test/servlet/auauditdetalle_ww?token=" + "a".repeat(32)),
    true
  );
  assert.equal(
    normalizer.isLikelyDynamicGeneXusUrl("https://iapos.test/servlet/audaauditar?parm=" + "b".repeat(32)),
    true
  );
  assert.equal(
    normalizer.isLikelyDynamicGeneXusUrl("https://iapos.test/servlet/auauditcabe_ww"),
    false
  );
});
