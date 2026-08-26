"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var app = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
var styles = fs.readFileSync(path.join(__dirname, "..", "assets", "styles.css"), "utf8");
var index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "echarts.min.js")), "ECharts runtime must be vendored for the static prototype");
assert.ok(index.indexOf('assets/echarts.min.js') >= 0, "ECharts runtime must load before the application script");
assert.ok(app.indexOf("window.echarts.init(") >= 0, "dashboard charts must use ECharts instances");
assert.ok(app.indexOf("chart.setOption(") >= 0, "dashboard charts must set ECharts options");
assert.ok(app.indexOf("window.requestAnimationFrame(renderDashboardCharts)") >= 0, "charts must initialize after the home view has been laid out");
assert.ok(app.indexOf("tooltip:") >= 0, "ECharts charts must provide hover detail");
assert.ok(app.indexOf("legend:") >= 0, "ECharts charts must provide native series selection");
assert.ok(app.indexOf("dataZoom: zoom") >= 0, "long time ranges must provide ECharts zooming");
assert.ok(app.indexOf("resizeDashboardCharts") >= 0 && app.indexOf(".resize()") >= 0, "ECharts instances must resize with the viewport");
assert.ok(app.indexOf("disposeDashboardCharts") >= 0 && app.indexOf(".dispose()") >= 0, "ECharts instances must be disposed before rerendering");
assert.ok(app.indexOf('labels: ["08-07", "08-08", "08-09", "08-10", "08-11", "08-12", "08-13"]') >= 0, "charts must retain the original seven-day labels");
assert.ok(app.indexOf('values: [82, 91, 96, 88, 110, 118, 126]') >= 0, "finance chart must retain the original income series");
assert.ok(app.indexOf('values: [6, 8, 5, 12, 10, 16, 18]') >= 0, "exception chart must retain the original amount-difference series");
assert.ok(app.indexOf("function dashboardChartTooltip(") >= 0, "chart tooltips must format exact aggregated values");
assert.ok(styles.indexOf(".echart {") >= 0, "ECharts containers must have stable dimensions");
assert.ok(styles.indexOf(".echart-fallback") >= 0, "chart loading failures must have a visible fallback state");

console.log("chart-series.test.js: all assertions passed");
