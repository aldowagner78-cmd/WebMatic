"use strict";

/*
  Storage minimo basado en JSON en disco.
  Fase 2: solo guarda settings (themeMode, themeVariant).
  Fase 4: se amplia o se reemplaza por electron-store.
*/

const fs   = require("fs");
const path = require("path");

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.cache = this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("[JsonStore] load error:", e.message);
      return {};
    }
  }

  _save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch (e) {
      console.error("[JsonStore] save error:", e.message);
    }
  }

  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(this.cache, key) ? this.cache[key] : fallback;
  }

  set(key, value) {
    this.cache[key] = value;
    this._save();
  }

  getAll() {
    return Object.assign({}, this.cache);
  }
}

module.exports = JsonStore;
