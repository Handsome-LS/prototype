"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var app = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
var index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
var fieldGuide = fs.readFileSync(path.join(__dirname, "..", "..", "财务模块_原型页面字段说明_V2.md"), "utf8");

assert.strictEqual(index.indexOf('data-nav="import"'), -1, "factory bill import must not remain a sidebar destination");
assert.ok(app.indexOf("data-open-factory-import") >= 0, "factory bill list must expose the import action");
assert.ok(app.indexOf("function openFactoryImportModal(resetStep)") >= 0, "factory bill import must open as a modal workflow");
assert.ok(app.indexOf('modal.dataset.view = "factoryImport"') >= 0, "factory import modal must retain its workflow state");
assert.ok(app.indexOf('if (modal.dataset.view === "factoryImport") openFactoryImportModal(false)') >= 0, "next-step actions must refresh the modal instead of the page");
assert.strictEqual(app.indexOf('if (state.page === "import")'), -1, "factory bill import must not retain an independent page route");
assert.ok(fieldGuide.indexOf("导入工厂账单不作为独立菜单或页面展示") >= 0, "field guide must document the modal entry point");

console.log("factory-bill-import-modal.test.js: all assertions passed");
