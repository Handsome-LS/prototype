"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
var styles = fs.readFileSync(path.join(root, "assets", "styles.css"), "utf8");

assert.ok(app.indexOf('type="file"') >= 0, "bill imports must expose a real file input");
assert.ok(app.indexOf('data-import-file="factory"') >= 0, "factory import must own a spreadsheet input");
assert.ok(app.indexOf('data-import-file="logistics"') >= 0, "logistics import must own a spreadsheet input");
assert.ok(app.indexOf('accept=".xlsx,.xls,.csv"') >= 0, "bill imports must declare supported spreadsheet formats");
assert.ok(app.indexOf("data-import-prev") >= 0, "multi-step imports must expose a previous-step action");
assert.ok(app.indexOf("state.importStep = Math.max(1, state.importStep - 1)") >= 0, "previous-step actions must update workflow state safely");
assert.ok(app.indexOf("确认导入并开始匹配") >= 0, "step four must be an explicit final confirmation");
assert.ok(styles.indexOf(".import-upload") >= 0, "the spreadsheet selector must have a visible upload treatment");

console.log("bill-import-upload-navigation.test.js: all assertions passed");
