const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDomHarness,
  freshRequire
} = require("../helpers/browser-harness.js");

function bootDom() {
  createDomHarness({ html: '<div id="root"></div>' });
}

test("editor/ui flow: validation crea y edita steps manteniendo estructura compleja", () => {
  const validation = require("../../../../src/modules/editor/validation/editor-validation.js");

  assert.deepEqual(validation.normalizeNewStep({ type: "check", selector: "#ok", checked: "true" }), {
    type: "check",
    selector: "#ok",
    checked: true
  });
  assert.deepEqual(validation.normalizeNewStep({ type: "wait", seconds: "0" }), { type: "wait", seconds: 1 });
  assert.deepEqual(validation.normalizeNewStep({ type: "loop_until", max_iterations: "bad" }), {
    type: "loop_until",
    max_iterations: 50,
    steps: []
  });
  assert.deepEqual(
    validation.normalizeEditedStep({ type: "for_each_row", columns: "A, B" }, { dataset: [[1, 2]], steps: [{ type: "click" }] }),
    { type: "for_each_row", columns: ["A", "B"], dataset: [[1, 2]], steps: [{ type: "click" }] }
  );
});

test("editor/ui flow: render utils y componentes crean clases, disabled y textos esperados", () => {
  bootDom();
  const renderUtils = freshRequire("../../../../src/modules/editor/renderers/editor-render-utils.js");
  const components = freshRequire("../../../../src/modules/ui/components/ui-components.js");

  let clicked = 0;
  const enabled = renderUtils.mkBtn("OK", "Titulo", false, () => { clicked += 1; });
  enabled.click();
  assert.equal(enabled.className, "wm-sved-btn");
  assert.equal(enabled.title, "Titulo");
  assert.equal(clicked, 1);

  const disabled = renderUtils.mkBtn("NO", "Bloqueado", true, () => { clicked += 1; });
  disabled.click();
  assert.equal(disabled.disabled, true);
  assert.equal(clicked, 1);

  const item = components.createMacroItem({ id: "m1", name: "Macro", steps: [{}, {}] });
  assert.equal(item.className, "webmatic-macro-item");
  assert.equal(item.dataset.macroId, "m1");
  assert.equal(item.querySelector(".webmatic-macro-count").textContent, "2p");

  const empty = components.createMacroEmpty("Sin macros");
  assert.equal(empty.className, "webmatic-macro-empty");
  assert.equal(empty.textContent, "Sin macros");
});

test("editor/ui flow: shell-state toggles y style utils preservan clases esperadas", () => {
  bootDom();
  const shellState = freshRequire("../../../../src/modules/ui/shell/ui-shell-state.js");
  const styleUtils = freshRequire("../../../../src/modules/ui/styles/ui-style-utils.js");

  const panel = document.createElement("div");
  shellState.applyPanelState(panel, {
    ui: { panelVisible: true, panelWidth: 420, panelSide: "left", isFloatingRecorderVisible: true },
    settings: { panelOpacity: 0.75, themeMode: "dark" }
  });
  assert.equal(panel.style.display, "block");
  assert.equal(panel.style.width, "420px");
  assert.equal(panel.classList.contains("webmatic-left"), true);
  assert.equal(panel.classList.contains("webmatic-floating-mode"), true);
  assert.equal(panel.classList.contains("webmatic-dark"), true);

  styleUtils.applyThemePalette(panel, {
    accent: "#111", accentFg: "#fff", surface: "#eee", surface2: "#ddd", btnBg: "#ccc",
    btnHover: "#bbb", border: "#aaa", swatchBorder: "#999", text: "#222", textMuted: "#555",
    cardBg: "#fafafa", scrollbar: "#777", headerFrom: "#123", headerTo: "#456", headerText: "#fff"
  });
  assert.equal(panel.style.getPropertyValue("--webmatic-accent"), "#111");

  const btn = document.createElement("button");
  btn.className = "active";
  styleUtils.applyModeButtonStyle(btn, {
    activeBg: "#000", bg: "#fff", activeText: "#fff", text: "#000", activeBorder: "#444", border: "#ccc"
  });
  assert.equal(btn.style.background, "#000");
});

test("editor/ui flow: block, drag-drop e inline recording helpers cubren calculos puros", () => {
  const blockUtils = require("../../../../src/modules/editor/blocks/block-utils.js");
  const dragDropUtils = require("../../../../src/modules/editor/blocks/drag-drop-utils.js");
  const inlineState = require("../../../../src/modules/editor/state/inline-recording-state.js");

  const steps = [
    { type: "navigate", _wmBlockKey: "a.test/home" },
    { type: "input", selector: "#a", _wmBlockKey: "a.test/home" },
    { type: "navigate", _wmBlockKey: "b.test/home", _wmCollapsed: true },
    { type: "click", selector: "#b", _wmBlockKey: "b.test/home" }
  ];
  assert.deepEqual(blockUtils.findExecutionBlockBounds(steps, 1), { start: 0, end: 1 });
  assert.deepEqual(blockUtils.collectCollapsibleBlockKeys(steps, { onlyMarkedByDefault: true }), ["2:3"]);
  assert.equal(dragDropUtils.computeDropPosition(75, 50, 40), "after");
  assert.equal(dragDropUtils.normalizeDropTarget(4, 1), 3);
  assert.equal(dragDropUtils.resolveDragMode(2, true, "auto"), "block");

  const captured = inlineState.normalizeInlineRecordedSteps([{ type: "click" }], true);
  assert.equal(captured[0]._wmBlockStart, true);
  assert.equal(captured[0]._wmCollapsed, true);
});

// ── Tests rc19: grabador de bloques – las correcciones rc18 llegan al editor ──

test("block recorder: conserva selector en Enter al agregar bloque", () => {
  const { Window } = require("happy-dom");
  const win2 = new Window({ url: "https://example.com/" });
  globalThis.window = win2;
  globalThis.document = win2.document;
  globalThis.HTMLSelectElement = win2.HTMLSelectElement;
  globalThis.HTMLInputElement  = win2.HTMLInputElement;
  globalThis.HTMLTextAreaElement = win2.HTMLTextAreaElement;
  const RecorderLocal = require("../../../../src/modules/recorder/recorder.js");
  const inlineStateLocal = require("../../../../src/modules/editor/state/inline-recording-state.js");

  // Steps ya normalizados por _cleanupSteps (como recibe normalizeInlineRecordedSteps)
  const capturedSteps = RecorderLocal.dedupeFieldRuns([
    { type: "input",  selector: "#busqueda", value: "probando enter" },
    { type: "wait",   seconds: 1, _autoWait: true },
    { type: "key",    key: "Enter", selector: "#busqueda",
      controlRef: { selector: "#busqueda", tag: "input" } }
  ]);

  const result = inlineStateLocal.normalizeInlineRecordedSteps(capturedSteps, true);

  const keyStep = result.find((s) => s.type === "key");
  assert.ok(keyStep, "key step debe estar presente");
  assert.equal(keyStep.selector, "#busqueda", "selector debe sobrevivir al merge de bloque");
  assert.equal(result[0]._wmBlockStart, true,   "primer step debe marcarse como inicio de bloque");
  assert.equal(result[0]._wmCollapsed,  true,   "primer step debe marcarse como colapsado");
});

test("block recorder: compacta select nativo al agregar bloque", () => {
  const inlineStateLocal = require("../../../../src/modules/editor/state/inline-recording-state.js");
  const RecorderLocal    = require("../../../../src/modules/recorder/recorder.js");

  // click + choose_option + click-option – llegan ya normalizados desde _cleanupSteps
  const capturedSteps = RecorderLocal.dedupeFieldRuns([
    { type: "click",         selector: "#pais" },
    { type: "choose_option", selector: "#pais",      value: "AR" },
    { type: "click",         selector: "#pais option:nth-of-type(2)" },
    { type: "click",         selector: "#provincia" },
    { type: "choose_option", selector: "#provincia",  value: "SF" },
    { type: "click",         selector: "#provincia option:nth-of-type(4)" }
  ]);

  const result = inlineStateLocal.normalizeInlineRecordedSteps(capturedSteps, true);

  const chooseOpts = result.filter((s) => s.type === "choose_option");
  assert.equal(chooseOpts.length, 2, "ambos choose_option deben estar presentes");
  assert.equal(chooseOpts[0].selector, "#pais");
  assert.equal(chooseOpts[1].selector, "#provincia");
  assert.ok(!result.some((s) => s.type === "click" && s.selector === "#pais"),      "sin click en #pais");
  assert.ok(!result.some((s) => s.type === "click" && s.selector === "#provincia"),  "sin click en #provincia");
  assert.ok(!result.some((s) => s.type === "click" && /option/.test(s.selector)),   "sin click en options");
});

test("block recorder: no pierde controlRef en merge (Escenario B completo)", () => {
  const inlineStateLocal = require("../../../../src/modules/editor/state/inline-recording-state.js");
  const RecorderLocal    = require("../../../../src/modules/recorder/recorder.js");

  // Escenario B: bloque que se agrega a una macro existente con controlRef en key Enter
  const capturedSteps = RecorderLocal.dedupeFieldRuns([
    { type: "input",  selector: "#dni", value: "12345678",
      controlRef: { selector: "#dni", tag: "input", type: "text" } },
    { type: "wait",   seconds: 1, _autoWait: true },
    { type: "key",    key: "Enter", selector: "#dni",
      controlRef: { selector: "#dni", tag: "input", type: "text" } },
    { type: "click",         selector: "#pais" },
    { type: "choose_option", selector: "#pais", value: "AR" },
    { type: "click",         selector: "#pais option:nth-of-type(2)" }
  ]);

  // Se agrega como nuevo bloque (asNewBlock = true)
  const result = inlineStateLocal.normalizeInlineRecordedSteps(capturedSteps, true);

  // controlRef del Enter debe sobrevivir sin alteraciones
  const keyStep = result.find((s) => s.type === "key");
  assert.ok(keyStep, "key step debe existir");
  assert.equal(keyStep.selector,           "#dni",  "selector del Enter no debe perderse");
  assert.ok(keyStep.controlRef,                     "controlRef no debe perderse");
  assert.equal(keyStep.controlRef.selector, "#dni",  "controlRef.selector debe conservarse");
  assert.equal(keyStep.controlRef.type,    "text",   "controlRef.type debe conservarse");

  // choose_option debe ser atómico
  const co = result.find((s) => s.type === "choose_option");
  assert.ok(co, "choose_option debe existir");
  assert.equal(co.selector, "#pais");
  assert.ok(!result.some((s) => s.type === "click" && /option/.test(s.selector)), "sin click en option");

  // Marcadores de bloque intactos
  assert.equal(result[0]._wmBlockStart, true);
});
