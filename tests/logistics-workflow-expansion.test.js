"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var context = { window: {} };
var root = path.join(__dirname, "..");
var dataFile = path.join(root, "assets", "mock-data.js");
var appFile = path.join(root, "assets", "app.js");
var indexFile = path.join(root, "index.html");
var fieldGuideFile = path.join(root, "..", "财务模块_原型页面字段说明_V2.md");
var backendGuideFile = path.join(root, "..", "财务模块_后端逻辑与注意点_V3.md");

vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), context, { filename: dataFile });
var data = context.window.FINANCE_DATA;
var app = fs.readFileSync(appFile, "utf8");
var index = fs.readFileSync(indexFile, "utf8");
var fieldGuide = fs.readFileSync(fieldGuideFile, "utf8");
var backendGuide = fs.readFileSync(backendGuideFile, "utf8");

assert.ok(index.indexOf('data-nav="importLogistics"') < 0, "logistics import must not remain a standalone navigation destination");
assert.ok(index.indexOf('data-nav="logisticsSettlement"') >= 0, "the logistics group must expose a settlement page");
assert.ok(index.indexOf('data-nav="logisticsReport"') >= 0, "the logistics group must expose a report page");
assert.ok(index.indexOf('data-nav="factoryCosts"') >= 0, "the factory group must expose a factory-cost page");

assert.ok(app.indexOf("function openLogisticsImportModal(resetStep)") >= 0, "logistics import must open in the shared modal");
assert.ok(app.indexOf("data-open-logistics-import") >= 0, "the logistics-bill page must own the import action");
assert.ok(app.indexOf('state.page === "importLogistics"') < 0, "the removed logistics import page must not render as a route");

assert.ok(Array.isArray(data.logisticsSettlements), "mock data must expose logistics settlements");
assert.ok(data.logisticsCosts.every(function (item) { return item.billId; }), "every logistics cost must reference its logistics bill");
assert.ok(data.logisticsBills.some(function (bill) {
  return bill.status === "已完成" && !data.logisticsSettlements.some(function (item) { return item.billId === bill.id; });
}), "mock data must include an eligible reconciled logistics bill without a settlement");

assert.ok(app.indexOf("data-open-logistics-settlement-create") >= 0, "logistics reconciliation must expose manual settlement generation");
assert.ok(app.indexOf("function createLogisticsSettlement(billId)") >= 0, "the prototype must implement manual logistics settlement creation");
assert.ok(app.indexOf("function renderLogisticsSettlement()") >= 0, "the prototype must render logistics settlements");
assert.ok(app.indexOf("function renderLogisticsReport()") >= 0, "the prototype must render logistics reports");
assert.ok(app.indexOf("function renderFactoryCosts()") >= 0, "the prototype must render factory costs");
assert.ok(app.indexOf('data-page-filter="logisticsBillId"') >= 0, "logistics costs must filter by logistics bill");
assert.ok(app.indexOf("data-logistics-costs-bill") >= 0, "logistics bills must provide a contextual cost shortcut");
assert.ok(app.indexOf("增加金额") >= 0 && app.indexOf("减少金额") >= 0 && app.indexOf('<span>备注</span>') >= 0, "logistics settlement creation must include all adjustment inputs");

assert.ok(fieldGuide.indexOf("物流账单页弹窗") >= 0, "the field guide must document modal logistics import");
assert.ok(fieldGuide.indexOf("物流结算") >= 0 && fieldGuide.indexOf("手动生成") >= 0, "the field guide must document manual logistics settlement generation");
assert.ok(backendGuide.indexOf("logistics_settlement") >= 0, "the backend guide must define logistics settlement storage");
assert.ok(backendGuide.indexOf("不得自动生成物流结算单") >= 0, "the backend guide must prohibit automatic logistics settlement creation");

console.log("logistics-workflow-expansion.test.js: all assertions passed");
