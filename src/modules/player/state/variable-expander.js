(function initVariableExpander(globalScope) {
  function expandVariables(str, vars, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const utils = options.utils || globalScope.WebMaticUtils || null;

    if (!str) return str;

    str = String(str);

    str = str.replace(/\{\{!NOW:([^}]+)\}\}/g, (_, fmt) => {
      return utils && typeof utils.formatDate === "function"
        ? utils.formatDate(fmt)
        : new Date().toLocaleString();
    });

    str = str.replace(/\{\{!([^}]+)\}\}/g, (_, name) => {
      return Object.prototype.hasOwnProperty.call(vars || {}, name) ? vars[name] : "";
    });

    str = str.replace(/%([A-Z0-9_]+)%/gi, (_, name) => {
      return Object.prototype.hasOwnProperty.call(vars || {}, name) ? vars[name] : "";
    });

    return str;
  }

  const api = {
    expandVariables
  };

  globalScope.WebMaticVariableExpander = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);