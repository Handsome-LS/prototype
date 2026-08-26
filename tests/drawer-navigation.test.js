"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var app = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");

assert.ok(
  /function navigate\(page\)\s*\{\s*closeDrawer\(\);\s*closeModal\(\);\s*state\.page = page;/.test(app),
  "page navigation must close open overlays before changing pages"
);
assert.ok(app.indexOf('data-reconcile-bill="') >= 0, "factory bill details must expose reconciliation navigation");
assert.ok(app.indexOf('data-logistics-bill="') >= 0, "logistics bill details must expose reconciliation navigation");

console.log("drawer-navigation.test.js: all assertions passed");
