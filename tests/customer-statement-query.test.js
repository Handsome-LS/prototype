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
var mockSource = fs.readFileSync(dataFile, "utf8");
var app = fs.readFileSync(appFile, "utf8");
var index = fs.readFileSync(indexFile, "utf8");
var fieldGuide = fs.readFileSync(fieldGuideFile, "utf8");
var backendGuide = fs.readFileSync(backendGuideFile, "utf8");
vm.runInNewContext(mockSource, context, { filename: dataFile });

var data = context.window.FINANCE_DATA;

assert.strictEqual(data.customerBills, undefined, "fixed customer bill records must be removed from mock data");
assert.strictEqual(mockSource.indexOf("2026-08-01 ~ 2026-08-31"), -1, "customer statements must not hard-code a monthly period");
assert.strictEqual(app.indexOf("data.customerBills"), -1, "the statement page must not read fixed customer bill records");
assert.ok(index.indexOf("客户资金对账单") >= 0, "navigation must use the customer fund statement name");
assert.ok(app.indexOf('customerBills: "客户资金对账单"') >= 0, "the page title must use the customer fund statement name");
assert.ok(app.indexOf("function customerAccountOpeningBalance(range, customer, currency)") >= 0, "statements must reuse an account-level opening balance helper");
assert.ok(app.indexOf("function buildCustomerStatementRows()") >= 0, "statement rows must be built from the active query");
assert.ok(app.indexOf("customerFlowInRange(flow, range)") >= 0, "statement flows must respect the active query range");
assert.ok(app.indexOf("statementSnapshots: {}") >= 0, "the prototype must keep generated statement snapshots in state");
assert.ok(app.indexOf("data-generate-customer-statement") >= 0, "real-time rows must expose a snapshot action");
assert.ok(app.indexOf('tag(b.dataStatus') >= 0, "rows must show real-time or generated snapshot status");
assert.ok(app.indexOf('<th class="num">查询起点余额</th>') >= 0, "the statement table must use query-start balance terminology");
assert.ok(app.indexOf('<th class="num">查询结束余额</th>') >= 0, "the statement table must use query-end balance terminology");
assert.ok(app.indexOf("var rows = b.flows;") >= 0, "details must use the statement's already-scoped flow list");
assert.ok(app.indexOf('toast("已生成客户资金对账快照') >= 0, "snapshot generation must provide visible success feedback");
assert.ok(app.indexOf("state.statementSnapshots[key].push(snapshot)") >= 0, "new snapshot versions must append instead of overwriting history");
assert.ok(fieldGuide.indexOf("# 6. 页面四：客户资金对账单") >= 0, "the field guide must document the renamed statement page");
assert.ok(fieldGuide.indexOf("实时查询/已生成快照") >= 0, "the field guide must define both statement data states");
assert.ok(backendGuide.indexOf("GET  /finance/customer-statements/preview") >= 0, "the backend guide must define a real-time preview endpoint");
assert.ok(backendGuide.indexOf("POST /finance/customer-statements/snapshots") >= 0, "the backend guide must define explicit snapshot generation");

console.log("customer-statement-query.test.js: all assertions passed");
