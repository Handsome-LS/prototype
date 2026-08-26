"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..", "..");
var app = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
var fieldDoc = fs.readFileSync(path.join(root, "财务模块_原型页面字段说明_V2.md"), "utf8");
var backendDoc = fs.readFileSync(path.join(root, "财务模块_后端逻辑与注意点_V3.md"), "utf8");
var incomeTable = app.slice(app.indexOf("function incomeTable"), app.indexOf("function renderConsumption"));

assert.ok(incomeTable.indexOf("<th>收入事件号</th>") >= 0, "income rows must label FinancialEvent.event_no as 收入事件号");
assert.strictEqual(incomeTable.indexOf("<th>流水号</th>"), -1, "income rows must not use the ambiguous 流水号 label");
assert.ok(app.indexOf('"收入事件号": "FinancialEvent.event_no') >= 0, "income event numbers must have explicit field help");
assert.ok(app.indexOf('openDrawer("收入事件详情", id') >= 0, "income details must use event terminology");
assert.ok(app.indexOf("<th>资金流水号</th>") >= 0, "customer consumption rows must retain the 资金流水号 label");

assert.ok(fieldDoc.indexOf("| 收入事件号 | 财务事件唯一编号 | FinancialEvent.event_no |") >= 0, "field documentation must use 收入事件号");
assert.ok(fieldDoc.indexOf("收入事件号与资金流水号不是同一个编号") >= 0, "field documentation must explain the identifier boundary");
assert.ok(backendDoc.indexOf("FinancialEvent.event_no") >= 0 && backendDoc.indexOf("CustomerBalanceFlow.flow_no") >= 0, "backend notes must name both identifier owners");
assert.ok(backendDoc.indexOf("禁止通过 `event_no` 与 `flow_no` 的格式或字符串值建立关联") >= 0, "backend notes must prohibit string-based identifier joins");

console.log("identifier-labels.test.js: all assertions passed");
