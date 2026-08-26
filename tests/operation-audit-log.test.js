"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
var styles = fs.readFileSync(path.join(root, "assets", "styles.css"), "utf8");
var index = fs.readFileSync(path.join(root, "index.html"), "utf8");
var docs = fs.readFileSync(path.join(root, "..", "财务模块_原型页面字段说明_V2.md"), "utf8");

assert.ok(index.indexOf('data-nav="operationLogs"') >= 0, "navigation must expose the operation-log page");
assert.ok(app.indexOf('operationLogs: "操作日志"') >= 0, "the operation-log route must have a page title");
assert.ok(app.indexOf("function renderOperationLogs()") >= 0, "the operation-log list page must render");
assert.ok(app.indexOf("function openOperationLog(id)") >= 0, "each log must expose operation-specific details");
assert.ok(app.indexOf("function recordOperationLog(entry)") >= 0, "sensitive actions must share one immutable audit writer");
assert.ok(app.indexOf("function recordExportOperation") >= 0, "all exports must use a shared audit recorder");
assert.ok(app.indexOf("导出格式") >= 0 && app.indexOf("导出范围") >= 0 && app.indexOf("筛选条件") >= 0, "export logs must retain export-specific values");
assert.ok(app.indexOf("导出任务 ID") >= 0 && app.indexOf("文件有效期") >= 0 && app.indexOf("导出字段") >= 0, "export logs must retain the task, expiry, and selected field list");
assert.ok(app.indexOf("增加金额") >= 0 && app.indexOf("减少金额") >= 0 && app.indexOf("付款金额") >= 0, "settlement logs must retain financial values");
assert.ok(app.indexOf("操作前状态") >= 0 && app.indexOf("操作后状态") >= 0, "sensitive state changes must retain before and after values");
assert.ok(app.indexOf("确认金额") >= 0 && app.indexOf("Tracking / 面单") >= 0 && app.indexOf("关联单据") >= 0, "reconciliation, logistics, and exception actions must record their own business values");
assert.ok(app.indexOf("recordStatementSnapshotOperation") >= 0, "statement snapshot generation must be audited");
assert.ok(app.indexOf("recordSensitiveConfirmation") >= 0, "generic reconciliation and exception confirmations must be audited");
assert.ok(app.indexOf("function completeImportAudit(kind)") >= 0 && app.indexOf('result: "处理中"') >= 0, "asynchronous imports must append submitted and completed audit events");
assert.ok(app.indexOf("生成账单 ID") >= 0 && app.indexOf("映射模板") >= 0 && app.indexOf("汇率来源") >= 0, "import logs must retain generated IDs, templates, and logistics exchange-rate context");
assert.ok(app.indexOf("function cancelPendingImportAudit()") >= 0 && app.indexOf("用户在任务完成前关闭导入弹窗") >= 0, "cancelled imports must retain a failure audit event");
assert.ok(app.indexOf("function syncPageFilterVisibility()") >= 0 && app.indexOf("没有匹配的操作日志") >= 0, "the log page must expose only relevant filters and a clear empty state");
assert.ok(app.indexOf("function operationLogMatchesSearch(log)") >= 0 && app.indexOf("value.field, value.before, value.after") >= 0, "keyword search must include operation-specific values");
assert.ok(styles.indexOf(".operation-log-summary") >= 0 && styles.indexOf(".operation-value-table") >= 0, "audit summaries and value diffs need stable visual treatment");
assert.ok(docs.indexOf("操作日志") >= 0 && docs.indexOf("追加写入") >= 0 && docs.indexOf("before_values") >= 0, "field and backend documentation must define immutable operation logs");

console.log("operation-audit-log.test.js: all assertions passed");
