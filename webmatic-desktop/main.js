"use strict";

const { app, BrowserWindow, ipcMain, session, dialog } = require("electron");

// Soporte de directorio de datos aislado para tests E2E
if (process.env.WM_TEST_DATA_DIR) {
  app.setPath("userData", process.env.WM_TEST_DATA_DIR);
}
const path = require("path");
const fs   = require("fs");
const JsonStore    = require("./src/storage/jsonStore");
const iimAdapter   = require("./src/storage/iimAdapter");

let mainWindow   = null;
let settingsStore = null;
let macroStore    = null;

const DEFAULT_SETTINGS = {
  themeMode:      "dark",
  themeVariant:   1,
  startupUrl:     "https://www.google.com/",
  stepDelayMs:    100,
  stepTimeoutMs:  8000
};

function loadSettings() {
  if (settingsStore) return settingsStore.getAll();
  settingsStore = new JsonStore(path.join(app.getPath("userData"), "webmatic-settings.json"));
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (settingsStore.get(k, undefined) === undefined) settingsStore.set(k, DEFAULT_SETTINGS[k]);
  }
  return settingsStore.getAll();
}

function loadMacroStore() {
  if (macroStore) return macroStore;
  macroStore = new JsonStore(path.join(app.getPath("userData"), "webmatic-macros.json"));
  if (!Array.isArray(macroStore.get("macros", null))) macroStore.set("macros", []);
  return macroStore;
}

function createMainWindow() {
  loadSettings();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b0f17",
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      partition: "persist:webmatic"
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  const ses = session.fromPartition("persist:webmatic");
  ses.setUserAgent(ses.getUserAgent() + " WebMaticDesktop/0.1.0");
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── Ventana ───────────────────────────────────────────────────────────
ipcMain.handle("window:minimize",        () => mainWindow && mainWindow.minimize());
ipcMain.handle("window:maximize-toggle", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) { mainWindow.unmaximize(); return false; }
  mainWindow.maximize();
  return true;
});
ipcMain.handle("window:close", () => mainWindow && mainWindow.close());
ipcMain.handle("app:get-version", () => require("./package.json").version);

ipcMain.handle("app:get-webview-preload-path", () =>
  path.join(__dirname, "src", "webview-preload.js")
);

// ── Settings ──────────────────────────────────────────────────────────
ipcMain.handle("settings:get-all", () => loadSettings());
ipcMain.handle("settings:set", (_evt, key, value) => {
  loadSettings();
  settingsStore.set(key, value);
  return settingsStore.getAll();
});

// ── Sesion ────────────────────────────────────────────────────────────
ipcMain.handle("session:clear", async () => {
  await session.fromPartition("persist:webmatic").clearStorageData();
  return true;
});

// ── Scripts de inyeccion ──────────────────────────────────────────────
const ALLOWED_SCRIPTS = {
  "recorder-inject": path.join(__dirname, "src", "recorder", "recorder-inject.js"),
  "player-inject":   path.join(__dirname, "src", "player",   "player-inject.js")
};
ipcMain.handle("scripts:get", (_evt, name) => {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_SCRIPTS, name)) return null;
  return fs.readFileSync(ALLOWED_SCRIPTS[name], "utf8");
});

// ── Macros ────────────────────────────────────────────────────────────
ipcMain.handle("macros:get-all", () => {
  return loadMacroStore().get("macros", []);
});

ipcMain.handle("macros:save", (_evt, name, steps) => {
  const store  = loadMacroStore();
  const macros = store.get("macros", []);
  const id     = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  macros.unshift({ id, name, steps, createdAt: Date.now() });
  store.set("macros", macros);
  return macros;
});

ipcMain.handle("macros:update", (_evt, id, name, steps) => {
  const store  = loadMacroStore();
  const macros = store.get("macros", []).map(m =>
    m.id === id ? Object.assign({}, m, { name, steps, updatedAt: Date.now() }) : m
  );
  store.set("macros", macros);
  return macros;
});

ipcMain.handle("macros:rename", (_evt, id, name) => {
  const store  = loadMacroStore();
  const macros = store.get("macros", []).map(m =>
    m.id === id ? Object.assign({}, m, { name }) : m
  );
  store.set("macros", macros);
  return macros;
});

ipcMain.handle("macros:delete", (_evt, id) => {
  const store  = loadMacroStore();
  const macros = store.get("macros", []).filter(m => m.id !== id);
  store.set("macros", macros);
  return macros;
});

// ── Export / Import .iim ──────────────────────────────────────────────────
ipcMain.handle("macro:export-file", async (_evt, name, steps) => {
  const content  = iimAdapter.serialize(name, steps);
  const safeName = (name || "macro").replace(/[^\w\-. ]/g, "_").trim();
  const result   = await dialog.showSaveDialog(mainWindow, {
    title:       "Exportar macro",
    defaultPath: safeName + ".iim",
    filters:     [
      { name: "WebMatic Macro", extensions: ["iim"] },
      { name: "Todos",          extensions: ["*"]   }
    ]
  });
  if (result.canceled || !result.filePath) return { ok: false };
  fs.writeFileSync(result.filePath, content, "utf8");
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle("macro:import-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title:      "Importar macro",
    filters:    [
      { name: "WebMatic Macro", extensions: ["iim"] },
      { name: "Todos",          extensions: ["*"]   }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const content      = fs.readFileSync(result.filePaths[0], "utf8");
  const fallbackName = path.basename(result.filePaths[0], ".iim");
  return iimAdapter.deserialize(content, fallbackName);
});

// ── Importar favoritos desde navegador (Chrome / Edge) ───────────────────
ipcMain.handle("bookmarks:import-browser", async () => {
  // Candidatos: Chrome y Edge en Windows
  const candidates = [
    { browser: "Chrome", file: path.join(app.getPath("appData"), "..", "Local", "Google", "Chrome", "User Data", "Default", "Bookmarks") },
    { browser: "Edge",   file: path.join(app.getPath("appData"), "..", "Local", "Microsoft", "Edge", "User Data", "Default", "Bookmarks") },
    { browser: "Brave",  file: path.join(app.getPath("appData"), "..", "Local", "BraveSoftware", "Brave-Browser", "User Data", "Default", "Bookmarks") }
  ];

  // Muestra dialogo para elegir cual navegador importar
  const available = candidates.filter(c => fs.existsSync(c.file));
  if (!available.length) return { ok: false, error: "No se encontraron favoritos de Chrome, Edge ni Brave." };

  // Elige el primero disponible o pide al usuario elegir el archivo
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecciona el archivo Bookmarks de tu navegador",
    defaultPath: available[0].file,
    filters: [{ name: "Bookmarks", extensions: ["Bookmarks", "json", "*"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths.length) return { ok: false, error: "cancelado" };

  let raw;
  try { raw = JSON.parse(fs.readFileSync(result.filePaths[0], "utf8")); }
  catch (e) { return { ok: false, error: "No se pudo leer el archivo: " + e.message }; }

  // Recorre recursivamente el arbol de nodos del JSON de Chromium
  function extractBookmarks(node) {
    const list = [];
    if (node.type === "url" && node.url && !/^javascript:/i.test(node.url)) {
      list.push({ title: (node.name || node.url).trim(), url: node.url });
    }
    if (node.children) node.children.forEach(c => list.push(...extractBookmarks(c)));
    return list;
  }

  const roots = raw.roots || {};
  const all = [
    ...extractBookmarks(roots.bookmark_bar  || {}),
    ...extractBookmarks(roots.other         || {}),
    ...extractBookmarks(roots.synced        || {})
  ];
  return { ok: true, bookmarks: all };
});
