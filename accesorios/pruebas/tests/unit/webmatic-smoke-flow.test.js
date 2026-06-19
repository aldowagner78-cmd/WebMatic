const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createChromeMock,
  createDomHarness,
  freshRequire,
  loadFixture
} = require("../helpers/browser-harness.js");

function runMacro(Player, steps, vars) {
  return new Promise((resolve) => {
    const runtimeVars = vars || {};
    const player = new Player({ retryMs: 10, timeoutMs: 300 });
    player.play(steps, {
      vars: runtimeVars,
      speed: 1,
      onDone: (summary) => resolve({ ok: true, vars: runtimeVars, summary }),
      onError: (error) => resolve({ ok: false, error: error && error.message ? error.message : String(error), vars: runtimeVars })
    });
  });
}

test("webmatic smoke flow: fixture local reproduce macro y verifica DOM final", async () => {
  createDomHarness({ url: "https://qa.example.test/smoke", html: loadFixture("qa/basic-form.html") });
  createChromeMock();
  const Player = freshRequire("../../../../src/modules/player/player.js");

  let clicked = 0;
  document.querySelector("#basic-submit").addEventListener("click", () => {
    clicked += 1;
    document.querySelector("#basic-output").textContent = "Procesado";
  });

  const result = await runMacro(Player, [
    { type: "input", selector: "#basic-name", value: "Macro QA" },
    { type: "check", selector: "#basic-check", checked: true },
    { type: "choose_option", selector: "#basic-city", value: "mdz", variable: "CITY" },
    { type: "click", selector: "#basic-submit" },
    { type: "extract", selector: "#basic-output", variable: "OUT" }
  ]);

  assert.equal(result.ok, true, result.error);
  assert.equal(document.querySelector("#basic-name").value, "Macro QA");
  assert.equal(document.querySelector("#basic-check").checked, true);
  assert.equal(document.querySelector("#basic-city").value, "mdz");
  assert.equal(result.vars.CITY, "mdz");
  assert.equal(result.vars.OUT, "Procesado");
  assert.equal(clicked, 1);
});
