const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createChromeMock,
  createDomHarness,
  freshRequire,
  loadFixture
} = require("../helpers/browser-harness.js");

function boot(fixture) {
  createDomHarness({ url: "https://qa.example.test/form", html: loadFixture(fixture) });
  createChromeMock();
  return freshRequire("../../../../src/modules/player/player.js");
}

function runSteps(Player, steps, vars, opts) {
  return new Promise((resolve) => {
    const player = new Player({ retryMs: 10, timeoutMs: 250, ...(opts || {}) });
    const runtimeVars = vars || {};
    player.play(Array.isArray(steps) ? steps : [steps], {
      vars: runtimeVars,
      speed: 1,
      onDone: (summary) => resolve({ ok: true, vars: runtimeVars, summary }),
      onError: (error) => resolve({ ok: false, error: error && error.message ? error.message : String(error), vars: runtimeVars })
    });
  });
}

test("player fixture: reproduce input, textarea, contenteditable y variables", async () => {
  const Player = boot("qa/basic-form.html");
  const result = await runSteps(Player, [
    { type: "input", selector: "#basic-name", value: "Hola %USER%" },
    { type: "input", selector: "#basic-notes", value: "Linea 1" },
    { type: "input", selector: "#basic-rich", value: "Editable" }
  ], { USER: "Ana" });

  assert.equal(result.ok, true, result.error);
  assert.equal(document.querySelector("#basic-name").value, "Hola Ana");
  assert.equal(document.querySelector("#basic-notes").value, "Linea 1");
  assert.equal(document.querySelector("#basic-rich").innerText, "Editable");
});

test("player fixture: checkbox visible es idempotente para marcar y desmarcar", async () => {
  const Player = boot("qa/basic-form.html");
  const checkbox = document.querySelector("#basic-check");

  let result = await runSteps(Player, { type: "check", selector: "#basic-check", checked: true });
  assert.equal(result.ok, true, result.error);
  assert.equal(checkbox.checked, true);

  result = await runSteps(Player, { type: "check", selector: "#basic-check", checked: true });
  assert.equal(result.ok, true, result.error);
  assert.equal(checkbox.checked, true);

  result = await runSteps(Player, { type: "check", selector: "#basic-check", checked: false });
  assert.equal(result.ok, true, result.error);
  assert.equal(checkbox.checked, false);
});

test("player fixture: checkbox y radio ocultos se activan por labels y roles", async () => {
  const Player = boot("qa/labelled-controls.html");
  const result = await runSteps(Player, [
    { type: "check", selector: "#wrap-check-label", checked: true },
    { type: "check", selector: "#for-check-label", checked: true },
    { type: "check", selector: "#for-radio-label", checked: true },
    { type: "check", selector: "#role-check", checked: true },
    { type: "check", selector: "#role-radio", checked: true }
  ]);

  assert.equal(result.ok, true, result.error);
  assert.equal(document.querySelector("#hidden-wrap-check").checked, true);
  assert.equal(document.querySelector("#hidden-for-check").checked, true);
  assert.equal(document.querySelector("#hidden-for-radio").checked, true);
  assert.equal(document.querySelector("#role-check-input").checked, true);
  assert.equal(document.querySelector("#role-radio-input").checked, true);
});

test("player fixture: radio visible selecciona una opcion sin romper idempotencia", async () => {
  const Player = boot("qa/basic-form.html");
  let result = await runSteps(Player, { type: "check", selector: "#basic-radio-b", checked: true });
  assert.equal(result.ok, true, result.error);
  assert.equal(document.querySelector("#basic-radio-b").checked, true);

  result = await runSteps(Player, { type: "check", selector: "#basic-radio-b", checked: true });
  assert.equal(result.ok, true, result.error);
  assert.equal(document.querySelector("#basic-radio-b").checked, true);
});

test("player fixture: choose_option selecciona por value, texto visible y variable", async () => {
  const Player = boot("qa/basic-form.html");
  let result = await runSteps(Player, { type: "choose_option", selector: "#basic-city", value: "mdz", variable: "CITY" });
  assert.equal(result.ok, true, result.error);
  assert.equal(document.querySelector("#basic-city").value, "mdz");
  assert.equal(result.vars.CITY, "mdz");

  result = await runSteps(Player, { type: "choose_option", selector: "#basic-city", text: "Buenos Aires" });
  assert.equal(result.ok, true, result.error);
  assert.equal(document.querySelector("#basic-city").value, "ba");
});

test("player fixture: choose_option falla de forma controlada si la opcion no existe", async () => {
  const Player = boot("qa/basic-form.html");
  const result = await runSteps(Player, { type: "choose_option", selector: "#basic-city", value: "ros" });
  assert.equal(result.ok, false);
  assert.match(result.error, /opci.n no encontrada/i);
});

test("player fixture: click, dblclick, extract y wait_for funcionan sobre fixture", async () => {
  const Player = boot("qa/basic-form.html");
  let clicks = 0;
  let dblclicks = 0;
  document.querySelector("#basic-submit").addEventListener("click", () => { clicks += 1; });
  document.querySelector("#basic-submit").addEventListener("dblclick", () => { dblclicks += 1; });

  const result = await runSteps(Player, [
    { type: "wait_for", selector: "#basic-submit", timeout: 100 },
    { type: "click", selector: "#basic-submit" },
    { type: "dblclick", selector: "#basic-submit" },
    { type: "extract", selector: "#basic-output", variable: "OUT" },
    { type: "input", selector: "#basic-name", value: "Valor" },
    { type: "extract", selector: "#basic-name", variable: "NAME" }
  ]);

  assert.equal(result.ok, true, result.error);
  assert.equal(clicks >= 1, true);
  assert.equal(dblclicks, 1);
  assert.equal(result.vars.OUT, "Resultado listo");
  assert.equal(result.vars.NAME, "Valor");
});

test("player fixture: wait_for timeout inexistente devuelve error controlado", async () => {
  const Player = boot("qa/basic-form.html");
  const result = await runSteps(Player, { type: "wait_for", selector: "#no-existe", timeout: 50 }, {}, { timeoutMs: 150 });
  assert.equal(result.ok, false);
  assert.match(result.error, /wait_for/i);
});
