(function initBlockHeaderRenderer(globalScope) {
  function buildExecutionBlockHeader(options) {
    const config = options || {};
    const doc = config.documentRef;
    if (!doc || typeof doc.createElement !== "function") {
      throw new Error("documentRef no esta disponible para renderizar el encabezado del bloque");
    }

    const blockHeader = doc.createElement("div");
    blockHeader.className = "wm-sved-block-header";

    const blockTag = doc.createElement("span");
    blockTag.className = "wm-sved-block-tag";
    blockTag.textContent = `bloque ${config.blockOrdinal}`;
    blockTag.title = `Bloque encadenado de ${config.blockSize} pasos`;
    blockHeader.appendChild(blockTag);

    if (config.blockContextLabel) {
      const ctx = doc.createElement("span");
      ctx.className = "wm-sved-block-context";
      ctx.textContent = config.blockContextLabel;
      ctx.title = config.blockContextTitle || config.blockContextLabel;
      blockHeader.appendChild(ctx);
    }

    if ((config.visitIndex || 0) > 0) {
      const visitBadge = doc.createElement("span");
      visitBadge.className = "wm-sved-block-visit-badge";
      visitBadge.textContent = `visita ${config.visitIndex}`;
      visitBadge.title = config.isReentry
        ? "Este bloque vuelve a un contexto ya usado antes en la grabación"
        : "Primera visita a este contexto durante la grabación";
      blockHeader.appendChild(visitBadge);
    }

    if (config.isReentry) {
      const reentryBadge = doc.createElement("span");
      reentryBadge.className = "wm-sved-block-reentry-badge";
      reentryBadge.textContent = "reingreso";
      reentryBadge.title = "Este bloque vuelve a un contexto ya usado antes en la grabación";
      blockHeader.appendChild(reentryBadge);
    }

    const blockMeta = doc.createElement("span");
    blockMeta.className = "wm-sved-block-meta";
    blockMeta.textContent = `${config.blockSize} paso${config.blockSize !== 1 ? "s" : ""}`;
    blockHeader.appendChild(blockMeta);

    const blockStateBadge = doc.createElement("span");
    blockStateBadge.className = "wm-sved-block-state-badge";
    if (config.canCollapse) {
      blockStateBadge.textContent = config.collapsed ? "⊞ colapsado" : "⊟ expandido";
      blockStateBadge.classList.add(config.collapsed ? "wm-sved-block-state-collapsed" : "wm-sved-block-state-expanded");
    }
    blockHeader.appendChild(blockStateBadge);

    if (config.canCollapse) {
      const toggleBtn = doc.createElement("button");
      toggleBtn.className = "wm-sved-block-toggle";
      toggleBtn.type = "button";
      toggleBtn.innerHTML = config.collapsed ? "&#9654;" : "&#9660;";
      toggleBtn.title = config.collapsed ? "Desplegar bloque para editar pasos" : "Colapsar bloque";
      if (typeof config.onToggle === "function") {
        toggleBtn.addEventListener("click", config.onToggle);
      }
      blockHeader.appendChild(toggleBtn);
    }

    return blockHeader;
  }

  const api = {
    buildExecutionBlockHeader
  };

  globalScope.WebMaticBlockHeaderRenderer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);