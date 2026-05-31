// playwright.config.js
"use strict";

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  timeout:         30_000,
  retries:         0,
  workers:         1,       // Electron no admite ejecucion paralela
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }]
  ],
  use: {
    screenshot: "only-on-failure",
    video:      "off"
  }
});
