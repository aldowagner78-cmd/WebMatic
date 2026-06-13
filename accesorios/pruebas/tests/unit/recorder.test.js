const test = require("node:test");
const assert = require("node:assert/strict");
const { Window } = require("happy-dom");

const win = new Window({ url: "https://example.com/" });
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

test("buildSelector: prefers data-testid over dynamic id", () => {
  resetBody('<button id="btn_abc_123_20260613" data-testid="approve-button">Authorize</button>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), '[data-testid="approve-button"]');
});

test("buildSelector: prefers aria-label over dynamic id", () => {
  resetBody('<button id="x9f8a7_20260613" aria-label="Authorize request">OK</button>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), '[aria-label="Authorize request"]');
});

test("buildSelector: prefers title over dynamic id", () => {
  resetBody('<button id="btn_random_998877" title="Authorize">A</button>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), '[title="Authorize"]');
});

test("buildSelector: duplicate names use stable parent context", () => {
  resetBody(`
    <div id="form-a"><input name="codigo"></div>
    <div id="form-b"><input name="codigo"></div>
  `);
  const el = win.document.querySelector("#form-a input");
  assert.equal(Recorder.buildSelector(el), '#form-a input[name="codigo"]');
});

test("buildSelector: gxrow + title for GeneXus row actions", () => {
  resetBody('<table><tr gxrow="0001"><td><button title="Authorize">Authorize</button></td></tr></table>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), '[gxrow="0001"] [title="Authorize"]');
});

test("buildSelector: avoids dynamic data-* and falls back to visible text", () => {
  resetBody('<button data-reactid=".0.1" data-v-f3a9b0="x">Approve now</button>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), 'button[text="Approve now"]');
});

test("buildSelector: avoids text fallback when duplicated and keeps controlled fallback", () => {
  resetBody(`
    <div id="box">
      <button>Confirm</button>
      <button>Confirm</button>
    </div>
  `);
  const second = win.document.querySelectorAll("button")[1];
  const selector = Recorder.buildSelector(second);
  assert.ok(!selector.includes('[text="Confirm"]'));
  assert.equal(selector, "#box button:nth-of-type(2)");
});

test("buildSelector: dom mutation keeps stable selector", () => {
  resetBody('<button id="btn_123_20260613" data-testid="approve-button">Authorize</button>');
  const first = win.document.querySelector("button");
  const firstSelector = Recorder.buildSelector(first);

  win.document.body.innerHTML = '<button id="btn_889_20260614" data-testid="approve-button">Authorize</button>';
  const second = win.document.querySelector("button");
  const secondSelector = Recorder.buildSelector(second);

  assert.equal(firstSelector, '[data-testid="approve-button"]');
  assert.equal(secondSelector, '[data-testid="approve-button"]');
});

test("buildSelector: keeps stable simple id", () => {
  resetBody('<input id="login" type="text">');
  const el = win.document.querySelector("input");
  assert.equal(Recorder.buildSelector(el), "#login");
});

test("buildSelector: keeps unique name selector", () => {
  resetBody('<input name="email" type="text">');
  const el = win.document.querySelector("input");
  assert.equal(Recorder.buildSelector(el), 'input[name="email"]');
});

test("buildSelector: keeps short stable href", () => {
  resetBody('<a href="/orders/active">Open</a>');
  const el = win.document.querySelector("a");
  assert.equal(Recorder.buildSelector(el), 'a[href="/orders/active"]');
});

test("buildSelector: keeps final class+nth fallback", () => {
  resetBody(`
    <section>
      <button class="cta"> </button>
      <button class="cta"> </button>
    </section>
  `);
  const second = win.document.querySelectorAll("button")[1];
  assert.equal(Recorder.buildSelector(second), "button.cta:nth-of-type(2)");
});

test("buildSelector: dynamic id is used only as last resort when no stable alternative exists", () => {
  resetBody('<div><button id="btn_9a8b7c_20260613"></button></div>');
  const el = win.document.querySelector("button");
  assert.equal(Recorder.buildSelector(el), "#btn_9a8b7c_20260613");
});
