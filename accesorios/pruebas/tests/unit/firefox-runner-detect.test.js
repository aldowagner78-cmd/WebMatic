"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectFirefoxCandidates,
  detectExecutableCandidates,
  resolveFirefoxBinary,
  resolveFirstExistingExecutable,
  normalizeCandidatePath
} = require("../e2e/firefox-extension-safe/run.js");

test("normalizeCandidatePath: convierte ruta MSYS a Windows", () => {
  const out = normalizeCandidatePath("/c/Program Files/Mozilla Firefox/firefox", "win32");
  assert.equal(out, "C:\\Program Files\\Mozilla Firefox\\firefox");
});

test("detectFirefoxCandidates: prioriza FIREFOX_BIN y rutas de where en Windows", () => {
  const fakeSpawn = (cmd, args) => {
    if (cmd !== "where") return { status: 1, stdout: "" };
    if (args[0] === "firefox" || args[0] === "firefox.exe") {
      return {
        status: 0,
        stdout: "C:\\Custom\\Firefox\\firefox.exe\r\n"
      };
    }
    return { status: 1, stdout: "" };
  };

  const candidates = detectFirefoxCandidates({
    platform: "win32",
    env: { FIREFOX_BIN: "D:\\Apps\\Firefox\\firefox.exe" },
    spawnSyncImpl: fakeSpawn
  });

  assert.equal(candidates[0], "D:\\Apps\\Firefox\\firefox.exe");
  assert.ok(candidates.includes("C:\\Custom\\Firefox\\firefox.exe"));
  assert.ok(candidates.includes("C:\\Program Files\\Mozilla Firefox\\firefox.exe"));
});

test("resolveFirstExistingExecutable: devuelve primer ejecutable existente", () => {
  const fakeFs = {
    existsSync: (p) => p === "C:/ok/tool.exe",
    realpathSync: (p) => p
  };

  const picked = resolveFirstExistingExecutable(["C:/missing.exe", "C:/ok/tool.exe"], { fsApi: fakeFs });
  assert.equal(picked, "C:/ok/tool.exe");
});

test("resolveFirefoxBinary: en Windows no descarta Firefox si --version falla", () => {
  const warnings = [];
  const fakeFs = {
    existsSync: (p) => p === "C:/Program Files/Mozilla Firefox/firefox.exe",
    realpathSync: (p) => p
  };
  const fakeSpawn = (cmd, args) => {
    if (cmd === "C:/Program Files/Mozilla Firefox/firefox.exe" && args[0] === "--version") {
      return { status: 1, stdout: "", stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };

  const bin = resolveFirefoxBinary({
    platform: "win32",
    candidates: ["C:/Program Files/Mozilla Firefox/firefox.exe"],
    fsApi: fakeFs,
    spawnSyncImpl: fakeSpawn,
    log: (msg) => warnings.push(msg)
  });

  assert.equal(bin, "C:/Program Files/Mozilla Firefox/firefox.exe");
  assert.ok(warnings.some((w) => w.includes("--version")));
});

test("detectExecutableCandidates: usa variable de entorno y where para zip en Windows", () => {
  const fakeSpawn = (cmd, args) => {
    if (cmd !== "where") return { status: 1, stdout: "" };
    if (args[0] === "zip" || args[0] === "zip.exe") {
      return {
        status: 0,
        stdout: "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\zip.exe\r\n"
      };
    }
    return { status: 1, stdout: "" };
  };

  const candidates = detectExecutableCandidates({
    platform: "win32",
    env: { ZIP_BIN: "D:\\Tools\\zip.exe" },
    envVarName: "ZIP_BIN",
    commandName: "zip",
    windowsFallbacks: ["C:\\fallback\\zip.exe"],
    spawnSyncImpl: fakeSpawn
  });

  assert.equal(candidates[0], "D:\\Tools\\zip.exe");
  assert.ok(candidates.includes("C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\zip.exe"));
  assert.ok(candidates.includes("C:\\fallback\\zip.exe"));
});
