(function initFormFieldsRenderer(globalScope) {
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
    readStepFields
  };

  globalScope.WebMaticFormFieldsRenderer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);