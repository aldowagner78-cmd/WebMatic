(function initActionSimpleEvents(globalScope) {
  function handleSimpleElementAction(step, el) {
    if (!step || !el) return false;

    if (step.type === "scroll_to") {
      try { el.scrollIntoView({ behavior: "instant", block: "center" }); } catch (e) { /* ignore */ }
      return true;
    }

    if (step.type === "hover") {
      el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
      return true;
    }

    return false;
  }

  const api = {
    handleSimpleElementAction
  };

  globalScope.WebMaticActionSimpleEvents = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
