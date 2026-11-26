/* stethoscope-core — the engine behind Stethoscope.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: listen to a machine, keep a baseline, and notice when the sound changes — with the finding
 * NAMED and its frequency SHOWN, rather than a mystery score.
 *
 * IT IS NOT A MEDICAL DEVICE AND IT DOES NOT DIAGNOSE. It is for machines: a fan, a pump, a grinder. The
 * score is a similarity to the machine's own baseline, not a health verdict, and the app says so on every
 * screen that shows a number.
 *
 * The analysis is honest arithmetic: a small DFT over a window of samples, a band summary, and a
 * comparison against the baseline's bands. A peak at a named frequency is a peak in the spectrum, not a
 * guess about what is broken.
 *
 * Pure functions: no DOM, no network, no storage, no microphone.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StethoscopeCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var BANDS = 8;              /* the spectrum is summarised into eight bands */
  var SAMPLE_RATE = 8000;     /* enough for a machine, and cheap to compute in a page */

  var NOT_A_DIAGNOSIS = "This is a recording of a machine compared with its own baseline. It is not a medical device, it does not diagnose anything, and a low score is not a verdict on the machine.";

  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ddmm(ms) { var d = new Date(ms); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }

  /* A small DFT magnitude spectrum, folded into BANDS. Honest, slow, and small enough to test. */
  function spectrum(samples) {
    var n = Math.min(256, (samples || []).length);
    if (n < 16) return null;
    var mags = [];
    for (var k = 0; k < BANDS; k++) {
      var re = 0, im = 0;
      var freq = (k + 1) / (BANDS + 1);
      for (var i = 0; i < n; i++) {
        var ang = 2 * Math.PI * freq * i;
        re += samples[i] * Math.cos(ang);
        im -= samples[i] * Math.sin(ang);
      }
      mags.push(Math.sqrt(re * re + im * im) / n);
    }
    var total = mags.reduce(function (a, b) { return a + b; }, 0) || 1;
    return mags.map(function (m) { return Math.round((m / total) * 1000) / 1000; });
  }

  /* A recording: a name, the samples, and the spectrum it produced. */
  function record(machine, samples, now) {
    var name = clean(machine);
    if (!name) return { ok: false, field: "machine", reason: "a recording needs a machine name" };
    if (!Array.isArray(samples) || samples.length < 16) return { ok: false, field: "samples", reason: "a recording needs at least 16 samples \u2014 there is nothing to analyse otherwise" };
    var spec = spectrum(samples);
    var at = now || Date.now();
    return {
      ok: true,
      recording: { id: "r" + at, machine: name, at: at, on: ddmm(at), clock: hhmm(at), samples: samples.slice(0, 256), spectrum: spec },
      says: "Recorded " + name + " at " + hhmm(at) + "."
    };
  }

  /* The baseline is the FIRST recording of a machine: the machine's own normal. */
  function setBaseline(history, recording) {
    var h = (history || []).slice();
    if (!h.length) return { ok: false, reason: "there is nothing to set as a baseline" };
    var first = recording || h[0];
    return { ok: true, baseline: first, says: "Baseline is the recording from " + first.on + " " + first.clock + "." };
  }

  /* The score: how close this spectrum is to the baseline's, band by band. 100 is identical. */
  function score(baseline, recording) {
    if (!baseline || !recording || !baseline.spectrum || !recording.spectrum) return { ok: false, reason: "both recordings need a spectrum to compare" };
    var diff = 0;
    for (var i = 0; i < BANDS; i++) diff += Math.abs((recording.spectrum[i] || 0) - (baseline.spectrum[i] || 0));
    var s = Math.max(0, Math.round((1 - diff) * 100));
    var findings = [];
    for (var j = 0; j < BANDS; j++) {
      var d = (recording.spectrum[j] || 0) - (baseline.spectrum[j] || 0);
      if (d > 0.12) findings.push({ band: j + 1, frequencyHz: Math.round(SAMPLE_RATE * ((j + 1) / (BANDS + 1)) / 2), excess: Math.round(d * 1000) / 1000, kind: d > 0.25 ? "a strong tone" : "a tone" });
    }
    return {
      ok: true, score: s, findings: findings, bands: BANDS,
      says: s + " out of 100 against the baseline." + (findings.length ? " " + findings.length + " band(s) carry more energy than the baseline, the strongest at about " + findings[findings.length - 1].frequencyHz + " Hz." : " No band stands out from the baseline."),
      disclaimer: NOT_A_DIAGNOSIS
    };
  }

  /* A named finding: the spec wants the tone NAMED, not just scored lower. */
  function nameFinding(finding) {
    if (!finding) return { ok: false, reason: "there is no finding to name" };
    var hz = finding.frequencyHz;
    var name = hz < 400 ? "a low grind" : (hz < 1200 ? "a mid whine" : "a high whistle");
    return { ok: true, name: name, hz: hz, says: name + " around " + hz + " Hz, " + (finding.kind || "a tone") + " above the baseline." };
  }

  /* The trend over a history, for the three-recording plot. */
  function trend(history, baseline) {
    var h = (history || []).filter(function (r) { return r && r.spectrum; });
    if (!h.length) return { ok: false, reason: "there is no history to plot yet", points: [] };
    var points = h.map(function (r) {
      var s = score(baseline, r);
      return { id: r.id, on: r.on, clock: r.clock, score: s.ok ? s.score : null };
    });
    return {
      ok: true, points: points,
      says: points.length + " recording(s) plotted against the baseline: " + points.map(function (p) { return p.score; }).join(", ") + "."
    };
  }

  function serialize(history) { return JSON.stringify({ version: VERSION, format: "stethoscope-1", history: (history || []).map(function (r) {
    return { id: r.id, machine: r.machine, at: r.at, on: r.on, clock: r.clock, samples: r.samples.slice(), spectrum: r.spectrum.slice() };
  }) }, null, 2); }
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "no recording has been kept on this device yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) { return { ok: false, unreadable: true, reason: "The saved recordings cannot be read. They were NOT replaced with an empty history \u2014 an empty history would look like a machine that was never recorded. Export it to keep it.", raw: raw }; }
    if (!data || !Array.isArray(data.history)) return { ok: false, unreadable: true, reason: "The saved file holds no recordings. Nothing was started over it; export it to keep it.", raw: raw };
    return { ok: true, history: data.history, raw: raw };
  }
  function stamp(when) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || "")); return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated"; }
  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "application/json";
    if (what === "history") { name = "stethoscope-" + stamp(meta.when) + ".json"; body = serialize(payload.history); }
    else if (what === "raw") { name = "stethoscope-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); mime = "text/plain;charset=utf-8"; }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return { version: VERSION, BANDS: BANDS, SAMPLE_RATE: SAMPLE_RATE, NOT_A_DIAGNOSIS: NOT_A_DIAGNOSIS,
    spectrum: spectrum, record: record, setBaseline: setBaseline, score: score, nameFinding: nameFinding,
    trend: trend, serialize: serialize, parseState: parseState, exportFile: exportFile };
});
