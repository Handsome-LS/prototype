"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var app = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
var styles = fs.readFileSync(path.join(__dirname, "..", "assets", "styles.css"), "utf8");

assert.ok(app.indexOf('data-chart-series="') >= 0, "chart legends must expose per-series controls");
assert.ok(app.indexOf("function toggleChartSeries(input)") >= 0, "chart series controls must update visibility without rerendering the page");
assert.ok(app.indexOf('stroke-dasharray="') >= 0, "chart series must use distinct line styles in addition to color");
assert.ok(app.indexOf("Math.ceil(maxValue * 1.1 / magnitude) * magnitude") >= 0, "chart scale must adapt to the displayed data range");
assert.ok(app.indexOf('aria-controls="chart-') >= 0, "series controls must identify their plotted series");

assert.ok(styles.indexOf(".chart-legend-item") >= 0, "interactive chart legend styles must be present");
assert.ok(styles.indexOf(".chart-series.is-hidden") >= 0, "unchecked series must have a hidden visual state");
assert.ok(styles.indexOf(".chart-empty-state") >= 0, "charts must explain when every series is hidden");

console.log("chart-series.test.js: all assertions passed");
