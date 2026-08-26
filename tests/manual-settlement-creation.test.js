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
var data = context.window.FINANCE_DATA;
var app = fs.readFileSync(appFile, "utf8");
var fieldGuide = fs.readFileSync(fieldGuideFile, "utf8");
var backendGuide = fs.readFileSync(backendGuideFile, "utf8");

assert.ok(data.bills.some(function (bill) { return bill.status === "待结算" && !data.settlements.some(function (item) { return item.billId === bill.id; }); }), "mock data must include an eligible bill without a settlement");
assert.ok(data.settlements.every(function (item) { return data.bills.find(function (bill) { return bill.id === item.billId; }).status === "已结算"; }), "preloaded settlements must represent historical settled bills only");
assert.ok(app.indexOf("function eligibleSettlementBills()") >= 0, "the prototype must calculate eligible settlement bills");
assert.ok(app.indexOf("data-open-settlement-create") >= 0, "the prototype must expose manual settlement creation entry points");
assert.ok(app.indexOf("function createSettlement(billId)") >= 0, "the prototype must create a settlement from the selected bill");
assert.ok(app.indexOf("该账单已存在结算单") >= 0, "duplicate settlement creation must be rejected");
assert.ok(app.indexOf('settlementStatus: "待付款"') >= 0, "a newly created settlement must start pending payment");
assert.ok(fieldGuide.indexOf("结算单由财务手动生成") >= 0, "the field guide must document manual creation");
assert.ok(backendGuide.indexOf("不自动生成正式结算单") >= 0, "the backend guide must prohibit automatic final settlement creation");
assert.ok(backendGuide.indexOf("财务手动确认生成结算单") >= 0, "the backend workflow must make the manual confirmation step explicit");

console.log("manual-settlement-creation.test.js: all assertions passed");
