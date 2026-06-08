const test = require("node:test");
const assert = require("node:assert/strict");

const genexus = require("../../../../src/modules/controls/genexus-autocomplete.js");

test("genexus-autocomplete: parsea tuplas c/d con comillas dobles y simples", () => {
    const raw = [
      '{c:"54",d:"ALVEAR"}',
      "{c:'55',d:'BELGRANO'}"
    ].join("\n");

    const out = genexus.parseGeneXusOptionTuples(raw);

    assert.deepEqual(out, [
      { value: "54", text: "ALVEAR" },
      { value: "55", text: "BELGRANO" }
    ]);
  });

test("genexus-autocomplete: extrae bloque de validacion tipo [codigo,texto,[]]", () => {
    const raw = '["54","ALVEAR","[]"]';
    const parsed = genexus.parseGeneXusValidation(raw);
    assert.deepEqual(parsed, { code: "54", text: "ALVEAR" });
  });

test("genexus-autocomplete: parsePayload combina opciones y validaciones", () => {
    const raw = '{c:"54",d:"ALVEAR"}\n["54","ALVEAR","[]"]';
    const out = genexus.parsePayload(raw);

    assert.equal(out.options.length, 1);
    assert.equal(out.validations.length, 1);
    assert.deepEqual(out.options[0], { value: "54", text: "ALVEAR" });
    assert.deepEqual(out.validations[0], { code: "54", text: "ALVEAR" });
  });
