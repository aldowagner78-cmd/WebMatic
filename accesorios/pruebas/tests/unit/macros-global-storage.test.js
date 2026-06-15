const test = require("node:test");
const assert = require("node:assert/strict");

const macrosGlobal = require("../../../../src/modules/storage/macros-global.js");

test("macros globales: guardar en origen A se lee en origen B", () => {
  const globalStorage = {};
  const macrosA = [{ id: "m1", name: "Desde A", steps: [{ type: "click", selector: "#x" }] }];

  // Simula guardado en tab/origen A (Google)
  Object.assign(globalStorage, macrosGlobal.buildMacrosStoragePatch(macrosA));

  // Simula lectura en tab/origen B (GitHub Pages)
  const readFromB = macrosGlobal.readMacrosFromStorageSnapshot(globalStorage);
  assert.equal(Array.isArray(readFromB), true);
  assert.equal(readFromB.length, 1);
  assert.equal(readFromB[0].name, "Desde A");
});

test("macros globales: renombrar y borrar en origen B impacta lectura en origen A", () => {
  const globalStorage = {};
  const initial = [
    { id: "m1", name: "Macro 1", steps: [] },
    { id: "m2", name: "Macro 2", steps: [] }
  ];
  Object.assign(globalStorage, macrosGlobal.buildMacrosStoragePatch(initial));

  // Simula edición en origen B
  const fromB = macrosGlobal.readMacrosFromStorageSnapshot(globalStorage)
    .map((m) => (m.id === "m1" ? { ...m, name: "Macro 1 Renombrada" } : m))
    .filter((m) => m.id !== "m2");
  Object.assign(globalStorage, macrosGlobal.buildMacrosStoragePatch(fromB));

  // Simula lectura posterior en origen A
  const readFromA = macrosGlobal.readMacrosFromStorageSnapshot(globalStorage);
  assert.equal(readFromA.length, 1);
  assert.equal(readFromA[0].id, "m1");
  assert.equal(readFromA[0].name, "Macro 1 Renombrada");
});

test("macros globales: extractMacrosFromStorageChange detecta cambios solo en area local", () => {
  const nextMacros = [{ id: "m9", name: "Nueve", steps: [] }];
  const changes = {
    [macrosGlobal.getMacrosStorageKey()]: {
      oldValue: [],
      newValue: nextMacros
    }
  };

  const localHit = macrosGlobal.extractMacrosFromStorageChange(changes, "local");
  const syncMiss = macrosGlobal.extractMacrosFromStorageChange(changes, "sync");

  assert.equal(Array.isArray(localHit), true);
  assert.equal(localHit.length, 1);
  assert.equal(syncMiss, null);
});
