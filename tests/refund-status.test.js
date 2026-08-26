"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var context = { window: {} };
var dataFile = path.join(__dirname, "..", "assets", "mock-data.js");
var appFile = path.join(__dirname, "..", "assets", "app.js");
vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), context, { filename: dataFile });

var data = context.window.FINANCE_DATA;
var app = fs.readFileSync(appFile, "utf8");
var refunds = data.incomes.filter(function (row) { return row.type === "客户退款"; });
var refundFlows = data.customerFlows.filter(function (row) { return row.flowType === "ORDER_REFUND"; });

assert.ok(refunds.length > 0, "mock data must include customer refund income events");
refunds.forEach(function (row) {
  assert.strictEqual(row.status, "退款已生效", "active refund income events must use the unambiguous display status");
});
refundFlows.forEach(function (row) {
  assert.strictEqual(row.incomeEventStatus, "退款已生效", "refund balance flows must use the same income-event status");
});
assert.ok(app.indexOf('["全部状态", "已确认", "退款已生效"]') >= 0, "income status filter must expose the new label");
assert.ok(app.indexOf('["已确认", "退款已生效"') >= 0, "the new label must use the success tone");

console.log("refund-status.test.js: all assertions passed");
