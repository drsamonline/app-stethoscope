#!/usr/bin/env node
/* ui-tests — the Stethoscope page in a real DOM (jsdom). SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin */
"use strict";
var fs = require("fs"), path = require("path"), { JSDOM } = require("jsdom");
var ROOT = path.join(__dirname, ".."), PLAY = path.join(ROOT, "docs", "play");
var passed = 0, failed = [];
function ok(n, c, d) { if (c) { passed++; return; } failed.push(n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function build(seed) {
  var dom = new JSDOM(fs.readFileSync(path.join(PLAY, "index.html"), "utf8"), { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; }; w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "stethoscope-core.js", "app.js"].forEach(function (f) { w.eval(fs.readFileSync(path.join(PLAY, f), "utf8")); });
  return dom;
}
var dom = build(null), w = dom.window, d = w.document, $ = function (id) { return d.getElementById(id); };
ok("the engine loaded", !!w.StethoscopeCore);
ok("the disclaimer is on the page", /not a medical device/.test($("disclaimer").textContent), $("disclaimer").textContent);

$("machine").value = "the fan"; $("recBtn").click();
ok("a baseline is recorded", /Recorded the fan/.test($("status").textContent), $("status").textContent);
ok("and it is called the baseline", /This is the baseline/.test($("status").textContent));
eq("the score against itself is 100", $("scoreNum").textContent, "100");
eq("eight bars are drawn", d.querySelectorAll("#bars div").length, 8);

$("recBtn").click();
eq("a healthy second sample also scores 100", $("scoreNum").textContent, "100");

$("grindBtn").click();
ok("a grinding sample scores lower", Number($("scoreNum").textContent) < 100, $("scoreNum").textContent);
ok("and the finding is named", /grind|whine|whistle/.test($("findingList").textContent), $("findingList").textContent);
ok("with a frequency", /Hz/.test($("findingList").textContent));
ok("the peak bar is marked", d.querySelectorAll("#bars div.hot").length >= 1, d.querySelectorAll("#bars div.hot").length);
eq("three recordings plot", d.querySelectorAll("#trendList li").length, 3);
ok("with scores in order", /100/.test($("trendSays").textContent), $("trendSays").textContent);

$("exportBtn").click();
ok("the history exports", /Wrote stethoscope-\d{4}-\d\d-\d\d\.json/.test($("ioNote").textContent), $("ioNote").textContent);
var saved = w.localStorage.getItem("stethoscope:history");
var dom2 = build({ "stethoscope:history": saved });
var d2 = dom2.window.document;
eq("the reload keeps three recordings", d2.querySelectorAll("#trendList li").length, 3);

var dom3 = build({ "stethoscope:history": "{ broken" });
var d3 = dom3.window.document;
ok("a broken history is reported", /cannot be read/.test(d3.getElementById("status").textContent));
ok("and not replaced with an empty one", /NOT replaced with an empty history/.test(d3.getElementById("status").textContent));

var dom4 = build(null), w4 = dom4.window, d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", { configurable: true, get: function () {
  return { getItem: function () { return null; }, setItem: function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; }, removeItem: function () {}, clear: function () {} }; } });
d4.getElementById("recBtn").click();
ok("a failed save says NOT SAVED", /NOT SAVED:/.test(d4.getElementById("status").textContent), d4.getElementById("status").textContent);

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
