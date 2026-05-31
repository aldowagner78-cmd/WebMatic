"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const theme = require("./src/ui/theme");

contextBridge.exposeInMainWorld("wmDesktop", {
  window: {
    minimize:       () => ipcRenderer.invoke("window:minimize"),
    maximizeToggle: () => ipcRenderer.invoke("window:maximize-toggle"),
    close:          () => ipcRenderer.invoke("window:close")
  },
  app: {
    getVersion:            () => ipcRenderer.invoke("app:get-version"),
    getWebviewPreloadPath: () => ipcRenderer.invoke("app:get-webview-preload-path")
  },
  settings: {
    getAll: ()           => ipcRenderer.invoke("settings:get-all"),
    set:    (key, value) => ipcRenderer.invoke("settings:set", key, value)
  },
  session: {
    clear: () => ipcRenderer.invoke("session:clear")
  },
  theme: {
    PALETTES:       theme.THEME_PALETTES,
    VARIANT_LABELS: theme.VARIANT_LABELS,
    resolve:        theme.resolvePalette,
    apply:          theme.applyPaletteToDocument
  },
  scripts: {
    get: (name) => ipcRenderer.invoke("scripts:get", name)
  },
  macros: {
    getAll:     ()                => ipcRenderer.invoke("macros:get-all"),
    save:       (name, steps)     => ipcRenderer.invoke("macros:save",          name, steps),
    update:     (id, name, steps) => ipcRenderer.invoke("macros:update",        id, name, steps),
    rename:     (id, name)        => ipcRenderer.invoke("macros:rename",        id, name),
    delete:     (id)              => ipcRenderer.invoke("macros:delete",        id),
    exportFile: (name, steps)     => ipcRenderer.invoke("macro:export-file",   name, steps),
    importFile: ()                => ipcRenderer.invoke("macro:import-file")
  },
  bookmarks: {
    importBrowser: () => ipcRenderer.invoke("bookmarks:import-browser")
  }
});
