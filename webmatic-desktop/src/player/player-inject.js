// player-inject.js — se inyecta en el webview via executeJavaScript
// Lee window.__wmPlayerConfig = { steps, retryMs, timeoutMs }
(async function wmRunPlayer() {
  "use strict";
  const config    = window.__wmPlayerConfig || {};
  const steps     = config.steps     || [];
  const retryMs   = config.retryMs   || 400;
  const timeoutMs = config.timeoutMs || 8000;
  const delayMs   = config.delayMs   != null ? config.delayMs : 50;
  let   stopped   = false;

  window.__wmPlayerStop = function () { stopped = true; };

  function sendStatus(data) {
    if (window.__wm) window.__wm.sendToHost("wm:play-status", data);
  }

  // ── Busca elemento incluyendo Shadow DOM ───────────────────────────
  function findInShadow(root, selector) {
    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch (_) { return null; }
    try {
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) {
          const found = findInShadow(el.shadowRoot, selector);
          if (found) return found;
        }
      }
    } catch (_) {}
    return null;
  }

  function findElement(selector) {
    if (!selector) return null;
    if (selector.startsWith("/") || selector.startsWith("(")) {
      try {
        const r = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return r.singleNodeValue || null;
      } catch (_) { return null; }
    }
    const textMatch = /^(\w+)\[text="([^"]+)"\]$/.exec(selector);
    if (textMatch) {
      const [, tagName, text] = textMatch;
      const norm = text.replace(/\s+/g, " ").trim();
      for (const el of document.querySelectorAll(tagName)) {
        if ((el.textContent || "").replace(/\s+/g, " ").trim() === norm) return el;
      }
      return null;
    }
    return findInShadow(document, selector);
  }

  // ── Resalta elemento brevemente ────────────────────────────────────
  function highlight(el) {
    if (!(el instanceof Element)) return;
    try {
      const rect = el.getBoundingClientRect();
      const ov = document.createElement("div");
      Object.assign(ov.style, {
        position: "fixed",
        top:    (rect.top    - 2) + "px",
        left:   (rect.left   - 2) + "px",
        width:  (rect.width  + 4) + "px",
        height: (rect.height + 4) + "px",
        border: "2px solid #ef4444",
        borderRadius: "3px",
        backgroundColor: "rgba(239,68,68,0.10)",
        zIndex: "2147483647",
        pointerEvents: "none",
        transition: "opacity 0.3s",
        opacity: "1"
      });
      document.documentElement.appendChild(ov);
      setTimeout(() => { ov.style.opacity = "0"; }, 300);
      setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 600);
    } catch (_) {}
  }

  // ── Establece valor en input/select/contenteditable ───────────────
  // Simula escritura real: execCommand → keyboard events por carácter.
  // Necesario para frameworks como GeneXus que escuchan eventos de teclado.
  function setInputValue(el, value) {
    const tag = (el.tagName || "").toLowerCase();
    const str = String(value == null ? "" : value);

    // ── contenteditable ──────────────────────────────────────────────
    if (el.isContentEditable) {
      el.focus();
      document.execCommand("selectAll", false, null);
      if (!document.execCommand("insertText", false, str)) {
        el.innerText = str;
      }
      el.dispatchEvent(new Event("input",  { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // ── <select> ─────────────────────────────────────────────────────
    if (tag === "select") {
      const proto = el.constructor.prototype || HTMLSelectElement.prototype;
      const desc  = Object.getOwnPropertyDescriptor(proto, "value");
      const setV  = (v) => { if (desc && desc.set) desc.set.call(el, v); else el.value = v; };
      setV(str);
      if (el.value !== str) {
        const opt = Array.from(el.options || []).find(o => (o.text || "").trim() === str.trim());
        if (opt) setV(opt.value);
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // ── <input> / <textarea> ─────────────────────────────────────────
    el.focus && el.focus();
    try { el.select(); } catch (_) {}

    // Intento 1: execCommand (dispara beforeinput/input nativamente)
    if (document.execCommand("insertText", false, str)) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // Intento 2: native setter + keyboard events por carácter
    const proto = el.constructor.prototype || HTMLInputElement.prototype;
    const desc  = Object.getOwnPropertyDescriptor(proto, "value");
    const setV  = (v) => { if (desc && desc.set) desc.set.call(el, v); else el.value = v; };

    setV("");
    el.dispatchEvent(new Event("input", { bubbles: true }));

    for (const char of str) {
      const kc = char.charCodeAt(0);
      const kOpts = { key: char, charCode: kc, keyCode: kc, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent("keydown",  kOpts));
      el.dispatchEvent(new KeyboardEvent("keypress", kOpts));
      setV(el.value + char);
      el.dispatchEvent(new InputEvent("input", { data: char, inputType: "insertText", bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", kOpts));
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function simulateClick(el) {
    el.focus && el.focus();
    ["mousedown", "mouseup", "click"].forEach(type =>
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    );
  }

  // ── Espera a que aparezca un selector en el DOM ────────────────────
  function waitForElement(selector, timeout) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function poll() {
        if (stopped) return reject(new Error("Detenido por usuario"));
        const el = findElement(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return reject(new Error('Tiempo agotado esperando "' + selector + '"'));
        setTimeout(poll, retryMs);
      })();
    });
  }

  // ── Ejecuta un paso ────────────────────────────────────────────────
  async function executeStep(step) {
    if (stopped) throw new Error("Detenido por usuario");

    if (step.type === "wait") {
      const ms = step.seconds != null
        ? Math.round(Number(step.seconds) * 1000)
        : (Number(step.ms) || 500);
      await new Promise(r => setTimeout(r, ms));
      return;
    }

    if (step.type === "key") {
      const target = document.activeElement || document.body;
      ["keydown", "keyup"].forEach(t =>
        target.dispatchEvent(new KeyboardEvent(t, { key: step.key, bubbles: true, cancelable: true }))
      );
      return;
    }

    if (step.type === "navigate") {
      if (step.url) window.location.href = step.url;
      return;
    }

    // ── wait_for: espera a que aparezca el selector ──────────────────
    if (step.type === "wait_for") {
      const wfTimeout = step.timeout != null ? step.timeout : timeoutMs;
      await waitForElement(step.selector || "body", wfTimeout);
      return;
    }

    if (!step.selector) return;

    const el = await waitForElement(step.selector, timeoutMs);
    highlight(el);
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
    await new Promise(r => setTimeout(r, 80));

    if (step.type === "click" || step.type === "check") {
      simulateClick(el);
    } else if (step.type === "dblclick") {
      el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    } else if (step.type === "input" || step.type === "text") {
      setInputValue(el, step.value || "");
      try { el.blur(); } catch (_) {}
    } else if (step.type === "extract") {
      const val = (el.textContent || "").replace(/\s+/g, " ").trim();
      sendStatus({ type: "extract", variable: step.variable, value: val });
    } else if (step.type === "hover") {
      el.dispatchEvent(new MouseEvent("mouseover",  { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: false, view: window }));
      el.dispatchEvent(new MouseEvent("mousemove",  { bubbles: true, cancelable: true, view: window }));
    } else if (step.type === "scroll_to") {
      try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
    }
  }

  // ── Combinar pasos de texto consecutivos ──────────────────────────
  const merged = [];
  for (const step of steps) {
    const prev = merged[merged.length - 1];
    if (step.type === "text" && prev && prev.type === "text" && prev.selector === step.selector) {
      prev.value = (prev.value || "") + (step.value || "");
    } else {
      merged.push(Object.assign({}, step));
    }
  }

  // ── Bucle principal ────────────────────────────────────────────────
  sendStatus({ type: "started", total: merged.length });

  for (let i = 0; i < merged.length; i++) {
    if (stopped) break;
    sendStatus({ type: "step", idx: i, total: merged.length });
    try {
      await executeStep(merged[i]);
      await new Promise(r => setTimeout(r, delayMs));
    } catch (err) {
      delete window.__wmPlayerStop;
      delete window.__wmPlayerConfig;
      // Lanzar el error para que executeJavaScript rechace la Promise
      // y startPlayback pueda manejarlo directamente sin depender de IPC
      throw err;
    }
  }

  delete window.__wmPlayerStop;
  delete window.__wmPlayerConfig;

  if (stopped) return { status: "stopped" };
  // Enviar por IPC tambien (funciona si el preload esta disponible)
  sendStatus({ type: "done", total: merged.length });
  // Retornar el resultado para que executeJavaScript lo resuelva directamente
  return { status: "done", total: merged.length };
})();
