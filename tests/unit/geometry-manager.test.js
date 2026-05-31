const test = require("node:test");
const assert = require("node:assert/strict");

const geometry = require("../../src/modules/docking/geometry-manager.js");

test("Geometry: left layout usa ancho restante exacto", () => {
  const layout = geometry.calculateLayout(1920, 1080, 300, "left");
  assert.equal(layout.panel.width, 300);
  assert.equal(layout.browser.width, 1620);
  assert.equal(layout.browser.left, 300);
});

test("Geometry: validateLayout confirma sin huecos", () => {
  const layout = geometry.calculateLayout(1366, 768, 300, "right");
  const validation = geometry.validateLayout(layout, 1366, 768);
  assert.equal(validation.isValid, true);
  assert.equal(validation.totalWidth, 1366);
});