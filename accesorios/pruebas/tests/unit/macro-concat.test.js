const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const concat = require("../../../../src/modules/storage/macro-concat.js");
require("../../../../src/modules/storage/iim-adapter.js");
const adapter = globalThis.WebMaticIimAdapter;

const ROOT = path.join(__dirname, "../../../..");

function readRepoJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8").replace(/^\uFEFF/, ""));
}

test("macro concat: A + B produce steps en orden y conserva pasos especiales", () => {
  const base = {
    id: "a",
    name: "A",
    steps: [
      { type: "input", selector: "#q", value: "hola" },
      { type: "key", key: "Enter", selector: "#q", controlRef: { selector: "#q" } }
    ]
  };
  const extra = {
    id: "b",
    name: "B",
    steps: [
      { type: "choose_option", selector: "#pais", value: "ar", text: "Argentina" },
      { type: "check", selector: "#ok", checked: true },
      { type: "input", selector: "#password", value: "secreto", inputType: "password" }
    ]
  };

  const macro = concat.buildConcatenatedMacro({
    baseMacro: base,
    appendMacros: [extra],
    iimAdapter: adapter,
    now: () => 1000,
    random: () => 0.1234
  });

  assert.equal(macro.id, "macro_1000_1234");
  assert.equal(macro.name, "A + B");
  assert.deepEqual(macro.steps.map((step) => step.type), ["input", "key", "choose_option", "check", "input"]);
  assert.equal(macro.steps[1].selector, "#q");
  assert.equal(macro.steps[2].type, "choose_option");
  assert.equal(macro.steps[3].checked, true);
  assert.ok(macro.script.includes('KEY CODE="Enter"'));
  assert.ok(macro.script.includes('CHOOSE_OPTION SELECTOR="#pais" VALUE="ar"'));
  assert.ok(macro.script.includes('CHECK SELECTOR="#ok" CHECKED="true"'));
  assert.equal(macro.script.includes("secreto"), false);
});

test("macro concat: re-exporta fecha visible DD/MM/YYYY y conserva WM_JSON ISO", () => {
  const base = {
    id: "a",
    name: "Fecha",
    steps: [{ type: "input", selector: "#fecha-nac", value: "1990-05-20" }],
    meta: {
      pageInventories: [{
        url: "https://example.test/",
        controls: [{ selector: "#fecha-nac", type: "date" }]
      }]
    }
  };
  const extra = {
    id: "b",
    name: "Enviar",
    steps: [{ type: "key", key: "Enter", selector: "#fecha-nac" }]
  };

  const macro = concat.buildConcatenatedMacro({
    baseMacro: base,
    appendMacros: [extra],
    name: "Fecha + Enter",
    iimAdapter: adapter,
    now: () => 2000,
    random: () => 0.2
  });

  assert.ok(macro.script.includes('TYPE SELECTOR="#fecha-nac" CONTENT="20/05/1990"'));
  const wmJsonLine = macro.script.split("\n").find((line) => line.startsWith("// WM_JSON:"));
  const parsed = JSON.parse(wmJsonLine.slice("// WM_JSON:".length));
  assert.equal(parsed.steps[0].value, "1990-05-20");
  assert.equal(parsed.meta.pageInventories[0].controls[0].type, "date");
});

test("macro concat: soporta macro antigua con script y manifiesto carga antes de content", () => {
  const script = adapter.exportToIim({ steps: [{ type: "input", selector: "#legacy", value: "ok" }] });
  const macro = concat.buildConcatenatedMacro({
    baseMacro: { id: "a", name: "A", steps: [{ type: "click", selector: "#a" }] },
    appendMacros: [{ id: "old", name: "Legacy", script }],
    iimAdapter: adapter,
    now: () => 3000,
    random: () => 0.3
  });

  assert.deepEqual(macro.steps.map((step) => step.selector), ["#a", "#legacy"]);

  const manifest = readRepoJson("manifest.json");
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf("src/modules/storage/macro-concat.js") < scripts.indexOf("src/content/content.js"));
  assert.ok(scripts.indexOf("src/modules/ui/macro-concat-dialog.js") < scripts.indexOf("src/content/content.js"));
});
