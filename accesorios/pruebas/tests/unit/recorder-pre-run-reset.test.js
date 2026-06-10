const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const win = new Window({ url: "https://example.com/form" });
globalThis.window = win;
globalThis.document = win.document;
globalThis.Element = win.Element;
globalThis.HTMLElement = win.HTMLElement;
globalThis.HTMLInputElement = win.HTMLInputElement;
globalThis.HTMLTextAreaElement = win.HTMLTextAreaElement;
globalThis.HTMLSelectElement = win.HTMLSelectElement;

const Recorder = require("../../../../src/modules/recorder/recorder.js");

function resetBody(html) {
  win.document.body.innerHTML = html;
}

test("preRunReset capture: grabacion silenciosa sin eventos visibles", () => {
  resetBody(`
    <input id="txt" type="text" value="ABC" />
    <input id="chk" type="checkbox" checked />
    <select id="sel"><option value="a">A</option><option value="b" selected>B</option></select>
  `);

  const txt = win.document.getElementById("txt");
  const chk = win.document.getElementById("chk");
  const sel = win.document.getElementById("sel");

  const counts = {
    txt: { click: 0, focus: 0, input: 0, change: 0 },
    chk: { click: 0, focus: 0, input: 0, change: 0 },
    sel: { click: 0, focus: 0, input: 0, change: 0 }
  };

  txt.addEventListener("click", () => { counts.txt.click += 1; });
  txt.addEventListener("focus", () => { counts.txt.focus += 1; });
  txt.addEventListener("input", () => { counts.txt.input += 1; });
  txt.addEventListener("change", () => { counts.txt.change += 1; });

  chk.addEventListener("click", () => { counts.chk.click += 1; });
  chk.addEventListener("focus", () => { counts.chk.focus += 1; });
  chk.addEventListener("input", () => { counts.chk.input += 1; });
  chk.addEventListener("change", () => { counts.chk.change += 1; });

  sel.addEventListener("click", () => { counts.sel.click += 1; });
  sel.addEventListener("focus", () => { counts.sel.focus += 1; });
  sel.addEventListener("input", () => { counts.sel.input += 1; });
  sel.addEventListener("change", () => { counts.sel.change += 1; });

  const baseline = Recorder.captureInitialPreRunReset(
    win.document,
    win.location.href,
    win.document.title,
    Recorder.buildSelector
  );

  assert.ok(baseline && Array.isArray(baseline.controls));
  assert.equal(baseline.controls.length, 3);

  const bySelector = Object.fromEntries(baseline.controls.map((c) => [c.selector, c]));
  assert.equal(bySelector["#txt"].value, "ABC");
  assert.equal(bySelector["#chk"].checked, true);
  assert.equal(bySelector["#sel"].value, "b");

  assert.deepEqual(counts, {
    txt: { click: 0, focus: 0, input: 0, change: 0 },
    chk: { click: 0, focus: 0, input: 0, change: 0 },
    sel: { click: 0, focus: 0, input: 0, change: 0 }
  });
});

test("preRunReset capture: no guarda value para campos sensibles", () => {
  resetBody('<input id="passwordField" type="password" value="secret" />');

  const baseline = Recorder.captureInitialPreRunReset(
    win.document,
    win.location.href,
    win.document.title,
    Recorder.buildSelector
  );

  assert.ok(baseline && baseline.controls.length === 1);
  assert.equal(baseline.controls[0].selector, "#passwordField");
  assert.ok(!Object.prototype.hasOwnProperty.call(baseline.controls[0], "value"));
});
