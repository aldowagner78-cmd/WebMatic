(function initStepRowRenderer(globalScope) {
  function buildStepRow(options) {
    const config = options || {};
    const doc = config.documentRef;
    if (!doc || typeof doc.createElement !== "function") {
      throw new Error("documentRef no esta disponible para renderizar la fila del paso");
    }

    const row = doc.createElement("div");
    row.className = "wm-sved-row";
    row.dataset.stepIdx = String(config.rowIdx);

    if (config.movedMeta) {
      row.classList.add("wm-sved-row-moved");
      row.classList.add(config.movedMeta.source === "drag" ? "wm-sved-row-moved-drag" : "wm-sved-row-moved-button");
    }

    row.classList.add("wm-sved-row-block");
    row.classList.add(config.blockOrdinal % 2 === 0 ? "wm-sved-row-block-even" : "wm-sved-row-block-odd");
    if (config.isBaselineDefault) row.classList.add("wm-sved-row-default");
    if (config.dragEnabled) {
      row.setAttribute("draggable", "true");
      row.classList.add("wm-sved-row-draggable");
    }

    const num = doc.createElement("span");
    num.className = "wm-sved-num";
    num.textContent = String(config.rowIdx + 1);

    const icon = doc.createElement("span");
    icon.className = "wm-sved-icon";
    icon.textContent = config.typeIcon || "\u25B8";

    const typeTag = doc.createElement("span");
    typeTag.className = "wm-sved-type";
    typeTag.textContent = config.actionLabel || config.stepType || "";
    typeTag.title = config.stepType || "";

    const defaultBadge = config.isBaselineDefault ? doc.createElement("span") : null;
    if (defaultBadge) {
      defaultBadge.className = "wm-sved-default-badge";
      defaultBadge.textContent = "Preparacion inicial";
      defaultBadge.title = "Paso capturado automáticamente desde el estado inicial de la página";
    }

    const desc = doc.createElement("span");
    desc.className = "wm-sved-desc";
    const humanLabel = config.humanLabel || config.shortLabel || "";
    const technicalLabel = config.shortLabel || "";
    desc.textContent = config.isCollapsedSummary ? `${humanLabel} (+${config.blockSize - 1} ocultos)` : humanLabel;
    desc.title = technicalLabel && technicalLabel !== humanLabel ? `Detalle tecnico: ${technicalLabel}` : humanLabel;
    if (config.showTechnicalDetails && technicalLabel) {
      desc.dataset.technicalLabel = technicalLabel;
    }

    const ctrl = doc.createElement("div");
    ctrl.className = "wm-sved-ctrl";
    if (config.dragEnabled) {
      const dragHandle = doc.createElement("span");
      dragHandle.className = "wm-sved-drag-handle";
      dragHandle.textContent = "\u22EE\u22EE";
      dragHandle.title = config.dragHandleTitle || "Arrastra para reordenar paso";
      ctrl.appendChild(dragHandle);
    }

    if (typeof config.onMoveUp === "function") {
      ctrl.appendChild(config.onMoveUp());
    }
    if (typeof config.onMoveDown === "function") {
      ctrl.appendChild(config.onMoveDown());
    }

    const editBtn = doc.createElement("button");
    editBtn.className = "wm-sved-btn";
    editBtn.textContent = "✏";
    editBtn.title = "Editar paso";
    if (typeof config.onEditClick === "function") {
      editBtn.addEventListener("click", config.onEditClick);
    }
    editBtn.classList.add("wm-sved-btn-edit");
    ctrl.appendChild(editBtn);

    const delBtn = doc.createElement("button");
    delBtn.className = "wm-sved-btn";
    delBtn.textContent = "✕";
    delBtn.title = "Eliminar";
    if (typeof config.onDeleteClick === "function") {
      delBtn.addEventListener("click", config.onDeleteClick);
    }
    delBtn.classList.add("wm-sved-btn-del");
    ctrl.appendChild(delBtn);

    if (config.movedMeta) {
      const movedTag = doc.createElement("span");
      movedTag.className = "wm-sved-moved-tag";
      movedTag.textContent = "movido";
      movedTag.title = config.movedMeta.source === "drag"
        ? "Paso reordenado por arrastre"
        : "Paso reordenado con botones";
      ctrl.appendChild(movedTag);
    }

    row.appendChild(num);
    row.appendChild(icon);
    row.appendChild(typeTag);
    if (defaultBadge) row.appendChild(defaultBadge);
    row.appendChild(desc);
    row.appendChild(ctrl);

    return row;
  }

  const api = {
    buildStepRow
  };

  globalScope.WebMaticStepRowRenderer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
