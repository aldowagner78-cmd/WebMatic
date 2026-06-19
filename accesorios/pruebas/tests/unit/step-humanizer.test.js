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

test("humanizeTarget: normaliza prefijo Btn sin mostrarlo crudo", () => {
  assert.equal(humanizer.humanizeTarget({ controlRef: { label: "Btn Enviar" } }), "Enviar");
  assert.equal(humanizer.humanizeTarget({ selector: "#BTN_ENVIAR" }), "Enviar");
  assert.equal(humanizer.humanizeTarget({ selector: "#btn-enviar" }), "Enviar");
});

test("humanizeTarget: normaliza mayusculas raras a estilo oracion", () => {
  assert.equal(humanizer.humanizeTarget({ controlRef: { label: "Correo Electr\u00d3Nico" } }), "Correo electr\u00f3nico");
  assert.equal(humanizer.humanizeTarget({ selector: "#correoElectronico" }), "Correo electronico");
});

test("humanizeTarget: normaliza prefijos de formulario y siglas", () => {
  assert.equal(humanizer.humanizeTarget({ selector: "#t1-dni" }), "DNI");
  assert.equal(humanizer.humanizeTarget({ selector: "#t2-calle" }), "Calle");
  assert.equal(humanizer.humanizeTarget({ selector: "#t3-nro" }), "Nro");
});

test("humanizeStep: click con label Btn Enviar no muestra Btn crudo", () => {
  const label = humanizer.humanizeStep({
    type: "click",
    controlRef: { label: "Btn Enviar" }
  });

  assert.equal(label, 'Hacer clic en "Enviar"');
});

test("humanizeStep: wait_for usa label humano normalizado", () => {
  const label = humanizer.humanizeStep({
    type: "wait_for",
    controlRef: { label: "Correo Electr\u00d3Nico" }
  });

  assert.equal(label, 'Esperar a que aparezca "Correo electr\u00f3nico"');
});
