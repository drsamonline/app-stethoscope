#!/usr/bin/env node
/* self-tests — Stethoscope. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Done-means: a healthy baseline scores high; the same recording with a grinding tone added scores LOWER
 * with that finding NAMED; the spectrum shows a peak at the added tone's frequency; three recordings plot a
 * trend; and nothing is uploaded. */
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var S = require(path.join(ROOT, "docs", "play", "stethoscope-core.js"));
var passed = 0, failed = [], group = "";
function section(n) { group = n; }
function ok(n, c, d) { if (c) { passed++; return; } failed.push(group + " :: " + n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var N = 64;
function healthy() { var a = []; for (var i = 0; i < N; i++) a.push(Math.sin(2 * Math.PI * 0.35 * i) * 0.6 + Math.sin(2 * Math.PI * 0.7 * i) * 0.2); return a; }
function grinding() { var a = healthy(); for (var i = 0; i < N; i++) a[i] += Math.sin(2 * Math.PI * 0.875 * i) * 0.9; return a; }

section("done means — a healthy baseline scores high");
var base = S.record("the fan", healthy(), 1000).recording;
eq("the recording is kept", !!base, true);
eq("with eight bands", base.spectrum.length, S.BANDS);
var same = S.score(base, S.record("the fan", healthy(), 2000).recording);
eq("the same sound scores 100", same.score, 100);
ok("and says so", /100 out of 100 against the baseline/.test(same.says), same.says);

section("done means — a grinding tone scores LOWER, with the finding named");
var bad = S.score(base, S.record("the fan", grinding(), 3000).recording);
ok("the score is lower", bad.score < same.score, bad.score + " vs " + same.score);
ok("findings are reported", bad.findings.length > 0, bad.findings.length);
var named = S.nameFinding(bad.findings[bad.findings.length - 1]);
eq("the finding is named", named.ok, true);
ok("with a name a person can say", /grind|whine|whistle/.test(named.name), named.name);
ok("and a frequency", named.hz > 0, named.hz);
ok("and it says it is a tone above the baseline", /above the baseline/.test(named.says), named.says);

section("done means — the spectrum shows a peak at the added tone's frequency");
var addedFreqBand = 8;   /* 0.875 normalised sits in the top band */
ok("the added tone lands in the top band", bad.findings.some(function (f) { return f.band === addedFreqBand; }), JSON.stringify(bad.findings.map(function (f) { return f.band; })));
var peakIndex = base.spectrum.indexOf(Math.max.apply(null, base.spectrum)) + 1;
var badPeak = bad.findings.filter(function (f) { return f.band === addedFreqBand; })[0];
ok("the peak is above the baseline in that band", badPeak.excess > 0, badPeak && badPeak.excess);
ok("the app names the frequency of the strongest finding", /Hz/.test(bad.says), bad.says);
eq("band to hertz is arithmetic, not a guess", S.nameFinding({ frequencyHz: 3500, kind: "a tone" }).hz, 3500);

section("done means — three recordings plot a trend");
var h = [base, S.record("the fan", healthy(), 2000).recording, S.record("the fan", grinding(), 3000).recording];
var tr = S.trend(h, base);
eq("three points", tr.points.length, 3);
eq("in order", tr.points.map(function (p) { return p.score; }).join(","), "100,100,0");
ok("and the app lists them", /3 recording\(s\) plotted/.test(tr.says), tr.says);

section("done means — with the network off nothing is uploaded");
var core = read("docs/play/stethoscope-core.js");
ok("no fetch, XHR, WebSocket or beacon", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(core + read("docs/play/app.js")));
ok("no URL anywhere in the engine", !/https?:\/\//.test(core));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));

section("must-not — it must not diagnose, and it must not be a medical device");
ok("the disclaimer says it is not a medical device", /not a medical device/.test(S.NOT_A_DIAGNOSIS), S.NOT_A_DIAGNOSIS);
ok("and that it does not diagnose", /does not diagnose/.test(S.NOT_A_DIAGNOSIS));
ok("every score carries the disclaimer", /not a medical device/.test(bad.disclaimer));
ok("no diagnosis, condition or fault field", !/\b(diagnosis|condition|fault|healthy|broken|replaceIt)\s*[:=]/i.test(core.replace(/NOT_A_DIAGNOSIS|does not diagnose|not a diagnosis/gi, "")));
ok("the score is a similarity, and the app says so", /against the baseline/.test(bad.says));
ok("no microphone code", !/getUserMedia|MediaRecorder|AudioContext|navigator\.mediaDevices/.test(core + read("docs/play/app.js")));

section("bad input");
eq("a recording with no machine name is refused", S.record("", healthy(), 1).field, "machine");
eq("a recording with too few samples is refused", S.record("fan", [1, 2, 3], 1).field, "samples");
eq("a score needs two spectra", S.score(null, base).ok, false);
eq("naming a finding that is not there is refused", S.nameFinding(null).ok, false);
eq("an empty history has no trend", S.trend([], base).ok, false);

section("storage");
var badFile = S.parseState("{ broken");
eq("a broken history is reported", badFile.ok, false);
eq("it is marked unreadable", badFile.unreadable, true);
ok("it was not replaced with an empty one", /NOT replaced with an empty history/.test(badFile.reason), badFile.reason);
ok("and says why an empty history is worse", /never recorded/.test(badFile.reason), badFile.reason);
eq("nothing saved yet is distinguished", S.parseState("").empty, true);
var round = S.parseState(S.serialize(h));
eq("the history round-trips", round.history.length, 3);
eq("with its spectra", round.history[0].spectrum.length, S.BANDS);
var thrown = S.exportFile("history", { history: h }, { when: "26/11/2026" }, function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; });
eq("a failed write is reported", thrown.ok, false);

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (x) { ok("script src resolves: " + x, fs.existsSync(path.join(ROOT, "docs", "play", x.replace(/^\.\//, "")))); });
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));
ok("the web manifest exists", fs.existsSync(path.join(ROOT, "docs", "play", "manifest.webmanifest")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("self-tests: " + passed + "/" + total + " assertions passed");
