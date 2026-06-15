const test = require("node:test");
const assert = require("node:assert/strict");

const macroJson = require("../../../../src/modules/storage/macro-json.js");

test("macro-json: exporta envelope con macro y meta.pageInventories", () => {
  const payload = macroJson.createMacroPayload({
    name: "Macro Prueba",
    steps: [{ type: "input", selector: "#a", value: "x", _ts: 123 }],
    meta: {
      pageInventories: [{
        url: "https://example.com",
        controls: [{ id: "delegacion", name: "delegacion", controlKind: "native-select", options: [{ value: "1", text: "A" }] }]
      }]
    },
    createdAt: 1700000000000
  });

  assert.equal(payload.app, "WebMatic");
  assert.equal(payload.kind, "macro");
  assert.equal(payload.macro.name, "Macro Prueba");
  assert.equal(payload.macro.steps.length, 1);
  assert.equal(payload.macro.steps[0]._ts, undefined);
  assert.equal(payload.macro.meta.pageInventories.length, 1);
});

test("macro-json: parsea JSON envelope y recupera meta", () => {
  const raw = JSON.stringify({
    version: 1,
    app: "WebMatic",
    kind: "macro",
    macro: {
      name: "Importada",
      steps: [{ type: "choose_option", selector: "#b", value: "2" }],
      meta: { pageInventories: [{ controls: [{ selector: "#b", options: [{ value: "2", text: "B" }] }] }] }
    }
  });
  const parsed = macroJson.parseMacroJson(raw);
  assert.equal(parsed.name, "Importada");
  assert.equal(parsed.steps.length, 1);
  assert.equal(parsed.meta.pageInventories.length, 1);
});

test("macro-json: soporta JSON plano de macro por compat", () => {
  const raw = JSON.stringify({
    name: "Plano",
    steps: [{ type: "click", selector: "#ok" }],
    meta: { pageInventories: [] }
  });
  const parsed = macroJson.parseMacroJson(raw);
  assert.equal(parsed.name, "Plano");
  assert.equal(parsed.steps[0].type, "click");
});

test("macro-json: falla con JSON sin steps", () => {
  assert.throws(() => macroJson.parseMacroJson('{"foo":1}'));
});

test("macro-json: no exporta valores sensibles en steps", () => {
  const payload = macroJson.createMacroPayload({
    name: "Macro segura",
    steps: [
      { type: "input", selector: "#password", value: "SECRET_SHOULD_NOT_LEAK_2026" },
      { type: "input", selector: "#csrf_token", value: "SECRET_SHOULD_NOT_LEAK_2026" },
      { type: "input", selector: "#usuario", value: "normal" }
    ]
  });

  const asText = JSON.stringify(payload);
  assert.ok(!asText.includes("SECRET_SHOULD_NOT_LEAK_2026"), "el secreto no debe aparecer en JSON exportado");
  assert.equal(payload.macro.steps[0].value, "");
  assert.equal(payload.macro.steps[0].sensitive, true);
  assert.equal(payload.macro.steps[1].value, "");
  assert.equal(payload.macro.steps[2].value, "normal");
});
