"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var context = { window: {} };
var dataFile = path.join(__dirname, "..", "assets", "mock-data.js");
vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), context, { filename: dataFile });

var data = context.window.FINANCE_DATA;
var EPSILON = 0.011;

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < EPSILON, message + ": " + actual + " != " + expected);
}

function assertCny(records, label) {
  records.forEach(function (record) {
    assert.strictEqual(record.currency, "CNY", label + " must use CNY");
  });
}

assert.strictEqual(data.baseCurrency, "CNY");
assert.deepStrictEqual(Array.prototype.slice.call(data.currencies), ["CNY"]);
assertCny(data.orders, "orders");
assertCny(data.incomes, "incomes");
assertCny(data.customerBalanceSnapshots, "customer balance snapshots");
assertCny(data.customerFlows, "customer flows");
assertCny(data.expenses, "financial expense events");
assertCny(data.bills, "factory bills");
assertCny(data.reconciliationLines, "factory reconciliation lines");
assertCny(data.settlements, "factory settlements");
assertCny(data.exceptions, "exception impact amounts");

data.logisticsCosts.forEach(function (cost) {
  assert.ok(data.logisticsCurrencies.indexOf(cost.originalCurrency) >= 0, "logistics original currency is supported");
  assert.strictEqual(cost.currency, cost.originalCurrency, "logistics display currency is original currency");
  assert.strictEqual(cost.baseCurrency, "CNY", "logistics base currency is CNY");
  assert.strictEqual(cost.exchangeRate, data.exchangeRates[cost.originalCurrency], "rate snapshot matches configured mock rate");
  closeTo(cost.estimatedCostCny, Math.round(cost.estimatedCost * cost.exchangeRate * 100) / 100, "estimated CNY conversion");
  if (cost.actualCost) {
    closeTo(cost.actualCostCny, Math.round(cost.actualCost * cost.exchangeRate * 100) / 100, "actual CNY conversion");
  }
});

var billKeys = {};
data.logisticsBills.forEach(function (bill) {
  var key = bill.carrier + "::" + bill.originalCurrency;
  assert.ok(!billKeys[key], "one logistics bill aggregate per provider and original currency");
  billKeys[key] = true;
  var matched = data.logisticsCosts.filter(function (cost) {
    return cost.carrier === bill.carrier && cost.originalCurrency === bill.originalCurrency && cost.actualCost;
  });
  var allBillCosts = data.logisticsCosts.filter(function (cost) {
    return cost.carrier === bill.carrier && cost.originalCurrency === bill.originalCurrency;
  });
  assert.strictEqual(bill.totalLines, allBillCosts.length, "bill line count matches its provider/currency scope");
  closeTo(bill.actualTotal, matched.reduce(function (total, row) { return total + row.actualCost; }, 0), "bill original total");
  closeTo(bill.actualTotalCny, matched.reduce(function (total, row) { return total + row.actualCostCny; }, 0), "bill CNY total");
  closeTo(bill.totalAmountCny, bill.actualTotalCny, "bill converted total matches detail conversions");
});

data.logisticsReconcileLines.forEach(function (line) {
  var bill = data.logisticsBills.find(function (item) { return item.id === line.billId; });
  assert.ok(bill, "reconciliation line references a logistics bill");
  assert.strictEqual(line.channel, bill.carrier, "reconciliation line stays within its provider bill");
  assert.strictEqual(line.originalCurrency, bill.originalCurrency, "reconciliation line stays within its original-currency bill");
  assert.strictEqual(line.baseCurrency, "CNY", "reconciliation CNY comparison is explicit");
});

data.orders.forEach(function (order) {
  var logistics = data.logisticsCosts.find(function (cost) { return cost.orderId === order.id; });
  var activeCost = logistics && logistics.actualCost ? logistics.actualCostCny : order.estimatedLogisticsCostCny;
  closeTo(order.logisticsCost, activeCost, "order uses one active logistics cost in CNY");
  closeTo(order.originalGross, order.netIncome - order.factoryCost - order.logisticsCost, "order original gross is calculated in CNY");
  closeTo(order.gross, order.originalGross - order.afterCost, "order gross is calculated in CNY");
  assert.strictEqual(order.profitStatus, logistics && logistics.actualCost ? "最终" : "暂估", "profit status follows actual bill availability");
});

console.log("currency-rules.test.js: all assertions passed");
