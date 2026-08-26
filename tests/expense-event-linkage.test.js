"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var context = { window: {} };
var dataFile = path.join(__dirname, "..", "assets", "mock-data.js");
var appFile = path.join(__dirname, "..", "assets", "app.js");
var indexFile = path.join(__dirname, "..", "index.html");
var fieldGuideFile = path.join(__dirname, "..", "..", "财务模块_原型页面字段说明_V2.md");
var backendGuideFile = path.join(__dirname, "..", "..", "财务模块_后端逻辑与注意点_V3.md");

vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), context, { filename: dataFile });
var data = context.window.FINANCE_DATA;
var app = fs.readFileSync(appFile, "utf8");
var index = fs.readFileSync(indexFile, "utf8");
var fieldGuide = fs.readFileSync(fieldGuideFile, "utf8");
var backendGuide = fs.readFileSync(backendGuideFile, "utf8");

var financeEventGroupStart = index.indexOf("<b>财务事件</b>");
var customerGroupStart = index.indexOf("<b>客户相关</b>");
var factoryGroupStart = index.indexOf("<b>工厂相关</b>");
var incomeNav = index.indexOf('data-nav="income"');
var expenseNav = index.indexOf('data-nav="expense"');

assert.ok(financeEventGroupStart >= 0, "sidebar must expose a finance-event group");
assert.ok(incomeNav > financeEventGroupStart && incomeNav < customerGroupStart, "income flows must belong to finance events");
assert.ok(expenseNav > financeEventGroupStart && expenseNav < customerGroupStart, "expense flows must belong to finance events");
assert.ok(expenseNav < factoryGroupStart, "expense flows must not belong to the factory group");

var factoryExpenses = data.expenses.filter(function (row) { return row.counterpartyType === "工厂"; });
var logisticsExpenses = data.expenses.filter(function (row) { return row.counterpartyType === "物流商"; });
assert.ok(factoryExpenses.length > 0 && logisticsExpenses.length > 0, "mock expenses must cover both counterparty types");
factoryExpenses.forEach(function (row) {
  assert.strictEqual(row.eventNo, row.id, "the displayed event number must identify the FinancialEvent");
  assert.notStrictEqual(row.purchaseNo, "—", "factory cost must reference a purchase order");
  assert.notStrictEqual(row.detailId, "—", "factory cost may retain order-detail attribution");
});
logisticsExpenses.forEach(function (row) {
  assert.strictEqual(row.eventNo, row.id, "the displayed event number must identify the FinancialEvent");
  assert.notStrictEqual(row.orderId, "—", "logistics cost must reference an order");
  assert.strictEqual(row.purchaseNo, "—", "logistics cost must not reference a purchase order");
  assert.strictEqual(row.detailId, "—", "order-level logistics cost must not pretend to reference an order detail");
  assert.strictEqual(row.sku, "—", "order-level logistics cost must not pretend to reference a SKU");
  assert.strictEqual(row.external, false, "external purchase flags do not apply to logistics cost events");
  assert.strictEqual(row.businessDocumentType, "订单", "logistics cost business linkage must point to the order");
  assert.strictEqual(row.businessDocumentNo, row.orderId, "logistics business document must be its order");
});

assert.strictEqual(app.indexOf("财务流水号"), -1, "the ambiguous expense identifier label must be removed");
assert.ok(app.indexOf("<th>支出事件号</th>") >= 0, "expense table must label FinancialEvent.event_no explicitly");
assert.ok(app.indexOf("<th>成本方类型</th><th>成本方</th>") >= 0, "expense table must distinguish type from counterparty");
assert.ok(app.indexOf("<th>关联订单号</th>") >= 0, "expense table must expose the order association");
assert.ok(app.indexOf("<th>关联采购单号</th>") >= 0, "expense table must make purchase-order applicability explicit");
assert.ok(app.indexOf("物流成本按订单归集，不关联采购单") >= 0, "logistics detail must explain its order-level linkage");
assert.ok(fieldGuide.indexOf("| 支出事件号 |") >= 0, "field guide must document the expense event number");
assert.ok(fieldGuide.indexOf("物流成本事件 | 物流商 | 是 | 不关联") >= 0, "field guide must document logistics linkage");
assert.ok(fieldGuide.indexOf("售后物流成本 | 物流商 | 是 | 不关联") >= 0, "after-sale logistics cost must also require an order without a purchase order");
assert.ok(backendGuide.indexOf("purchase_order_id = NULL") >= 0, "backend guide must prohibit purchase-order linkage for logistics costs");

console.log("expense-event-linkage.test.js: all assertions passed");
