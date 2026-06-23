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
