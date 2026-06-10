"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const fsHandle = require("../../../../src/modules/storage/fs-handle.js");

test("sanitizeFolderName limpia separadores e inválidos", () => {
  const out = fsHandle.sanitizeFolderName("  mis\\exports/2026:*?  ");
  assert.equal(out, "mis-exports-2026");
});

test("sanitizeFolderName recorta nombres vacíos o peligrosos", () => {
  assert.equal(fsHandle.sanitizeFolderName("   "), "");
  assert.equal(fsHandle.sanitizeFolderName("...."), "");
});

test("sanitizeRelativeFilename quita traversal y conserva subrutas válidas", () => {
  const out = fsHandle.sanitizeRelativeFilename("../macros/./demo..//macro?.json");
  assert.equal(out, "macros/demo../macro.json");
});

test("sanitizeRelativeFilename aplica fallback cuando no queda nada", () => {
  const out = fsHandle.sanitizeRelativeFilename("../.././../");
  assert.equal(out, "webmatic-export.txt");
});

test("buildExportFilename une subcarpeta segura + filename seguro", () => {
  const out = fsHandle.buildExportFilename("  mis/exportaciones ", "macros/nueva:macro.json");
  assert.equal(out, "mis-exportaciones/macros/nuevamacro.json");
});

test("buildExportFilename funciona sin subcarpeta", () => {
  const out = fsHandle.buildExportFilename("", "metadatos/tabla.txt");
  assert.equal(out, "metadatos/tabla.txt");
});
