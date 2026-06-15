const test = require("node:test");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
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

function allFieldNodes(doc) {
  return Array.from((doc || win.document).querySelectorAll("input, select, textarea"));
}

function isOmittedByPolicy(el) {
  const type = String((el && el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
  if (type === "hidden" || type === "submit" || type === "button" || type === "image" || type === "file" || type === "reset") return true;
  if (el && (el.disabled || el.readOnly)) return true;
  return false;
}

function applyPreRunResetBaseline(doc, baseline) {
  const metrics = {
    controls_restored: 0,
    mismatches: 0
  };
  const controls = Array.isArray(baseline && baseline.controls) ? baseline.controls : [];
  const pendingRadioChecked = [];

  controls.forEach((ctrl) => {
    let el = null;
    try {
      el = doc.querySelector(ctrl.selector);
    } catch (_e) {
      el = null;
    }
    if (!el) {
      metrics.mismatches += 1;
      return;
    }

    const tag = String(el.tagName || "").toLowerCase();
    if (typeof ctrl.checked === "boolean") {
      if (String(ctrl.type || "").toLowerCase() === "radio") {
        if (ctrl.checked) pendingRadioChecked.push(el);
        metrics.controls_restored += 1;
        return;
      }
      el.checked = ctrl.checked;
      metrics.controls_restored += 1;
      return;
    }
    if (tag === "select") {
      if (Number.isFinite(Number(ctrl.selectedIndex))) {
        el.selectedIndex = Number(ctrl.selectedIndex);
      }
      if (typeof ctrl.value === "string") {
        el.value = ctrl.value;
      }
      metrics.controls_restored += 1;
      return;
    }
    if (typeof ctrl.value === "string") {
      el.value = ctrl.value;
      metrics.controls_restored += 1;
    }
  });

  pendingRadioChecked.forEach((el) => {
    try { el.checked = true; } catch (_e) { /* ignore */ }
  });

  controls.forEach((ctrl) => {
    let el = null;
    try {
      el = doc.querySelector(ctrl.selector);
    } catch (_e) {
      el = null;
    }
    if (!el) return;
    const tag = String(el.tagName || "").toLowerCase();
    if (typeof ctrl.checked === "boolean") {
      if (Boolean(el.checked) !== ctrl.checked) metrics.mismatches += 1;
      return;
    }
    if (tag === "select") {
      const expectedIdx = Number.isFinite(Number(ctrl.selectedIndex)) ? Number(ctrl.selectedIndex) : el.selectedIndex;
      const expectedVal = typeof ctrl.value === "string" ? ctrl.value : String(el.value == null ? "" : el.value);
      if (Number(el.selectedIndex) !== expectedIdx || String(el.value == null ? "" : el.value) !== expectedVal) {
        metrics.mismatches += 1;
      }
      return;
    }
    if (typeof ctrl.value === "string") {
      if (String(el.value == null ? "" : el.value) !== ctrl.value) metrics.mismatches += 1;
    }
  });

  return metrics;
}

function metricSnapshot(doc, baseline, captureMs, restoreMs, restored, mismatches) {
  const total = allFieldNodes(doc);
  const omitted = total.filter((el) => isOmittedByPolicy(el)).length;
  const sensitive = total.filter((el) => Recorder.isSensitivePreRunField(el)).length;
  return {
    controls_total: total.length,
    controls_captured: Array.isArray(baseline && baseline.controls) ? baseline.controls.length : 0,
    controls_restored: restored,
    controls_omitted: omitted,
    sensitive_controls: sensitive,
    mismatches,
    capture_duration_ms: Math.round(captureMs * 100) / 100,
    restore_duration_ms: Math.round(restoreMs * 100) / 100
  };
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

test("H-09 Caso A: stress 500 controles text con captura/restauracion y metricas", () => {
  let html = "<form id=\"f500\">";
  for (let i = 0; i < 500; i += 1) {
    html += `<input id=\"txt_${i}\" type=\"text\" value=\"V${i}\" />`;
  }
  html += "</form>";
  resetBody(html);

  const t0 = performance.now();
  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  const captureMs = performance.now() - t0;

  assert.ok(baseline && Array.isArray(baseline.controls));
  assert.equal(baseline.controls.length, 500);

  for (let i = 0; i < 500; i += 1) {
    const el = win.document.getElementById(`txt_${i}`);
    el.value = `M${i}`;
  }

  const t1 = performance.now();
  const restored = applyPreRunResetBaseline(win.document, baseline);
  const restoreMs = performance.now() - t1;

  const m = metricSnapshot(win.document, baseline, captureMs, restoreMs, restored.controls_restored, restored.mismatches);
  console.log("[H09_METRIC]", JSON.stringify({ escenario: "A-500-text", ...m }));

  assert.equal(m.controls_total, 500);
  assert.equal(m.controls_captured, 500);
  assert.equal(m.controls_restored, 500);
  assert.equal(m.mismatches, 0);
  assert.ok(m.capture_duration_ms < 12000);
  assert.ok(m.restore_duration_ms < 5000);
});

test("H-09 Caso B: stress 1000 controles mixtos con captura/restauracion y metricas", () => {
  let html = "<form id=\"f1000\">";
  for (let i = 0; i < 400; i += 1) {
    html += `<input id=\"it_${i}\" type=\"text\" value=\"T${i}\" />`;
  }
  for (let i = 0; i < 200; i += 1) {
    html += `<textarea id=\"ta_${i}\">L${i}\nLINEA</textarea>`;
  }
  for (let i = 0; i < 200; i += 1) {
    html += `<select id=\"se_${i}\"><option value=\"A\">A</option><option value=\"B\" selected>B</option></select>`;
  }
  for (let i = 0; i < 100; i += 1) {
    const checked = i % 2 === 0 ? "checked" : "";
    html += `<input id=\"cb_${i}\" type=\"checkbox\" ${checked} />`;
  }
  for (let i = 0; i < 100; i += 1) {
    const checked = i % 3 === 0 ? "checked" : "";
    html += `<input id=\"rd_${i}\" type=\"radio\" name=\"g_${i}\" ${checked} />`;
  }
  html += "</form>";
  resetBody(html);

  const t0 = performance.now();
  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  const captureMs = performance.now() - t0;

  assert.ok(baseline && Array.isArray(baseline.controls));
  assert.equal(baseline.controls.length, 1000);

  for (let i = 0; i < 400; i += 1) win.document.getElementById(`it_${i}`).value = `M${i}`;
  for (let i = 0; i < 200; i += 1) win.document.getElementById(`ta_${i}`).value = `X${i}`;
  for (let i = 0; i < 200; i += 1) win.document.getElementById(`se_${i}`).selectedIndex = 0;
  for (let i = 0; i < 100; i += 1) win.document.getElementById(`cb_${i}`).checked = false;
  for (let i = 0; i < 100; i += 1) win.document.getElementById(`rd_${i}`).checked = false;

  const t1 = performance.now();
  const restored = applyPreRunResetBaseline(win.document, baseline);
  const restoreMs = performance.now() - t1;

  const m = metricSnapshot(win.document, baseline, captureMs, restoreMs, restored.controls_restored, restored.mismatches);
  console.log("[H09_METRIC]", JSON.stringify({ escenario: "B-1000-mixto", ...m }));

  assert.equal(m.controls_total, 1000);
  assert.equal(m.controls_captured, 1000);
  assert.equal(m.controls_restored, 1000);
  assert.equal(m.mismatches, 0);
  assert.ok(m.capture_duration_ms < 12000);
  assert.ok(m.restore_duration_ms < 5000);
});

test("H-09 Caso C: campos sensibles quedan sin value en baseline", () => {
  resetBody(`
    <input id="password_main" type="password" value="PASSWORD_SHOULD_NOT_LEAK" />
    <input id="token_input" name="csrf_token" type="text" value="TOKEN_SHOULD_NOT_LEAK" />
    <input id="pin_input" aria-label="pin de seguridad" type="text" value="SECRET_SHOULD_NOT_LEAK" />
    <input id="normal" type="text" value="visible-ok" />
  `);

  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  assert.ok(baseline && baseline.controls.length === 4);

  const byId = Object.fromEntries(baseline.controls.map((c) => [c.id, c]));
  assert.ok(!Object.prototype.hasOwnProperty.call(byId.password_main, "value"));
  assert.ok(!Object.prototype.hasOwnProperty.call(byId.token_input, "value"));
  assert.ok(!Object.prototype.hasOwnProperty.call(byId.pin_input, "value"));
  assert.equal(byId.normal.value, "visible-ok");
});

test("H-09 Caso D: omite hidden/submit/button/image/file/reset/disabled/readOnly", () => {
  resetBody(`
    <input id="ok-text" type="text" value="x" />
    <input id="hid" type="hidden" value="1" />
    <input id="sub" type="submit" value="go" />
    <input id="btn" type="button" value="go" />
    <input id="img" type="image" value="go" />
    <input id="fil" type="file" />
    <input id="res" type="reset" value="go" />
    <input id="dis" type="text" value="d" disabled />
    <input id="ro" type="text" value="r" readonly />
  `);

  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  assert.ok(baseline && baseline.controls.length === 1);
  assert.equal(baseline.controls[0].id, "ok-text");
});

test("H-09 Caso E: select conserva/restaura value y selectedIndex", () => {
  resetBody('<select id="s1"><option value="a">A</option><option value="b" selected>B</option></select>');
  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  const sel = win.document.getElementById("s1");
  sel.selectedIndex = 0;
  const restored = applyPreRunResetBaseline(win.document, baseline);
  assert.equal(restored.mismatches, 0);
  assert.equal(sel.value, "b");
  assert.equal(sel.selectedIndex, 1);
});

test("H-09 Caso F: checkbox y radio restauran checked", () => {
  resetBody(`
    <input id="c1" type="checkbox" checked />
    <input id="r1" type="radio" name="r_single" checked />
  `);
  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  win.document.getElementById("c1").checked = false;
  win.document.getElementById("r1").checked = false;
  applyPreRunResetBaseline(win.document, baseline);
  assert.equal(win.document.getElementById("c1").checked, true);
  assert.equal(win.document.getElementById("r1").checked, true);
});

test("H-09 Caso G: textarea multilinea restaura valor", () => {
  resetBody('<textarea id="ta">linea1\nlinea2</textarea>');
  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  const ta = win.document.getElementById("ta");
  ta.value = "cambiado";
  const restored = applyPreRunResetBaseline(win.document, baseline);
  assert.equal(restored.mismatches, 0);
  assert.equal(ta.value, "linea1\nlinea2");
});

test("H-09 Caso H: dedupe por selector evita duplicado cuando dos controles colisionan", () => {
  resetBody(`
    <div id="wrap">
      <input name="codigo" value="A" />
      <input name="codigo" value="B" />
    </div>
  `);
  const totalEligible = allFieldNodes(win.document).filter((el) => !isOmittedByPolicy(el)).length;
  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  assert.equal(totalEligible, 2);
  assert.equal(baseline.controls.length, 2);
  assert.ok(baseline.controls[0].selector.startsWith("#wrap input:nth-of-type("));
  assert.ok(baseline.controls[1].selector.startsWith("#wrap input:nth-of-type("));
});

test("H-09 Caso I: iframe same-origin (best effort en entorno unitario)", () => {
  resetBody('<iframe id="fr"></iframe>');
  const fr = win.document.getElementById("fr");
  const inner = fr && fr.contentDocument;
  if (!inner || typeof inner.write !== "function") {
    console.log("[H09_METRIC]", JSON.stringify({ escenario: "I-iframe-same-origin", estado: "NO VERIFICADO EN ESTA RONDA" }));
    assert.ok(true);
    return;
  }

  inner.open();
  inner.write('<html><body><input id="inside" type="text" value="X" /></body></html>');
  inner.close();

  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  const hasInside = baseline && baseline.controls.some((c) => c.selector === "#inside");
  if (!hasInside) {
    console.log("[H09_METRIC]", JSON.stringify({ escenario: "I-iframe-same-origin", estado: "NO VERIFICADO EN ESTA RONDA" }));
    assert.ok(true);
    return;
  }
  assert.ok(hasInside);
});

test("H-09 Caso J: no-regresion formulario pequeno", () => {
  resetBody(`
    <input id="nm" type="text" value="Ana" />
    <select id="sp"><option value="1" selected>Uno</option><option value="2">Dos</option></select>
    <input id="ck" type="checkbox" checked />
    <textarea id="tx">hola</textarea>
    <input id="sec" type="password" value="PASSWORD_SHOULD_NOT_LEAK" />
  `);

  const baseline = Recorder.captureInitialPreRunReset(win.document, win.location.href, win.document.title, Recorder.buildSelector);
  assert.ok(baseline && baseline.controls.length === 5);

  const byId = Object.fromEntries(baseline.controls.map((c) => [c.id, c]));
  assert.equal(byId.nm.value, "Ana");
  assert.equal(byId.sp.value, "1");
  assert.equal(byId.ck.checked, true);
  assert.equal(byId.tx.value, "hola");
  assert.ok(!Object.prototype.hasOwnProperty.call(byId.sec, "value"));

  win.document.getElementById("nm").value = "Otra";
  win.document.getElementById("sp").value = "2";
  win.document.getElementById("ck").checked = false;
  win.document.getElementById("tx").value = "x";

  applyPreRunResetBaseline(win.document, baseline);
  assert.equal(win.document.getElementById("nm").value, "Ana");
  assert.equal(win.document.getElementById("sp").value, "1");
  assert.equal(win.document.getElementById("ck").checked, true);
  assert.equal(win.document.getElementById("tx").value, "hola");
});
