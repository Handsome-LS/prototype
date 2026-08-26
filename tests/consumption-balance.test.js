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

assert.strictEqual(data.asOfDate, "2026-08-14", "relative date ranges must use the mock data date");
assert.strictEqual(data.customerBalanceSnapshots.length, data.customers.length, "every mock customer must have a CNY balance snapshot");
data.customerBalanceSnapshots.forEach(function (snapshot) {
  assert.strictEqual(snapshot.currency, "CNY", "customer balance snapshots must follow the CNY-only customer fund policy");
  assert.strictEqual(snapshot.snapshotAt, "2026-08-01 00:00", "mock snapshots must expose an explicit coverage start");
});

function round(value) {
  return Math.round(value * 100) / 100;
}

data.customerBalanceSnapshots.forEach(function (snapshot) {
  var rows = data.customerFlows.filter(function (flow) {
    return flow.customer === snapshot.customer && flow.currency === snapshot.currency;
  }).sort(function (a, b) {
    return a.occurred.localeCompare(b.occurred) || a.flowNo.localeCompare(b.flowNo);
  });
  var balance = snapshot.balance;
  rows.forEach(function (flow) {
    assert.strictEqual(flow.beforeBalance, balance, flow.flowNo + " must start at the prior ledger balance");
    balance = round(balance + (flow.direction === "收入" ? flow.amount : -flow.amount));
    assert.strictEqual(flow.afterBalance, balance, flow.flowNo + " must end at the recalculated ledger balance");
  });
});

var augustOpening = data.customerBalanceSnapshots.reduce(function (total, snapshot) { return total + snapshot.balance; }, 0);
assert.strictEqual(augustOpening, 19120, "the August query baseline must be derived from dated snapshots");
assert.strictEqual(app.indexOf("data.customerBills"), -1, "flow KPIs and statements must not depend on fixed customer bill openings");
assert.ok(app.indexOf('kpi("查询起点余额"') >= 0, "the flow page must use the query-time balance label");
assert.ok(app.indexOf('kpi("查询结束余额"') >= 0, "the flow page must distinguish the query ending balance");
assert.ok(app.indexOf("function consumptionQueryRange()") >= 0, "the flow page must resolve its time range");
assert.ok(app.indexOf("var metricRows = scopedRows.filter(isEffectiveCustomerFlow);") >= 0, "account metrics must be calculated before detail-only filters");
assert.ok(app.indexOf("var rows = applyPageFilters(filterBySearch(scopedRows.filter(rowMatchesCommon)));") >= 0, "search and local filters must remain table-only");
assert.ok(app.indexOf("function customerAccountOpeningBalance(range, customer, currency)") >= 0, "flows and statements must share an account-level opening balance calculation");
assert.ok(app.indexOf('customerStatementTable(p.rows)') >= 0 && app.indexOf('<th class="num">查询起点余额</th>') >= 0, "customer statements must use query-time balance semantics");

console.log("consumption-balance.test.js: all assertions passed");
