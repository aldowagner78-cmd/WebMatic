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
