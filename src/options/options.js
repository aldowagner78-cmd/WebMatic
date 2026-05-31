const extensionApi = typeof browser !== "undefined" ? browser : chrome;
const themePalettes = {
  light: ["#059669", "#0284c7", "#7c3aed", "#dc2626"],
  dark: ["#34d399", "#38bdf8", "#a78bfa", "#f87171"]
};

let selectedSide = "left";
let selectedThemeMode = "light";
let selectedThemeVariant = 1;
let selectedSpeed = 1;
let selectedOpacity = 1;

async function getSettings() {
  const defaults = {
    panelSide: "left",
    panelWidth: 260,
    speed: 1,
    retryCount: 3,
    retryDelayMs: 500,
    theme: "light",
    themeMode: "light",
    themeVariant: 1
  };

  const result = await extensionApi.storage.local.get("webmaticSettings");
  return { ...defaults, ...(result.webmaticSettings || {}) };
}

async function saveSettings(patch) {
  const current = await getSettings();
  const merged = { ...current, ...patch };
  await extensionApi.storage.local.set({ webmaticSettings: merged });
  return merged;
}

function renderSideButtons() {
  const left = document.getElementById("sideLeft");
  const right = document.getElementById("sideRight");
  left.classList.toggle("active", selectedSide === "left");
  right.classList.toggle("active", selectedSide === "right");
}

function renderSwatches() {
  const row = document.getElementById("swatchRow");
  const label = document.getElementById("swatchLabel");
  row.style.display = "grid";
  if (label) {
    label.style.display = "block";
  }

  const colors = themePalettes[selectedThemeMode];
  row.innerHTML = colors
    .map((color, index) => {
      const variant = index + 1;
      const activeClass = variant === selectedThemeVariant ? " active" : "";
      return `<button type="button" class="swatch${activeClass}" data-variant="${variant}" style="background:${color}"></button>`;
    })
    .join("");
}

async function loadForm() {
  const settings = await getSettings();
  selectedSide = settings.panelSide === "right" ? "right" : "left";
  selectedThemeMode = settings.themeMode === "dark" ? "dark" : "light";
  selectedThemeVariant = Number(settings.themeVariant) >= 1 && Number(settings.themeVariant) <= 4 ? Number(settings.themeVariant) : 1;
  selectedSpeed = settings.speed ?? 1;
  selectedOpacity = settings.panelOpacity ?? 1;

  document.getElementById("themeModeDark").checked = selectedThemeMode === "dark";

  const speedSlider = document.getElementById("speedSlider");
  const speedLabel = document.getElementById("speedLabel");
  if (speedSlider) {
    speedSlider.value = String(selectedSpeed);
    if (speedLabel) speedLabel.textContent = `${selectedSpeed}×`;
  }

  const opacitySlider = document.getElementById("opacitySlider");
  const opacityLabel = document.getElementById("opacityLabel");
  if (opacitySlider) {
    opacitySlider.value = String(selectedOpacity);
    if (opacityLabel) opacityLabel.textContent = `${Math.round(selectedOpacity * 100)}%`;
  }

  // Load saved export folder name
  const fsHandle = (typeof WebMaticFsHandle !== "undefined") ? WebMaticFsHandle : null;
  if (fsHandle) {
    fsHandle.getHandle().then((saved) => {
      const folderInput = document.getElementById("folderInput");
      const clearBtn = document.getElementById("folderClearBtn");
      if (folderInput) folderInput.value = saved ? saved.name : "";
      if (clearBtn) {
        if (saved && saved.name) clearBtn.removeAttribute("hidden");
        else clearBtn.setAttribute("hidden", "");
      }
    }).catch(() => {});
  }

  renderSideButtons();
  renderSwatches();
}

async function saveFolderName(name) {
  const fsHandle = (typeof WebMaticFsHandle !== "undefined") ? WebMaticFsHandle : null;
  if (!fsHandle) return;
  if (name) {
    await fsHandle.setFolderName(name);
  } else {
    await fsHandle.clearHandle().catch(() => {});
  }
}

async function onSave() {
  const status = document.getElementById("status");
  status.textContent = "Guardando...";

  try {
    await saveSettings({
      panelSide: selectedSide,
      panelWidth: 260,
      themeMode: selectedThemeMode,
      themeVariant: selectedThemeVariant,
      speed: selectedSpeed,
      panelOpacity: selectedOpacity
    });

    status.textContent = "Configuracion guardada";
    setTimeout(() => {
      status.textContent = "";
    }, 1800);
  } catch (error) {
    status.textContent = `Error al guardar: ${error?.message || "desconocido"}`;
  }
}

function initOptionsPage() {
  const saveBtn = document.getElementById("saveBtn");
  if (!saveBtn) {
    return;
  }

  document.getElementById("sideLeft").addEventListener("click", () => {
    selectedSide = "left";
    renderSideButtons();
  });

  document.getElementById("sideRight").addEventListener("click", () => {
    selectedSide = "right";
    renderSideButtons();
  });

  document.getElementById("themeModeDark").addEventListener("change", (event) => {
    selectedThemeMode = event.target.checked ? "dark" : "light";
    renderSwatches();
  });

  document.getElementById("swatchRow").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const variant = Number(target.dataset.variant || "0");
    if (variant >= 1 && variant <= 4) {
      selectedThemeVariant = variant;
      renderSwatches();
    }
  });

  saveBtn.addEventListener("click", onSave);

  // Folder text input — save on blur or Enter
  const folderInput = document.getElementById("folderInput");
  const folderClearBtn = document.getElementById("folderClearBtn");
  if (folderInput) {
    const applyFolder = async () => {
      const name = folderInput.value.trim().replace(/[\\/]/g, "");
      folderInput.value = name;
      await saveFolderName(name);
      if (folderClearBtn) {
        if (name) folderClearBtn.removeAttribute("hidden");
        else folderClearBtn.setAttribute("hidden", "");
      }
    };
    folderInput.addEventListener("blur", applyFolder);
    folderInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { folderInput.blur(); } });
  }
  if (folderClearBtn) {
    folderClearBtn.addEventListener("click", async () => {
      if (folderInput) folderInput.value = "";
      await saveFolderName("");
      folderClearBtn.setAttribute("hidden", "");
    });
  }

  const speedSlider = document.getElementById("speedSlider");
  const speedLabel = document.getElementById("speedLabel");
  if (speedSlider) {
    speedSlider.addEventListener("input", () => {
      selectedSpeed = parseFloat(speedSlider.value);
      if (speedLabel) speedLabel.textContent = `${selectedSpeed}×`;
    });
  }

  const opacitySlider = document.getElementById("opacitySlider");
  const opacityLabel = document.getElementById("opacityLabel");
  if (opacitySlider) {
    opacitySlider.addEventListener("input", () => {
      selectedOpacity = parseFloat(opacitySlider.value);
      if (opacityLabel) opacityLabel.textContent = `${Math.round(selectedOpacity * 100)}%`;
    });
  }

  loadForm();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOptionsPage);
} else {
  initOptionsPage();
}
