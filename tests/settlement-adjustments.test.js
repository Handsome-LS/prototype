"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var context = { window: {} };
var dataFile = path.join(__dirname, "..", "assets", "mock-data.js");
var appFile = path.join(__dirname, "..", "assets", "app.js");
var fieldGuideFile = path.join(__dirname, "..", "..", "财务模块_原型页面字段说明_V2.md");
var backendGuideFile = path.join(__dirname, "..", "..", "财务模块_后端逻辑与注意点_V3.md");

vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), context, { filename: dataFile });
var settlements = context.window.FINANCE_DATA.settlements;
var app = fs.readFileSync(appFile, "utf8");
var fieldGuide = fs.readFileSync(fieldGuideFile, "utf8");
var backendGuide = fs.readFileSync(backendGuideFile, "utf8");

assert.ok(settlements.length > 0, "mock data must include a historical settlement");
assert.ok(settlements.every(function (item) {
  return typeof item.systemPayable === "number" &&
    typeof item.increaseAmount === "number" &&
    typeof item.decreaseAmount === "number" &&
    typeof item.adjustmentNote === "string";
}), "every settlement must preserve the system snapshot and adjustment fields");

assert.ok(app.indexOf("data-settlement-increase") >= 0, "creation and edit forms must expose an increase amount input");
assert.ok(app.indexOf("data-settlement-decrease") >= 0, "creation and edit forms must expose a decrease amount input");
assert.ok(app.indexOf("data-settlement-note") >= 0, "creation and edit forms must expose an adjustment note input");
assert.ok(app.indexOf("function settlementPayable(systemPayable, increaseAmount, decreaseAmount)") >= 0, "final payable calculation must be centralized");
assert.ok(app.indexOf("function updateSettlementAdjustments(settlementId)") >= 0, "pending settlements must support adjustment editing");
assert.ok(app.indexOf("function markSettlementPaid(settlementId)") >= 0, "the prototype must implement a real payment state transition");
assert.ok(app.indexOf("付款后不可修改") >= 0, "paid settlements must expose a clear locked state");
assert.ok(app.indexOf("增加金额") >= 0 && app.indexOf("减少金额") >= 0 && app.indexOf('<span>备注</span>') >= 0, "the settlement page must display adjustment fields");

assert.ok(fieldGuide.indexOf("系统应付金额 + 增加金额 - 减少金额") >= 0, "the field guide must define the adjusted payable formula");
assert.ok(fieldGuide.indexOf("标记付款后不可修改") >= 0, "the field guide must document the payment lock");
assert.ok(backendGuide.indexOf("increase_amount") >= 0 && backendGuide.indexOf("decrease_amount") >= 0, "the backend guide must define adjustment storage");
assert.ok(backendGuide.indexOf("付款后禁止修改") >= 0, "the backend guide must enforce the post-payment lock");

console.log("settlement-adjustments.test.js: all assertions passed");
