(function initFormFieldsRenderer(globalScope) {
  function renderStepTypeFields(options) {
    const config = options || {};
    const doc = config.documentRef;
    const fieldsDiv = config.fieldsDiv;
    const typeValue = config.typeValue;
    const typeInfo = config.typeInfo;
    const prefill = config.prefill && typeof config.prefill === "object" ? config.prefill : null;
    const onPickElement = typeof config.onPickElement === "function" ? config.onPickElement : null;
    const onSyncOptionPicker = typeof config.onSyncOptionPicker === "function" ? config.onSyncOptionPicker : null;

    if (!doc || !fieldsDiv || !typeInfo || !Array.isArray(typeInfo.fields)) return;

    fieldsDiv.replaceChildren();

    typeInfo.fields.forEach((field) => {
      const name = field.name;
      const ph = field.ph;

      if (typeValue === "choose_option" && (name === "value" || name === "text" || name === "variable")) {
        const hidden = doc.createElement("input");
        hidden.type = "hidden";
        hidden.dataset.field = name;
        if (prefill && prefill[name] != null) {
          const pv = prefill[name];
          hidden.value = Array.isArray(pv) ? pv.join(", ") : String(pv);
        }
        fieldsDiv.appendChild(hidden);
        return;
      }

      const lbl = doc.createElement("label");
      lbl.className = "wm-sved-field-label";
      lbl.textContent = name;

      if (field.select) {
        const sel = doc.createElement("select");
        sel.className = "wm-sved-select";
        sel.dataset.field = name;
        field.select.forEach(([val, text]) => {
          const opt = doc.createElement("option");
          opt.value = val;
          opt.textContent = text;
          if (prefill && prefill[name] === val) opt.selected = true;
          sel.appendChild(opt);
        });
        lbl.appendChild(sel);
      } else if (name === "checked") {
        const sel = doc.createElement("select");
        sel.className = "wm-sved-select";
        sel.dataset.field = name;
        [["true", "✔ Marcar (true)"], ["false", "✘ Desmarcar (false)"]].forEach(([val, text]) => {
          const opt = doc.createElement("option");
          opt.value = val;
          opt.textContent = text;
          if (prefill && String(prefill[name]) === val) opt.selected = true;
          sel.appendChild(opt);
        });
        lbl.appendChild(sel);
      } else if (field.type === "toggle") {
        const wrap = doc.createElement("div");
        wrap.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:4px;";
        const cb = doc.createElement("input");
        cb.type = "checkbox";
        cb.dataset.field = name;
        cb.dataset.fieldtype = "toggle";
        cb.checked = !!(prefill && prefill[name]);
        cb.addEventListener("change", () => {
          const valInp = fieldsDiv.querySelector("[data-field='value']");
          if (valInp) {
            valInp.disabled = cb.checked;
            valInp.style.opacity = cb.checked ? "0.4" : "1";
          }
        });
        const cbLbl = doc.createElement("label");
        cbLbl.textContent = field.label || name;
        cbLbl.style.cssText = "font-weight:normal;cursor:pointer;font-size:12px;";
        wrap.appendChild(cb);
        wrap.appendChild(cbLbl);
        lbl.textContent = "";
        lbl.appendChild(wrap);
        setTimeout(() => {
          const valInp = fieldsDiv.querySelector("[data-field='value']");
          if (valInp && cb.checked) {
            valInp.disabled = true;
            valInp.style.opacity = "0.4";
          }
        }, 0);
      } else {
        const inp = doc.createElement("input");
        inp.className = "wm-sved-field-input";
        inp.type = "text";
        inp.dataset.field = name;
        inp.placeholder = ph || "";
        if (prefill && prefill[name] != null) {
          const pv = prefill[name];
          inp.value = Array.isArray(pv) ? pv.join(", ") : String(pv);
        }
        if ((name === "selector" || name === "from" || name === "to") && onPickElement) {
          const row = doc.createElement("div");
          row.style.cssText = "display:flex;gap:4px;align-items:center;width:100%";
          inp.style.flex = "1";
          const pb = doc.createElement("button");
          pb.type = "button";
          pb.textContent = "🎯";
          pb.title = "Haz clic en la página para capturar el selector";
          pb.style.cssText = "all:initial;display:inline-flex;align-items:center;justify-content:center;background:#0ea5e9;color:#fff;border-radius:6px;padding:4px 8px;font-size:14px;cursor:pointer;flex-shrink:0;font-family:system-ui,sans-serif";
          pb.addEventListener("click", (e) => {
            e.preventDefault();
            onPickElement(name, (selector) => {
              inp.value = selector;
              inp.dispatchEvent(new Event("input", { bubbles: true }));
            });
          });
          row.appendChild(inp);
          row.appendChild(pb);
          lbl.appendChild(row);
        } else {
          lbl.appendChild(inp);
        }
      }

      fieldsDiv.appendChild(lbl);
    });

    const first = fieldsDiv.querySelector("input, select");
    if (first) setTimeout(() => first.focus(), 0);
    if (onSyncOptionPicker) {
      onSyncOptionPicker(fieldsDiv, typeValue);
      const selInp = fieldsDiv.querySelector("[data-field='selector']");
      if (selInp) {
        selInp.addEventListener("input", () => onSyncOptionPicker(fieldsDiv, typeValue));
      }
    }
  }

  function readStepFields(fieldsDiv, baseStep) {
    const step = baseStep && typeof baseStep === "object" ? baseStep : {};
    if (!fieldsDiv || typeof fieldsDiv.querySelectorAll !== "function") return step;

    fieldsDiv.querySelectorAll("[data-field]").forEach((inp) => {
      if (inp.dataset.fieldtype === "toggle") {
        step[inp.dataset.field] = inp.checked;
      } else {
        const v = inp.value.trim();
        if (v !== "") step[inp.dataset.field] = v;
      }
    });

    return step;
  }

  const api = {
    renderStepTypeFields,
    readStepFields
  };

  globalScope.WebMaticFormFieldsRenderer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);