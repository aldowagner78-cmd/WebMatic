"use strict";

const fs = require("fs");
const path = require("path");

function collectSanitizedInventory(doc) {
  const root = doc || (typeof document !== "undefined" ? document : null);
  if (!root) return null;

  const selects = Array.from(root.querySelectorAll("select")).map((el) => ({
    id: el.id || "",
    name: el.getAttribute("name") || "",
    optionsCount: (el.options || []).length,
    selectedIndex: Number.isFinite(el.selectedIndex) ? el.selectedIndex : -1,
    options: Array.from(el.options || []).slice(0, 60).map((o, i) => ({
      index: i,
      text: (o.text || "").trim().slice(0, 120),
      value: String(o.value || "").slice(0, 120),
      selected: !!o.selected,
      disabled: !!o.disabled
    }))
  }));

  return {
    capturedAt: new Date().toISOString(),
    url: String(root.location && root.location.href ? root.location.href : ""),
    title: String(root.title || "").slice(0, 200),
    counts: {
      inputs: root.querySelectorAll("input").length,
      selects: root.querySelectorAll("select").length,
      textareas: root.querySelectorAll("textarea").length,
      buttons: root.querySelectorAll("button,input[type='button'],input[type='submit'],input[type='image']").length,
      links: root.querySelectorAll("a[href]").length,
      tables: root.querySelectorAll("table,[role='grid']").length
    },
    selects
  };
}

function writeInventoryPrivate(inventory, options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const dir = options.outDir || path.join(rootDir, "tests", "e2e", "artifacts-private");
  fs.mkdirSync(dir, { recursive: true });
  const safeName = `iapos-inventory-${new Date().toISOString().replace(/[.:]/g, "-")}.private.json`;
  const file = path.join(dir, safeName);
  fs.writeFileSync(file, JSON.stringify(inventory, null, 2), "utf8");
  return file;
}

module.exports = {
  collectSanitizedInventory,
  writeInventoryPrivate
};
