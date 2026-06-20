const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const win = new Window({ url: "https://example.com/" });
global.window = win;
global.document = win.document;
global.Element = win.Element;
global.HTMLElement = win.HTMLElement;
global.HTMLInputElement = win.HTMLInputElement;
global.HTMLLabelElement = win.HTMLLabelElement;
global.HTMLSelectElement = win.HTMLSelectElement;
global.Event = win.Event;
global.KeyboardEvent = win.KeyboardEvent;
global.MouseEvent = win.MouseEvent;
global.InputEvent = win.InputEvent;

const actionCheck = require("../../../../src/modules/player/actions/action-check.js");
const actionCheckRunner = require("../../../../src/modules/player/actions/action-check-runner.js");
const actionInputValue = require("../../../../src/modules/player/actions/action-input-value.js");
const actionSimpleEvents = require("../../../../src/modules/player/actions/action-simple-events.js");

test("action-input-value date helpers: validan y convierten fechas", () => {
  assert.equal(actionInputValue.isIsoDate("1990-05-20"), true);
  assert.equal(actionInputValue.isIsoDate("1990-15-20"), false);
  assert.equal(actionInputValue.isArgDate("20/05/1990"), true);
  assert.equal(actionInputValue.isArgDate("40/05/1990"), false);
  assert.equal(actionInputValue.isoToArgDate("1990-05-20"), "20/05/1990");
  assert.equal(actionInputValue.argDateToIso("20/05/1990"), "1990-05-20");
});

test("check false ejecutado dos veces sobre checkbox no debe volver a tildarlo", async () => {
  const otherWin = new Window({ url: "https://example.com/iframe" });
  const foreignCheckbox = otherWin.document.createElement("input");
  foreignCheckbox.type = "checkbox";
  foreignCheckbox.checked = false;

  let clicks = 0;
  const runOnce = () => new Promise((resolve, reject) => {
    actionCheckRunner.runCheckAction(
      { step: { checked: false }, el: foreignCheckbox, selector: "input[type=checkbox][name='vATTRIBUTESELECTED_0006']" },
      {
        resolve,
        reject,
        highlightElement: () => {},
        simulateClick: (el) => {
          clicks += 1;
          el.checked = !el.checked;
        },
        findCheckActivator: () => null,
        setCheckedNative: actionCheck.setCheckedNative,
        isInteractable: () => true,
        setTimeout: (fn) => fn(),
        HTMLInputElement
      }
    );
  });

  await runOnce();
  assert.equal(foreignCheckbox.checked, false);

  await runOnce();
  assert.equal(foreignCheckbox.checked, false);
  assert.equal(clicks, 0);
});

test("player action helpers preserve checkbox, radio, input and simple event behavior", async () => {
  document.body.innerHTML = `
    <label id="accept-label" for="accept">Aceptar</label>
    <input id="accept" type="checkbox">
    <label id="radio-label"><input id="choice" type="radio" name="choice"> Uno</label>
    <input id="name" type="text">
    <textarea id="notes"></textarea>
    <select id="city">
      <option value="ba">Buenos Aires</option>
      <option value="mdz">Mendoza</option>
    </select>
    <div id="rich" contenteditable="true"></div>
    <button id="target">Target</button>
  `;

  const checkbox = document.getElementById("accept");
  const label = document.getElementById("accept-label");
  const radio = document.getElementById("choice");
  const input = document.getElementById("name");
  const textarea = document.getElementById("notes");
  const select = document.getElementById("city");
  const rich = document.getElementById("rich");
  const target = document.getElementById("target");

  let inputEvents = 0;
  let changeEvents = 0;
  checkbox.addEventListener("input", () => { inputEvents += 1; });
  checkbox.addEventListener("change", () => { changeEvents += 1; });
  actionCheck.setCheckedNative(checkbox, true);
  assert.equal(checkbox.checked, true);
  assert.equal(inputEvents, 1);
  assert.equal(changeEvents, 1);

  assert.equal(actionCheck.findAssociatedCheckInput(label), checkbox);
  assert.equal(actionCheck.findCheckActivator(checkbox, { isInteractable: () => true }), label);
  assert.equal(actionCheck.findAssociatedCheckInput(document.getElementById("radio-label")), radio);
  assert.equal(
    actionCheck.findBestCheckTarget("#accept-label", {
      document,
      findElement: (selector) => document.querySelector(selector),
      isInteractable: () => true
    }),
    checkbox
  );

  let clicks = 0;
  let resolved = false;
  actionCheckRunner.runCheckAction(
    { step: { checked: true }, el: checkbox, selector: "#accept" },
    {
      resolve: () => { resolved = true; },
      reject: (error) => { throw error; },
      highlightElement: () => {},
      simulateClick: () => { clicks += 1; },
      findCheckActivator: actionCheck.findCheckActivator,
      setCheckedNative: actionCheck.setCheckedNative,
      isInteractable: () => true,
      setTimeout: (fn) => fn(),
      HTMLInputElement
    }
  );
  assert.equal(resolved, true);
  assert.equal(clicks, 0);

  let radioResolved = false;
  actionCheckRunner.runCheckAction(
    { step: { checked: true }, el: radio, selector: "#choice" },
    {
      resolve: () => { radioResolved = true; },
      reject: (error) => { throw error; },
      highlightElement: () => {},
      simulateClick: (el) => { el.checked = true; },
      findCheckActivator: actionCheck.findCheckActivator,
      setCheckedNative: actionCheck.setCheckedNative,
      isInteractable: () => true,
      setTimeout: (fn) => fn(),
      HTMLInputElement
    }
  );
  assert.equal(radio.checked, true);
  assert.equal(radioResolved, true);

  let textInputEvents = 0;
  input.addEventListener("input", () => { textInputEvents += 1; });
  actionInputValue.setInputValue(input, "Ana", { document });
  assert.equal(input.value, "Ana");
  assert.ok(textInputEvents >= 1);

  actionInputValue.setInputValue(textarea, "Linea", { document });
  assert.equal(textarea.value, "Linea");

  actionInputValue.setInputValue(select, "Mendoza", { document });
  assert.equal(select.value, "mdz");

  Object.defineProperty(rich, "isContentEditable", { value: true, configurable: true });
  actionInputValue.setInputValue(rich, "Texto rico", { document });
  assert.equal(rich.innerText, "Texto rico");

  let hovered = 0;
  target.addEventListener("mouseover", () => { hovered += 1; });
  assert.equal(actionSimpleEvents.handleSimpleElementAction({ type: "hover" }, target), true);
  assert.equal(hovered, 1);

  let scrollArgs = null;
  target.scrollIntoView = (args) => { scrollArgs = args; };
  assert.equal(actionSimpleEvents.handleSimpleElementAction({ type: "scroll_to" }, target), true);
  assert.deepEqual(scrollArgs, { behavior: "instant", block: "center" });
});

// ── Test G (rc18): player choose_option native select — setea value, dispara input+change, no necesita click ──

test("player [G]: choose_option sobre select nativo setea value y dispara input y change sin click en option", () => {
  document.body.innerHTML = `
    <select id="pais">
      <option value="">-- elegir --</option>
      <option value="AR">Argentina</option>
      <option value="BR">Brasil</option>
    </select>
  `;

  const sel = document.getElementById("pais");
  const eventsReceived = [];
  sel.addEventListener("input", () => eventsReceived.push("input"));
  sel.addEventListener("change", () => eventsReceived.push("change"));

  // setInputValue simula lo que hace el player al ejecutar choose_option
  actionInputValue.setInputValue(sel, "AR", { document });

  assert.equal(sel.value, "AR", "valor del select debe ser AR");
  assert.ok(eventsReceived.includes("change"), "debe disparar change");
  // No se necesita click en option: el valor se setea directamente
  assert.ok(!eventsReceived.includes("click"), "no debe requerir click");
});

test("player input[type=date]: acepta ISO y setea 1990-05-20", () => {
  document.body.innerHTML = '<input id="fecha" type="date">';
  const el = document.getElementById("fecha");

  actionInputValue.setInputValue(el, "1990-05-20", { document });
  assert.equal(el.value, "1990-05-20");
});

test("player input[type=date]: acepta DD/MM/YYYY y convierte a ISO", () => {
  document.body.innerHTML = '<input id="fecha" type="date">';
  const el = document.getElementById("fecha");

  actionInputValue.setInputValue(el, "20/05/1990", { document });
  assert.equal(el.value, "1990-05-20");
});

test("player input[type=date]: dispara input y change", () => {
  document.body.innerHTML = '<input id="fecha" type="date">';
  const el = document.getElementById("fecha");
  const events = [];
  el.addEventListener("input", () => events.push("input"));
  el.addEventListener("change", () => events.push("change"));

  actionInputValue.setInputValue(el, "20/05/1990", { document });

  assert.ok(events.includes("input"));
  assert.ok(events.includes("change"));
});

test("player input text normal con 1990-05-20 NO se convierte", () => {
  document.body.innerHTML = '<input id="nombre" type="text">';
  const el = document.getElementById("nombre");

  actionInputValue.setInputValue(el, "1990-05-20", { document });
  assert.equal(el.value, "1990-05-20");
});

test("player input text normal con 20/05/1990 NO se convierte", () => {
  document.body.innerHTML = '<input id="nombre" type="text">';
  const el = document.getElementById("nombre");

  actionInputValue.setInputValue(el, "20/05/1990", { document });
  assert.equal(el.value, "20/05/1990");
});

test("player input email/tel/url/number no se rompen con soporte date", () => {
  document.body.innerHTML = `
    <input id="mail" type="email">
    <input id="tel" type="tel">
    <input id="url" type="url">
    <input id="num" type="number">
  `;

  const mail = document.getElementById("mail");
  const tel = document.getElementById("tel");
  const url = document.getElementById("url");
  const num = document.getElementById("num");

  actionInputValue.setInputValue(mail, "ana@test.com", { document });
  actionInputValue.setInputValue(tel, "+54911223344", { document });
  actionInputValue.setInputValue(url, "https://example.com", { document });
  actionInputValue.setInputValue(num, "42", { document });

  assert.equal(mail.value, "ana@test.com");
  assert.equal(tel.value, "+54911223344");
  assert.equal(url.value, "https://example.com");
  assert.equal(num.value, "42");
});
