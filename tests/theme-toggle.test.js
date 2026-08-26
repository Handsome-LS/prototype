"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
var index = fs.readFileSync(path.join(root, "index.html"), "utf8");
var styles = fs.readFileSync(path.join(root, "assets", "styles.css"), "utf8");

assert.ok(index.indexOf("data-theme-toggle") >= 0, "the top bar must expose a dark-mode toggle");
assert.ok(index.indexOf('id="i-moon"') >= 0 && index.indexOf('id="i-sun"') >= 0, "the theme toggle must expose both visual states");
assert.ok(app.indexOf("function readThemePreference()") >= 0, "the selected theme must be restored on reload");
assert.ok(app.indexOf("function applyTheme(theme, persist)") >= 0, "theme changes must update the document state");
assert.ok(app.indexOf("finance-prototype-theme") >= 0, "theme preferences must use a stable storage key");
assert.ok(app.indexOf("dashboardChartTheme") >= 0, "ECharts colors must respond to the selected theme");
assert.ok(styles.indexOf('[data-theme="dark"]') >= 0, "dark theme token overrides must be defined");
assert.ok(styles.indexOf(".theme-toggle") >= 0, "the theme control needs dedicated styling");
assert.ok(styles.indexOf('[data-theme="dark"] .amount { color:var(--ink); }') >= 0, "dark mode must not retain the light-only amount text color");
assert.ok(styles.indexOf('[data-theme="dark"] .button-danger') >= 0, "danger buttons need a dark-mode contrast treatment");
assert.ok(styles.indexOf('[data-theme="dark"] .step.is-complete b') >= 0, "completed workflow labels need a readable dark-mode color");
assert.ok(styles.indexOf('[data-theme="dark"] .import-file-status.is-selected strong') >= 0, "selected import file text needs a readable dark-mode color");

console.log("theme-toggle.test.js: all assertions passed");
