// recorder-inject.js — se inyecta en el webview via executeJavaScript
(function startWebMaticRecorder() {
  "use strict";
  if (window.__wmRecActive) {
    if (window.__wmRec) window.__wmRec.stop();
    return;
  }
  window.__wmRecActive = true;

  // ── Flash visual sobre el elemento capturado ──────────────────────
  function flashElement(el) {
    if (!(el instanceof Element)) return;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const ov = document.createElement("div");
      ov.setAttribute("data-wm-flash", "1");
      Object.assign(ov.style, {
        position: "fixed",
        top:    (rect.top    - 3) + "px",
        left:   (rect.left   - 3) + "px",
        width:  (rect.width  + 6) + "px",
        height: (rect.height + 6) + "px",
        border: "2px solid #ef4444",
        borderRadius: "4px",
        backgroundColor: "rgba(239,68,68,0.10)",
        zIndex: "2147483647",
        pointerEvents: "none",
        boxSizing: "border-box",
        transition: "opacity 0.4s ease",
        opacity: "1"
      });
      document.documentElement.appendChild(ov);
      setTimeout(() => { ov.style.opacity = "0"; }, 350);
      setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 750);
    } catch (_) {}
  }

  // ── Construye un selector CSS estable para un elemento ────────────
  function buildSelector(element) {
    if (!element || !(element instanceof Element)) return "";
    const tag0 = element.tagName.toLowerCase();
    if (tag0 === "img" || (tag0 === "input" && element.type === "image" && !element.id)) {
      const anchor = element.closest("a[href]");
      if (anchor) element = anchor;
    }
    const tag = element.tagName.toLowerCase();
    if (element.id) return "#" + element.id;
    if (element.getAttribute("name")) return tag + '[name="' + element.getAttribute("name") + '"]';
    if (tag === "a" && element.getAttribute("href")) {
      const href = element.getAttribute("href");
      if (href.length <= 80 && !href.startsWith("javascript")) return 'a[href="' + href + '"]';
    }
    if (element.getAttribute("aria-label")) return '[aria-label="' + element.getAttribute("aria-label") + '"]';
    if (element.getAttribute("placeholder")) return tag + '[placeholder="' + element.getAttribute("placeholder") + '"]';
    if (element.dataset && element.dataset.testid) return '[data-testid="' + element.dataset.testid + '"]';
    const gxRow = element.closest && element.closest("[gxrow]");
    if (gxRow) {
      const rowNum = gxRow.getAttribute("gxrow");
      if (element.title) return '[gxrow="' + rowNum + '"] [title="' + element.title + '"]';
    }
    const titleAttr = element.getAttribute("title");
    if (titleAttr && titleAttr.length <= 80) return '[title="' + titleAttr + '"]';
    const stableData = Array.from(element.attributes).find(a => {
      if (!a.name.startsWith("data-")) return false;
      if (/data-(v-|reactid|ng-|index$|key$|_)/.test(a.name)) return false;
      if (a.value.length > 80 || a.value === "") return false;
      return true;
    });
    if (stableData) return '[' + stableData.name + '="' + stableData.value + '"]';
    const text = (element.textContent || "").replace(/\s+/g, " ").trim();
    if (text && text.length <= 60) return tag + '[text="' + text + '"]';
    let anc = element.parentElement;
    let ancDepth = 0;
    while (anc && ancDepth < 5) {
      if (anc.id && !/^(wm-|webmatic-)/.test(anc.id)) {
        const ancSame = Array.from(anc.children || []).filter(s => s.tagName === element.tagName);
        if (ancSame.length > 1) return "#" + anc.id + " " + tag + ":nth-of-type(" + (ancSame.indexOf(element) + 1) + ")";
        return "#" + anc.id + " " + tag;
      }
      anc = anc.parentElement;
      ancDepth++;
    }
    const siblings = Array.from(element.parentElement ? element.parentElement.children : []);
    const sameTag = siblings.filter(s => s.tagName === element.tagName);
    const idx = sameTag.indexOf(element);
    return tag + (sameTag.length > 1 ? ":nth-of-type(" + (idx + 1) + ")" : "");
  }

  // ── Enviar paso al host ───────────────────────────────────────────
  function send(step) {
    if (!window.__wmRecActive) return;
    step._ts = Date.now();
    if (window.__wm) window.__wm.sendToHost("wm:step", step);
  }

  // ── Handlers de eventos ───────────────────────────────────────────
  function onClick(e) {
    if (!window.__wmRecActive) return;
    let t = e.target;
    if (!(t instanceof Element)) return;
    const tTag = t.tagName.toLowerCase();
    if (tTag === "img" || (tTag === "input" && t.type === "image" && !t.id)) {
      const anchor = t.closest("a[href]");
      if (anchor) t = anchor;
    }
    flashElement(t);
    send({ type: "click", selector: buildSelector(t) });
  }

  function onDblClick(e) {
    if (!window.__wmRecActive) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    flashElement(t);
    send({ type: "dblclick", selector: buildSelector(t) });
  }

  function onChange(e) {
    if (!window.__wmRecActive) return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLSelectElement)) return;
    if (t.readOnly || t.disabled) return;
    flashElement(t);
    if (t instanceof HTMLInputElement && t.type === "checkbox") {
      send({ type: "check", selector: buildSelector(t), checked: t.checked });
      return;
    }
    send({ type: "input", selector: buildSelector(t), value: t.value });
  }

  function onKeydown(e) {
    if (!window.__wmRecActive) return;
    if (["Enter", "Tab", "Escape"].includes(e.key)) {
      if (e.target instanceof Element) flashElement(e.target);
      send({ type: "key", key: e.key });
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      send({ type: "text", selector: e.target instanceof Element ? buildSelector(e.target) : "", value: e.key });
    }
  }

  let ceTimer = null;
  function onInput(e) {
    if (!window.__wmRecActive) return;
    const t = e.target;
    if (!(t instanceof Element) || !t.isContentEditable) return;
    clearTimeout(ceTimer);
    ceTimer = setTimeout(() => {
      const val = (t.innerText || t.textContent || "").trim();
      flashElement(t);
      send({ type: "input", selector: buildSelector(t), value: val });
    }, 400);
  }

  document.addEventListener("click",    onClick,    true);
  document.addEventListener("dblclick", onDblClick, true);
  document.addEventListener("change",   onChange,   true);
  document.addEventListener("keydown",  onKeydown,  true);
  document.addEventListener("input",    onInput,    true);

  // ── hover: solo graba si el hover despliega contenido nuevo (dropdown/menu/tooltip) ─
  let _hoverEl    = null;
  let _hoverTimer = null;
  let _hoverObs   = null;
  let _hoverSeen  = false;
  function onMouseOver(e) {
    if (!window.__wmRecActive) return;
    const t = e.target;
    if (!(t instanceof Element) || t === _hoverEl) return;
    clearTimeout(_hoverTimer);
    if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
    _hoverSeen = false;
    _hoverEl = t;
    try {
      const _root = document.body || document.documentElement;
      _hoverObs = new MutationObserver((muts) => {
        if (_hoverSeen) return;
        for (const m of muts) {
          if (m.type === "childList") {
            for (const n of m.addedNodes) {
              if (n instanceof Element && n.offsetWidth > 0 && n.offsetHeight > 0) { _hoverSeen = true; return; }
            }
          } else if (m.attributeName === "aria-expanded" && m.target.getAttribute("aria-expanded") === "true") {
            _hoverSeen = true; return;
          }
        }
      });
      _hoverObs.observe(_root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    } catch (_) {}
    _hoverTimer = setTimeout(() => {
      if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
      if (_hoverEl !== t || !_hoverSeen) return;
      flashElement(t);
      send({ type: "hover", selector: buildSelector(t) });
    }, 800);
  }
  document.addEventListener("mouseover", onMouseOver, true);

  // ── scroll_to: solo graba si ocurre en un contenedor emergente (dropdown/listbox/menu) ─
  function _isMenuScroll(el) {
    if (!(el instanceof Element)) return false;
    if (el.tagName.toLowerCase() === "select") return true;
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (["listbox","menu","menubar","tree","combobox","grid","treegrid"].includes(role)) return true;
    if (el.closest("[role='listbox'],[role='menu'],[role='combobox'],[role='tree']")) return true;
    try {
      const cs = window.getComputedStyle(el);
      const pos = cs.position; const ov = cs.overflowY;
      if ((pos === "absolute" || pos === "fixed") && (ov === "auto" || ov === "scroll")) return true;
    } catch (_) {}
    return false;
  }
  let _scrollTimer = null;
  function onScroll(e) {
    if (!window.__wmRecActive) return;
    const scrollEl = e.target instanceof Element ? e.target : null;
    if (!scrollEl || !_isMenuScroll(scrollEl)) return;
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(() => {
      send({ type: "scroll_to", selector: buildSelector(scrollEl) });
    }, 900);
  }
  document.addEventListener("scroll", onScroll, true);

  window.__wmRec = {
    stop() {
      window.__wmRecActive = false;
      document.removeEventListener("click",     onClick,     true);
      document.removeEventListener("dblclick",  onDblClick,  true);
      document.removeEventListener("change",    onChange,    true);
      document.removeEventListener("keydown",   onKeydown,   true);
      document.removeEventListener("input",     onInput,     true);
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("scroll",    onScroll,    true);
      clearTimeout(ceTimer);
      clearTimeout(_hoverTimer);
      clearTimeout(_scrollTimer);
      if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
      delete window.__wmRec;
    }
  };

  if (window.__wm) window.__wm.sendToHost("wm:rec-ready", {});
})();
