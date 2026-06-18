(function initActionCheck(globalScope) {
  function allDocs(rootDoc) {
    const docs = [];

    function walk(doc) {
      if (!doc) return;
      docs.push(doc);

      try {
        const frames = doc.querySelectorAll("iframe, frame");
        for (const frame of frames) {
          try {
            const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (innerDoc) walk(innerDoc);
          } catch (e) { /* cross-origin */ }
        }
      } catch (e) { /* ignore */ }
    }

    walk(rootDoc || (typeof document !== "undefined" ? document : null));
    return docs;
  }

  function findAssociatedCheckInput(el) {
    if (!el || !(el instanceof Element)) return null;

    if (el instanceof HTMLInputElement) {
      const t = (el.type || "").toLowerCase();
      if (t === "checkbox" || t === "radio") return el;
    }

    try {
      const nested = el.querySelector && el.querySelector('input[type="checkbox"], input[type="radio"]');
      if (nested instanceof HTMLInputElement) return nested;
    } catch (e) { /* ignore */ }

    try {
      const lbl = el instanceof HTMLLabelElement ? el : (el.closest && el.closest("label[for]"));
      if (lbl && lbl.htmlFor) {
        const doc = el.ownerDocument || document;
        const linked = doc.getElementById(lbl.htmlFor);
        if (linked instanceof HTMLInputElement) {
          const t = (linked.type || "").toLowerCase();
          if (t === "checkbox" || t === "radio") return linked;
        }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function findCheckActivator(inputEl, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const isInteractable = options.isInteractable;

    if (!(inputEl instanceof HTMLInputElement)) return null;

    try {
      if (inputEl.labels && inputEl.labels.length) {
        const visibleLabel = Array.from(inputEl.labels).find((l) => isInteractable && isInteractable(l));
        if (visibleLabel) return visibleLabel;
        if (inputEl.labels[0]) return inputEl.labels[0];
      }
    } catch (e) { /* ignore */ }

    if (inputEl.id) {
      try {
        const doc = inputEl.ownerDocument || document;
        const escapedId = String(inputEl.id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const labels = doc.querySelectorAll(`label[for="${escapedId}"]`);

        for (const lbl of labels) {
          if (isInteractable && isInteractable(lbl)) return lbl;
        }

        if (labels.length > 0) return labels[0];
      } catch (e) { /* ignore */ }
    }

    try {
      const roleWrap = inputEl.closest('[role="radio"], [role="checkbox"], label');
      if (roleWrap && roleWrap !== inputEl) return roleWrap;
    } catch (e) { /* ignore */ }

    return null;
  }

  function setCheckedNative(inputEl, desired) {
    try {
      const proto = Object.getPrototypeOf(inputEl) || HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "checked");

      if (desc && typeof desc.set === "function") {
        desc.set.call(inputEl, Boolean(desired));
      } else {
        inputEl.checked = Boolean(desired);
      }
    } catch (e) {
      inputEl.checked = Boolean(desired);
    }

    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findBestCheckTarget(selector, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const findElement = options.findElement;
    const isInteractable = options.isInteractable;

    if (!selector || !doc) return null;

    if (selector.startsWith("/") || selector.startsWith("(") || /^\w+\[text="/.test(selector)) {
      return findElement ? findElement(selector) : null;
    }

    const matches = [];

    for (const d of allDocs(doc)) {
      try {
        const list = d.querySelectorAll(selector);
        for (const el of list) {
          if (!(el instanceof HTMLInputElement)) continue;

          const t = (el.type || "").toLowerCase();
          if (t !== "checkbox" && t !== "radio") continue;

          matches.push(el);
        }
      } catch (e) { /* invalid selector */ }
    }

    if (matches.length === 0) {
      const direct = findElement ? findElement(selector) : null;
      const associated = findAssociatedCheckInput(direct);
      return associated || direct;
    }

    const interactable = matches.find((el) => isInteractable && isInteractable(el));
    return interactable || matches[0];
  }

  const api = {
    allDocs,
    findBestCheckTarget,
    findAssociatedCheckInput,
    findCheckActivator,
    setCheckedNative
  };

  globalScope.WebMaticActionCheck = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
