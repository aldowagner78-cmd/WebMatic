(function initWebMaticMacroConcatDialog(globalScope) {
  function createButton(label, className) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className || "webmatic-action-btn";
    btn.textContent = label;
    return btn;
  }

  function openMacroConcatDialog(options) {
    const opts = options || {};
    const panel = opts.panel || document.getElementById("webmatic-panel-root");
    const baseMacro = opts.baseMacro || null;
    const macros = Array.isArray(opts.macros) ? opts.macros : [];
    if (!panel || !baseMacro) return Promise.resolve(null);

    const available = macros.filter((macro) => macro && macro.id !== baseMacro.id);

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "webmatic-concat-overlay";
      overlay.setAttribute("data-macro-concat-dialog", "true");

      const dialog = document.createElement("div");
      dialog.className = "webmatic-concat-dialog";

      const title = document.createElement("h3");
      title.className = "webmatic-concat-title";
      title.textContent = "Concatenar macros";

      const nameInput = document.createElement("input");
      nameInput.className = "webmatic-concat-name";
      nameInput.type = "text";
      nameInput.autocomplete = "off";
      nameInput.placeholder = "Nombre final";
      nameInput.value = baseMacro.name || "";
      nameInput.setAttribute("data-macro-concat-name", "true");

      const searchInput = document.createElement("input");
      searchInput.className = "webmatic-concat-search";
      searchInput.type = "text";
      searchInput.autocomplete = "off";
      searchInput.placeholder = "Buscar macro para agregar";
      searchInput.setAttribute("data-macro-concat-search", "true");

      const list = document.createElement("div");
      list.className = "webmatic-concat-list";
      list.setAttribute("data-macro-concat-list", "true");

      const selectedWrap = document.createElement("div");
      selectedWrap.className = "webmatic-concat-selected";
      selectedWrap.setAttribute("data-macro-concat-selected", "true");

      const actions = document.createElement("div");
      actions.className = "webmatic-concat-actions";
      const okBtn = createButton("Concatenar", "webmatic-action-btn");
      okBtn.setAttribute("data-macro-concat-ok", "true");
      const cancelBtn = createButton("Cancelar", "webmatic-action-btn webmatic-btn-ghost");
      cancelBtn.setAttribute("data-macro-concat-cancel", "true");
      actions.appendChild(okBtn);
      actions.appendChild(cancelBtn);

      dialog.appendChild(title);
      dialog.appendChild(nameInput);
      dialog.appendChild(searchInput);
      dialog.appendChild(list);
      dialog.appendChild(selectedWrap);
      dialog.appendChild(actions);
      overlay.appendChild(dialog);
      panel.appendChild(overlay);

      const selected = [];
      let nameEdited = false;

      function selectedIds() {
        return new Set(selected.map((macro) => macro.id));
      }

      function suggestedName() {
        return [baseMacro].concat(selected).map((macro) => macro.name).filter(Boolean).join(" + ");
      }

      function syncName() {
        if (!nameEdited) nameInput.value = suggestedName();
      }

      function cleanup(value) {
        overlay.remove();
        resolve(value);
      }

      function renderSelected() {
        selectedWrap.replaceChildren();
        if (selected.length === 0) {
          const empty = document.createElement("p");
          empty.className = "webmatic-concat-empty";
          empty.textContent = "Sin macros seleccionadas";
          selectedWrap.appendChild(empty);
          okBtn.disabled = true;
          return;
        }
        okBtn.disabled = false;
        selected.forEach((macro) => {
          const chip = document.createElement("span");
          chip.className = "webmatic-concat-chip";
          chip.setAttribute("data-macro-concat-chip", macro.id);
          const label = document.createElement("span");
          label.textContent = macro.name || "(sin nombre)";
          const remove = createButton("Quitar", "webmatic-concat-remove");
          remove.setAttribute("data-macro-concat-remove", macro.id);
          remove.addEventListener("click", () => {
            const idx = selected.findIndex((item) => item.id === macro.id);
            if (idx >= 0) selected.splice(idx, 1);
            syncName();
            render();
          });
          chip.appendChild(label);
          chip.appendChild(remove);
          selectedWrap.appendChild(chip);
        });
      }

      function renderList() {
        const q = searchInput.value.trim().toLowerCase();
        const picked = selectedIds();
        const filtered = q
          ? available.filter((macro) => String(macro.name || "").toLowerCase().includes(q))
          : available;
        list.replaceChildren();
        if (filtered.length === 0) {
          const empty = document.createElement("p");
          empty.className = "webmatic-concat-empty";
          empty.textContent = available.length === 0 ? "No hay otras macros disponibles" : "Sin resultados";
          list.appendChild(empty);
          return;
        }
        filtered.forEach((macro) => {
          const row = createButton(macro.name || "(sin nombre)", "webmatic-concat-row");
          row.setAttribute("data-macro-concat-option", macro.id);
          row.disabled = picked.has(macro.id);
          row.addEventListener("click", () => {
            if (selectedIds().has(macro.id)) return;
            selected.push(macro);
            syncName();
            render();
          });
          list.appendChild(row);
        });
      }

      function render() {
        renderList();
        renderSelected();
      }

      nameInput.addEventListener("input", () => { nameEdited = true; });
      searchInput.addEventListener("input", renderList);
      okBtn.addEventListener("click", () => {
        const name = nameInput.value.trim() || suggestedName();
        cleanup({ name, macros: selected.slice() });
      });
      cancelBtn.addEventListener("click", () => cleanup(null));
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cleanup(null);
        }
      });

      render();
      setTimeout(() => searchInput.focus(), 30);
    });
  }

  const api = { openMacroConcatDialog };
  globalScope.WebMaticMacroConcatDialog = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
