"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var app = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
var styles = fs.readFileSync(path.join(__dirname, "..", "assets", "styles.css"), "utf8");

assert.ok(app.indexOf('document.body.appendChild(helpTooltip);') >= 0, "help tooltip must escape local overflow containers");
assert.ok(app.indexOf('helpTooltip.setAttribute("role", "tooltip")') >= 0, "help tooltip must expose tooltip semantics");
assert.ok(app.indexOf('document.addEventListener("focusin"') >= 0, "help tooltip must support keyboard focus");
assert.ok(app.indexOf('document.addEventListener("scroll", hideHelpTooltip, true)') >= 0, "help tooltip must close when its anchor scrolls");
assert.ok(app.indexOf('var placement = spaceAbove') >= 0, "help tooltip must choose an available vertical placement");
assert.ok(app.indexOf('"工厂账单号": "工厂提供的原始账单编号') >= 0, "factory bill number column must explain the external identifier");
assert.ok(app.indexOf("不同于平台生成的账单 ID") >= 0, "factory bill number help must distinguish it from the internal bill ID");

assert.ok(/\.help-tooltip\s*\{[^}]*position:fixed;[^}]*z-index:200;/.test(styles), "help tooltip must use a viewport-level fixed layer");
assert.ok(styles.indexOf("max-width:min(330px,calc(100vw - 24px))") >= 0, "help tooltip must stay within narrow viewports");
assert.ok(styles.indexOf(".help::after { content:attr(data-tip)") < 0, "help text must not be rendered inside a clipped pseudo-element");

console.log("help-tooltip.test.js: all assertions passed");
