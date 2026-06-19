const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDomHarness,
  freshRequire,
  loadFixture
} = require("../helpers/browser-harness.js");

function boot(fixture) {
  createDomHarness({ url: "https://qa.example.test/record", html: loadFixture(fixture) });
  return {
    Recorder: freshRequire("../../../../src/modules/recorder/recorder.js"),
    events: freshRequire("../../../../src/modules/recorder/events/recorder-events.js"),
    defaults: freshRequire("../../../../src/modules/recorder/defaults/defaults-capture.js"),
    normalizer: freshRequire("../../../../src/modules/recorder/normalizer/recording-normalizer.js")
  };
}

test("recorder fixture: buildSelector produce steps estables para click, check e input", () => {
  const { Recorder, events } = boot("qa/basic-form.html");

  const button = document.querySelector("#basic-submit");
  const input = document.querySelector("#basic-name");
  const checkbox = document.querySelector("#basic-check");

  assert.deepEqual({ type: "click", selector: Recorder.buildSelector(button) }, { type: "click", selector: "#basic-submit" });
  assert.deepEqual({ type: "input", selector: Recorder.buildSelector(input), value: "Ana" }, { type: "input", selector: "#basic-name", value: "Ana" });
  assert.deepEqual({ type: "check", selector: Recorder.buildSelector(checkbox), checked: true }, { type: "check", selector: "#basic-check", checked: true });
  assert.equal(events.isInvalidCapturedStep({ type: "click", selector: "#basic-submit" }), false);
});

test("recorder fixture: select se representa como choose_option y no altera formato", () => {
  const { Recorder } = boot("qa/basic-form.html");
  const select = document.querySelector("#basic-city");
  select.value = "mdz";
  assert.deepEqual(
    { type: "choose_option", selector: Recorder.buildSelector(select), value: select.value },
    { type: "choose_option", selector: "#basic-city", value: "mdz" }
  );
});

test("recorder fixture: UI propia de WebMatic se ignora para captura", () => {
  const { events } = boot("qa/basic-form.html");
  document.body.insertAdjacentHTML("beforeend", '<div id="webmatic-panel-root"><button id="wm-internal">Interno</button></div>');
  assert.equal(events.isInsideWebMaticUi(document.querySelector("#wm-internal")), true);
  assert.equal(events.isInsideWebMaticUi(document.querySelector("#basic-submit")), false);
});

test("recorder fixture: defaults captura input, textarea, checkbox, radio y select", () => {
  const { defaults } = boot("qa/basic-form.html");
  document.querySelector("#basic-name").value = "Inicial";
  document.querySelector("#basic-notes").value = "Notas";
  document.querySelector("#basic-check").checked = true;
  document.querySelector("#basic-radio-a").checked = true;
  document.querySelector("#basic-city").value = "ba";

  const snapshot = defaults.captureInitialPreRunReset(
    document,
    "https://qa.example.test/record",
    "QA",
    (el) => "#" + el.id
  );

  const bySelector = new Map(snapshot.controls.map((control) => [control.selector, control]));
  assert.equal(bySelector.get("#basic-name").value, "Inicial");
  assert.equal(bySelector.get("#basic-notes").value, "Notas");
  assert.equal(bySelector.get("#basic-check").checked, true);
  assert.equal(bySelector.get("#basic-radio-a").checked, true);
  assert.equal(bySelector.get("#basic-city").value, "ba");
  assert.equal(snapshot.version, 1);
});

test("recorder fixture: defaults excluye controles internos WebMatic", () => {
  const { defaults } = boot("qa/basic-form.html");
  document.body.insertAdjacentHTML("beforeend", '<div id="webmatic-floating-recorder-global"><input id="wm-field" value="no"></div>');
  const controls = [];
  defaults.capturePreRunControlsInDoc(document, controls, new Set(), (el) => "#" + el.id);
  assert.equal(controls.some((control) => control.selector === "#wm-field"), false);
});

test("recorder fixture: normalizer compacta tipeo progresivo y preserva cambios distintos", () => {
  const { normalizer } = boot("qa/basic-form.html");
  assert.deepEqual(
    normalizer.normalizeRecordedSteps([
      { type: "input", selector: "#basic-name", value: "A" },
      { type: "wait", seconds: 1 },
      { type: "input", selector: "#basic-name", value: "Ana" },
      { type: "click", selector: "#basic-submit" }
    ]),
    [
      { type: "input", selector: "#basic-name", value: "Ana" },
      { type: "click", selector: "#basic-submit" }
    ]
  );

  assert.deepEqual(
    normalizer.normalizeRecordedSteps([
      { type: "input", selector: "#basic-name", value: "uno" },
      { type: "wait", seconds: 2 },
      { type: "input", selector: "#basic-name", value: "dos" }
    ]),
    [
      { type: "input", selector: "#basic-name", value: "uno" },
      { type: "wait", seconds: 2 },
      { type: "input", selector: "#basic-name", value: "dos" }
    ]
  );
});
