const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const diagnostics = require("../../../../src/common/diagnostics/actionability-diagnostics.js");
const selectorDiagnostics = require("../../../../src/common/diagnostics/selector-diagnostics.js");

function setup(html) {
  const win = new Window({ url: "https://example.test/" });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.Element = win.Element;
  globalThis.HTMLElement = win.HTMLElement;
  win.document.body.innerHTML = html;
  return win.document;
}

test("actionability-diagnostics: diagnostica hidden", () => {
  const doc = setup('<button id="save" hidden>Guardar</button>');
  const result = diagnostics.diagnoseCandidateActionability(doc.querySelector("#save"), { actionType: "click" });

  assert.equal(result.actionable, false);
  assert.ok(result.codes.includes("hidden"));
  assert.match(result.developerMessage, /Candidato no confiable/);
});

test("actionability-diagnostics: diagnostica aria-hidden en ancestro", () => {
  const doc = setup('<div aria-hidden="true"><button id="next">Siguiente</button></div>');
  const result = diagnostics.diagnoseCandidateActionability(doc.querySelector("#next"), { actionType: "click" });

  assert.equal(result.actionable, false);
  assert.ok(result.codes.includes("aria_hidden_ancestor"));
});

test("actionability-diagnostics: diagnostica disabled", () => {
  const doc = setup('<button id="send" disabled>Enviar</button>');
  const result = diagnostics.diagnoseCandidateActionability(doc.querySelector("#send"), { actionType: "click" });

  assert.equal(result.actionable, false);
  assert.ok(result.codes.includes("disabled"));
});

test("actionability-diagnostics: diagnostica readonly para type", () => {
  const doc = setup('<input id="email" readonly value="viejo">');
  const result = diagnostics.diagnoseCandidateActionability(doc.querySelector("#email"), { actionType: "type" });

  assert.equal(result.actionable, false);
  assert.ok(result.codes.includes("readonly_for_write"));
});

test("actionability-diagnostics: diagnostica multiples candidatos accionables", () => {
  const doc = setup(`
    <button class="save" id="one">Guardar</button>
    <button class="save" id="two">Guardar</button>
  `);
  const result = diagnostics.diagnoseActionabilityCandidates(Array.from(doc.querySelectorAll(".save")), { actionType: "click" });

  assert.equal(result.reliable, false);
  assert.equal(result.actionableCount, 2);
  assert.ok(result.codes.includes("multiple_actionable_candidates"));
});

test("actionability-diagnostics: diagnostico no expone valor de password/token", () => {
  const doc = setup('<input id="api-token-field" name="apiToken" type="password" value="super-secret-token-123">');
  const result = diagnostics.diagnoseActionabilityCandidates([{
    selector: 'input[name="apiToken"]',
    element: doc.querySelector("input")
  }], { actionType: "type" });
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(serialized, /super-secret-token-123/);
  assert.doesNotMatch(serialized, /apiToken/);
  assert.match(serialized, /\[redacted-sensitive\]/);
});

test("selector-diagnostics: resumen sanitizado no expone valores sensibles", () => {
  const doc = setup('<input id="user-password" name="password" type="password" value="plain-secret">');
  const summary = selectorDiagnostics.summarizeElementForDiagnostic(doc.querySelector("input"));
  const serialized = JSON.stringify(summary);

  assert.doesNotMatch(serialized, /plain-secret/);
  assert.doesNotMatch(serialized, /user-password/);
  assert.doesNotMatch(serialized, /"password"/);
  assert.match(serialized, /\[redacted-sensitive\]/);
});

test("actionability-diagnostics: genera salida entendible para desarrollador", () => {
  const doc = setup('<button id="legacy" hidden>Continuar</button>');
  const result = diagnostics.diagnoseCandidateActionability(doc.querySelector("#legacy"), { actionType: "click" });

  assert.equal(typeof result.developerMessage, "string");
  assert.match(result.developerMessage, /hidden/);
  assert.equal(result.reasons[0].message, "El candidato tiene atributo hidden.");
  assert.equal(result.summary.tag, "button");
});
