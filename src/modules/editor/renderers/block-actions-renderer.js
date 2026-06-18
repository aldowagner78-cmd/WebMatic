(function initBlockActionsRenderer(globalScope) {
  function buildBlockActions(options) {
    const config = options || {};
    const doc = config.documentRef;
    if (!doc || typeof doc.createElement !== "function") {
      throw new Error("documentRef no esta disponible para renderizar acciones de bloque");
    }

    const blockActions = doc.createElement("div");
    blockActions.className = "wm-sved-block-actions";
    blockActions.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:4px 2px 2px";

    const addBtn = doc.createElement("button");
    addBtn.className = config.addButtonClass || "wm-sved-add-btn";
    addBtn.innerHTML = config.addButtonHtml || "Agregar";
    addBtn.title = config.addButtonTitle || "";
    if (typeof config.onAddClick === "function") {
      addBtn.addEventListener("click", config.onAddClick);
    }
    blockActions.appendChild(addBtn);

    if (!config.collapsed && typeof config.onRecordRequest === "function") {
      if (config.pendingRecordIntoBlock === config.blockKey) {
        const recBar = doc.createElement("div");
        recBar.className = "wm-sved-rec-bar";
        recBar.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px;font-size:12px;color:#dc2626;font-family:system-ui,sans-serif";
        const dot = doc.createElement("span");
        dot.style.cssText = "display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;animation:webmatic-pulse 1s infinite;flex-shrink:0";
        const lbl = doc.createElement("span");
        lbl.textContent = "Grabando en este bloque — interactúa con la página…";
        recBar.appendChild(dot);
        recBar.appendChild(lbl);
        blockActions.appendChild(recBar);
      } else {
        const recBtn = doc.createElement("button");
        recBtn.className = "wm-sved-add-btn wm-sved-rec-btn";
        recBtn.style.cssText = "background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.35);color:#dc2626";
        recBtn.innerHTML = "&#9210; Grabar en este bloque";
        recBtn.title = "Graba pasos y los inserta al final de este bloque";
        if (typeof config.onRecordClick === "function") {
          recBtn.addEventListener("click", config.onRecordClick);
        }
        blockActions.appendChild(recBtn);
      }
    }

    return blockActions;
  }

  const api = {
    buildBlockActions
  };

  globalScope.WebMaticBlockActionsRenderer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);