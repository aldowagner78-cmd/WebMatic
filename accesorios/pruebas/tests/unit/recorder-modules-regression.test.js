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
