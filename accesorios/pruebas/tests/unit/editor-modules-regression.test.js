const test = require("node:test");
const assert = require("node:assert/strict");

const stepDefinitions = require("../../../../src/modules/editor/schema/step-definitions.js");
const editorStateUtils = require("../../../../src/modules/editor/state/editor-state-utils.js");
const blockUtils = require("../../../../src/modules/editor/blocks/block-utils.js");

test("editor helper modules preserve labels, add-form state and execution block boundaries", () => {
  assert.equal(stepDefinitions.shortLabel({ type: "navigate", url: "https://example.com" }), "https://example.com");
  assert.equal(stepDefinitions.shortLabel({ type: "check", selector: "#ok", checked: true }), "#ok ✔");
  assert.equal(stepDefinitions.shortLabel({ type: "capture_defaults", exclude: "#keep" }), "excepto #keep");
  assert.ok(stepDefinitions.STEP_TYPES.some((type) => type.value === "drag_drop"));

  assert.equal(editorStateUtils.clampAddFormTargetIndex(-3, 5), 0);
  assert.equal(editorStateUtils.clampAddFormTargetIndex(8, 5), 5);
  assert.deepEqual(editorStateUtils.openAddFormState(2, 5, true), {
    addFormOpen: true,
    addFormTargetIndex: 2,
    addFormAsNewBlock: true
  });
  assert.deepEqual(editorStateUtils.closeAddFormState(), {
    addFormOpen: false,
    addFormTargetIndex: null,
    addFormAsNewBlock: false
  });

  const movedMeta = new WeakMap();
  const stepRef = { type: "click" };
  editorStateUtils.markStepMoved(movedMeta, stepRef, "unit");
  assert.equal(movedMeta.get(stepRef).source, "unit");

  const steps = [
    { type: "navigate", _wmBlockKey: "example.com/a" },
    { type: "click", selector: "#one", _wmBlockKey: "example.com/a" },
    { type: "switch_tab", _wmBlockKey: "example.com/b" },
    { type: "click", selector: "#two", _wmBlockKey: "example.com/b" }
  ];

  assert.deepEqual(blockUtils.findExecutionBlockBounds(steps, 1), { start: 0, end: 1 });
  assert.deepEqual(blockUtils.findExecutionBlockBounds(steps, 2), { start: 2, end: 3 });
  assert.equal(blockUtils.getExecutionBlockOrdinal(steps, 3), 2);

  const meta = blockUtils.buildExecutionBlockContextMeta(steps);
  assert.equal(meta.get(0).contextLabel, "example.com/a");
  assert.equal(meta.get(2).contextLabel, "example.com/b");
  assert.deepEqual(blockUtils.collectCollapsibleBlockKeys(steps), ["0:1", "2:3"]);
});
