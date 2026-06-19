(function initUiStyleUtils(globalScope) {
  function applyThemePalette(panel, palette) {
    if (!panel || !palette) return;
    panel.style.setProperty("--webmatic-accent",        palette.accent);
    panel.style.setProperty("--webmatic-accent-fg",     palette.accentFg);
    panel.style.setProperty("--webmatic-surface",       palette.surface);
    panel.style.setProperty("--webmatic-surface-2",     palette.surface2);
    panel.style.setProperty("--webmatic-btn-bg",        palette.btnBg);
    panel.style.setProperty("--webmatic-btn-hover",     palette.btnHover);
    panel.style.setProperty("--webmatic-border",        palette.border);
    panel.style.setProperty("--webmatic-swatch-border", palette.swatchBorder);
    panel.style.setProperty("--webmatic-text",          palette.text);
    panel.style.setProperty("--webmatic-text-muted",    palette.textMuted);
    panel.style.setProperty("--webmatic-card-bg",       palette.cardBg);
    panel.style.setProperty("--webmatic-scrollbar",     palette.scrollbar);
    panel.style.setProperty("--webmatic-header-from",   palette.headerFrom);
    panel.style.setProperty("--webmatic-header-to",     palette.headerTo);
    panel.style.setProperty("--webmatic-header-text",   palette.headerText);
  }

  function applyModeButtonStyle(btn, palette) {
    if (!btn) return;
    const isActive = btn.classList.contains("active");
    btn.style.background = isActive ? palette.activeBg : palette.bg;
    btn.style.color = isActive ? palette.activeText : palette.text;
    btn.style.borderColor = isActive ? palette.activeBorder : palette.border;
    btn.style.borderRadius = "14px";
    btn.style.minHeight = "33px";
    btn.style.fontWeight = "800";
    btn.style.fontSize = "10.5px";
    btn.style.letterSpacing = "0.1px";
    btn.style.textTransform = "none";
    btn.style.padding = "6px 5px";
    btn.style.overflow = "hidden";
    btn.style.textOverflow = "ellipsis";
    btn.style.whiteSpace = "nowrap";
    btn.style.boxShadow = isActive
      ? (palette.activeShadow || "inset 0 0 0 1px rgba(255,255,255,0.45), 0 0 0 2px rgba(0,0,0,0.08)")
      : "inset 0 0 0 1px rgba(255,255,255,0.16)";
    btn.style.filter = isActive
      ? (palette.activeFilter || "saturate(1.15) brightness(1.02)")
      : "saturate(0.9)";
    btn.style.transform = isActive ? (palette.activeTransform || "translateY(0)") : "translateY(0)";
  }

  const api = {
    applyThemePalette,
    applyModeButtonStyle
  };

  globalScope.WebMaticUiStyleUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
