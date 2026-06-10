(function initFsHandle(globalScope) {
  const extensionApi = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  const STORAGE_KEY = "webmaticExportFolder";

  function sanitizeFolderName(name) {
    const raw = String(name || "").trim();
    if (!raw) return "";

    const cleaned = raw
      .replace(/[\\/]+/g, "-")
      .replace(/[\x00-\x1F<>:"|?*]+/g, "")
      .replace(/\s+/g, " ")
      .replace(/^\.+/, "")
      .trim();

    return cleaned.slice(0, 80);
  }

  function sanitizeRelativeFilename(filename) {
    const raw = String(filename || "").trim().replace(/\\/g, "/");
    if (!raw) return "webmatic-export.txt";

    const safeSegments = raw
      .split("/")
      .map((segment) => String(segment || "").trim())
      .filter((segment) => segment && segment !== "." && segment !== "..")
      .map((segment) => segment
        .replace(/[\x00-\x1F<>:"|?*]+/g, "")
        .replace(/^\.+/, "")
        .trim()
      )
      .filter(Boolean);

    if (!safeSegments.length) return "webmatic-export.txt";
    return safeSegments.join("/");
  }

  function buildExportFilename(folderName, filename) {
    const safeFolder = sanitizeFolderName(folderName);
    const safeFilename = sanitizeRelativeFilename(filename);
    return safeFolder ? `${safeFolder}/${safeFilename}` : safeFilename;
  }

  function storageSet(value) {
    return new Promise((resolve) => {
      extensionApi.storage.local.set({ [STORAGE_KEY]: value }, resolve);
    });
  }

  function storageGet() {
    return new Promise((resolve) => {
      extensionApi.storage.local.get(STORAGE_KEY, (r) => {
        resolve((r && r[STORAGE_KEY]) || null);
      });
    });
  }

  function storageRemove() {
    return new Promise((resolve) => {
      extensionApi.storage.local.remove(STORAGE_KEY, resolve);
    });
  }

  /**
   * Saves a folder name string to extension storage.
   * @param {string} name  Subfolder name within Downloads (e.g. "mis-macros")
   */
  async function setFolderName(name) {
    const safeName = sanitizeFolderName(name);
    if (safeName) {
      await storageSet(safeName);
    } else {
      await storageRemove();
    }
  }

  /** @deprecated No-op kept for API compatibility */
  async function pickFolder() { return null; }

  /**
   * Returns { name } if a folder is configured, else null.
   * Works in both background and options page.
   */
  async function getHandle() {
    if (!extensionApi) return null;
    const name = await storageGet();
    return name ? { name } : null;
  }

  /**
   * Clears the stored folder name.
   */
  async function clearHandle() {
    if (!extensionApi) return;
    await storageRemove();
  }

  // writeFile is handled by background via chrome.downloads — kept as no-op for API compatibility
  async function writeFile() {}

  globalScope.WebMaticFsHandle = {
    pickFolder,
    setFolderName,
    getHandle,
    writeFile,
    clearHandle,
    sanitizeFolderName,
    sanitizeRelativeFilename,
    buildExportFilename
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.WebMaticFsHandle;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
