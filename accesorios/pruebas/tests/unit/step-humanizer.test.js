const test = require("node:test");
const assert = require("node:assert/strict");

const humanizer = require("../../../../src/modules/editor/presentation/step-humanizer.js");

test("humanizeStep: input genera accion humana con valor y campo", () => {
  const label = humanizer.humanizeStep({
    type: "input",
    value: "Juan",
    selector: "#vNOMBRE",
    controlRef: { label: "Nombre" }
  });

  assert.equal(label, 'Escribir "Juan" en "Nombre"');
});

test("humanizeStep: check false genera Destildar", () => {
  const label = humanizer.humanizeStep({
    type: "check",
    checked: false,
    selector: "#vVERBAJAS"
  });

  assert.equal(label, 'Destildar "Ver bajas"');
});

test("humanizeStep: check true genera Tildar", () => {
  const label = humanizer.humanizeStep({
    type: "check",
    checked: true,
    selector: "#vREQCOMPRA"
  });

  assert.equal(label, 'Tildar "Req compra"');
});

test("humanizeStep: choose_option genera Elegir con opcion y campo", () => {
  const label = humanizer.humanizeStep({
    type: "choose_option",
    text: "Requiere Auditoria Medica",
    selector: "#vNFLGVISTA"
  });

  assert.equal(label, 'Elegir "Requiere Auditoria Medica" en "Vista"');
});

test("humanizeTarget: limpia identificadores tecnicos simples", () => {
  assert.equal(humanizer.humanizeTarget({ selector: "#vATTRIBUTESELECTED_0006" }), "Atributo 0006");
});
