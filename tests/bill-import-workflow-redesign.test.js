"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
var styles = fs.readFileSync(path.join(root, "assets", "styles.css"), "utf8");

assert.ok(app.indexOf("选择主体与上传账单") >= 0, "step one must select the party, enter bill number, and upload");
assert.ok(app.indexOf("data-import-map") >= 0, "step two must expose editable header mappings");
assert.ok(app.indexOf("data-import-template") >= 0, "step two must list templates for the current party");
assert.ok(app.indexOf("data-apply-import-template") >= 0, "a saved template must be applicable to current headers");
assert.ok(app.indexOf("data-save-import-template") >= 0, "the current mapping must be saveable as a party template");
assert.ok(app.indexOf('data-import-field="periodStart"') >= 0, "step three must expose an editable period start read from the file");
assert.ok(app.indexOf('data-import-field="periodEnd"') >= 0, "step three must expose an editable period end read from the file");
assert.ok(app.indexOf("data-start-import") >= 0, "step three must start matching only after confirmation");
assert.ok(app.indexOf('role="progressbar"') >= 0, "step four must expose accessible import progress");
assert.ok(app.indexOf("function startImportProgress(kind)") >= 0, "the prototype must simulate import progress for both workflows");
assert.ok(app.indexOf("进入对账工作台") >= 0 && app.indexOf("进入物流成本对账") >= 0, "completed imports must expose the correct reconciliation entry");
assert.ok(styles.indexOf(".import-progress") >= 0 && styles.indexOf(".mapping-select") >= 0, "mapping and progress controls must have stable visual treatment");

console.log("bill-import-workflow-redesign.test.js: all assertions passed");
