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
var rows = context.window.FINANCE_DATA.reconciliationLines;
var app = fs.readFileSync(appFile, "utf8");
var fieldGuide = fs.readFileSync(fieldGuideFile, "utf8");
var backendGuide = fs.readFileSync(backendGuideFile, "utf8");

rows.forEach(function (row) {
  assert.ok(row.matchEvidence, "every reconciliation row must explain its matching evidence");
  assert.strictEqual(row.confidence, undefined, "undefined confidence percentages must be removed");
  assert.strictEqual(/\d+%/.test(row.matchEvidence), false, "matching evidence must not contain an uncalibrated percentage");
});

assert.ok(rows.some(function (row) { return row.matchStatus === "自动匹配" && row.matchEvidence.indexOf("唯一命中") >= 0; }), "automatic matches must name a unique matching rule");
assert.ok(rows.some(function (row) { return row.matchStatus === "未匹配" && row.matchEvidence.indexOf("2 个候选") >= 0; }), "multi-candidate rows must expose the candidate count");
assert.strictEqual(app.indexOf("置信信息"), -1, "the misleading confidence label must be removed from the prototype");
assert.ok(app.indexOf("<th>匹配依据</th>") >= 0, "the reconciliation table must expose matching evidence");
assert.ok(fieldGuide.indexOf("| 匹配依据 |") >= 0, "the field guide must document matching evidence");
assert.ok(backendGuide.indexOf("match_evidence_json") >= 0, "the backend guide must require structured matching evidence");
assert.ok(backendGuide.indexOf("禁止返回 `98%` 等伪精确置信度") >= 0, "the backend guide must prohibit uncalibrated percentages");

console.log("match-evidence.test.js: all assertions passed");
