#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

const mode = (process.argv[2] || "fast").toLowerCase();
const allowed = new Set(["fast", "full"]);

if (!allowed.has(mode)) {
  console.error("[verify-v2-firefox] Modo invalido. Usar: fast | full");
  process.exit(1);
}

if (mode === "fast") {
  console.log("[verify-v2-firefox] AVISO: fast NO es release gate completo (falta test:e2e:firefox-extension)");
}

const steps = [
  "npm test",
  "npm run test:e2e:fixtures",
  "npm run test:e2e"
];

if (mode === "full") {
  steps.push("npm run test:e2e:firefox-extension");
}

for (const cmd of steps) {
  console.log("\n[verify-v2-firefox] Ejecutando:", cmd);
  const result = spawnSync(cmd, {
    stdio: "inherit",
    shell: true,
    env: process.env
  });

  if (typeof result.status === "number" && result.status !== 0) {
    console.error("[verify-v2-firefox] Falla en:", cmd);
    process.exit(result.status);
  }

  if (result.error) {
    console.error("[verify-v2-firefox] Error ejecutando:", cmd);
    console.error(result.error.message || String(result.error));
    process.exit(1);
  }
}

console.log(`\n[verify-v2-firefox] OK (${mode})`);
