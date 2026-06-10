"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(ROOT, "dist", "chromium-unpacked");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(source, target);
    } else if (entry.isFile()) {
      copyFile(source, target);
    }
  }
}

function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  ensureDir(OUT_DIR);

  copyFile(path.join(ROOT, "chromium", "manifest.json"), path.join(OUT_DIR, "manifest.json"));
  copyDir(path.join(ROOT, "chromium"), path.join(OUT_DIR, "chromium"));
  copyDir(path.join(ROOT, "src"), path.join(OUT_DIR, "src"));
  copyFile(path.join(ROOT, "logo16.png"), path.join(OUT_DIR, "logo16.png"));
  copyFile(path.join(ROOT, "logo32.png"), path.join(OUT_DIR, "logo32.png"));
  copyFile(path.join(ROOT, "logo48.png"), path.join(OUT_DIR, "logo48.png"));
  copyFile(path.join(ROOT, "logo128.png"), path.join(OUT_DIR, "logo128.png"));

  console.log(`Chromium unpacked listo en: ${OUT_DIR}`);
}

main();