"use strict";

/*
  WebMatic Desktop — Sistema de temas
  -----------------------------------
  Reutiliza las 8 paletas de la extensión original
  (src/modules/ui/ui-shell.js → THEME_PALETTES).
*/

const THEME_PALETTES = {
  light: [
    // Variante 1 — Verde esmeralda
    { accent:"#059669", accentFg:"#ffffff", surface:"#f0fdf4", surface2:"#dcfce7", btnBg:"#ecfdf5", btnHover:"#d1fae5", border:"#a7f3d0", swatchBorder:"#6ee7b7", text:"#064e3b", textMuted:"#065f46", cardBg:"#ffffff", scrollbar:"#6ee7b7", headerFrom:"#065f46", headerTo:"#10b981", headerText:"#ffffff" },
    // Variante 2 — Azul cielo
    { accent:"#0284c7", accentFg:"#ffffff", surface:"#f0f9ff", surface2:"#e0f2fe", btnBg:"#e0f2fe", btnHover:"#bae6fd", border:"#7dd3fc", swatchBorder:"#38bdf8", text:"#0c4a6e", textMuted:"#075985", cardBg:"#ffffff", scrollbar:"#7dd3fc", headerFrom:"#0c4a6e", headerTo:"#0ea5e9", headerText:"#ffffff" },
    // Variante 3 — Violeta
    { accent:"#7c3aed", accentFg:"#ffffff", surface:"#faf5ff", surface2:"#ede9fe", btnBg:"#ede9fe", btnHover:"#ddd6fe", border:"#c4b5fd", swatchBorder:"#a78bfa", text:"#3b0764", textMuted:"#4c1d95", cardBg:"#ffffff", scrollbar:"#c4b5fd", headerFrom:"#4c1d95", headerTo:"#8b5cf6", headerText:"#ffffff" },
    // Variante 4 — Rojo
    { accent:"#dc2626", accentFg:"#ffffff", surface:"#fef2f2", surface2:"#fee2e2", btnBg:"#fee2e2", btnHover:"#fecaca", border:"#fca5a5", swatchBorder:"#f87171", text:"#7f1d1d", textMuted:"#991b1b", cardBg:"#ffffff", scrollbar:"#fca5a5", headerFrom:"#7f1d1d", headerTo:"#ef4444", headerText:"#ffffff" }
  ],
  dark: [
    // Variante 1 — Verde oscuro
    { accent:"#34d399", accentFg:"#022c22", surface:"#022c22", surface2:"#064e3b", btnBg:"#065f46", btnHover:"#047857", border:"#047857", swatchBorder:"#059669", text:"#d1fae5", textMuted:"#6ee7b7", cardBg:"#064e3b", scrollbar:"#047857", headerFrom:"#022c22", headerTo:"#065f46", headerText:"#a7f3d0" },
    // Variante 2 — Azul oscuro
    { accent:"#38bdf8", accentFg:"#0c1a2e", surface:"#0c1a2e", surface2:"#0c2d4a", btnBg:"#0c4a6e", btnHover:"#075985", border:"#0369a1", swatchBorder:"#0284c7", text:"#e0f2fe", textMuted:"#7dd3fc", cardBg:"#0c2d4a", scrollbar:"#0369a1", headerFrom:"#0c1a2e", headerTo:"#0c4a6e", headerText:"#bae6fd" },
    // Variante 3 — Violeta oscuro
    { accent:"#a78bfa", accentFg:"#1e1b2e", surface:"#1e1b2e", surface2:"#2d1b69", btnBg:"#2e1065", btnHover:"#4c1d95", border:"#4c1d95", swatchBorder:"#7c3aed", text:"#ede9fe", textMuted:"#c4b5fd", cardBg:"#2d1b69", scrollbar:"#4c1d95", headerFrom:"#1e1b2e", headerTo:"#4c1d95", headerText:"#ddd6fe" },
    // Variante 4 — Rojo oscuro
    { accent:"#f87171", accentFg:"#2a1515", surface:"#2a1515", surface2:"#450a0a", btnBg:"#7f1d1d", btnHover:"#991b1b", border:"#991b1b", swatchBorder:"#dc2626", text:"#fee2e2", textMuted:"#fca5a5", cardBg:"#450a0a", scrollbar:"#991b1b", headerFrom:"#2a1515", headerTo:"#7f1d1d", headerText:"#fecaca" }
  ]
};

const VARIANT_LABELS = ["Verde", "Azul", "Violeta", "Rojo"];

function resolvePalette(mode, variant) {
  const m   = (mode === "dark") ? "dark" : "light";
  const idx = (Number.isInteger(variant) && variant >= 1 && variant <= 4) ? (variant - 1) : 0;
  return { palette: THEME_PALETTES[m][idx], mode: m, variant: idx + 1 };
}

function applyPaletteToDocument(palette, mode) {
  const r = document.documentElement.style;
  r.setProperty("--wm-accent",       palette.accent);
  r.setProperty("--wm-accent-fg",    palette.accentFg);
  r.setProperty("--wm-surface",      palette.surface);
  r.setProperty("--wm-surface-2",    palette.surface2);
  r.setProperty("--wm-btn-bg",       palette.btnBg);
  r.setProperty("--wm-btn-hover",    palette.btnHover);
  r.setProperty("--wm-border",       palette.border);
  r.setProperty("--wm-swatch-bd",    palette.swatchBorder);
  r.setProperty("--wm-text",         palette.text);
  r.setProperty("--wm-text-muted",   palette.textMuted);
  r.setProperty("--wm-card-bg",      palette.cardBg);
  r.setProperty("--wm-scrollbar",    palette.scrollbar);
  r.setProperty("--wm-header-from",  palette.headerFrom);
  r.setProperty("--wm-header-to",    palette.headerTo);
  r.setProperty("--wm-header-text",  palette.headerText);
  document.documentElement.setAttribute("data-wm-mode", mode);
}

module.exports = {
  THEME_PALETTES,
  VARIANT_LABELS,
  resolvePalette,
  applyPaletteToDocument
};
