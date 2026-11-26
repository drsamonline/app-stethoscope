/* app — the Stethoscope page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Wiring only: the spectrum, the score and the findings live in stethoscope-core.js.
 * There is NO microphone in this app: the samples are generated in the page so the analysis can be seen and
 * tested. A microphone would be a second job and a privacy question the spec does not ask for. */
(function () {
  "use strict";
  var S = window.StethoscopeCore;
  var $ = function (id) { return document.getElementById(id); };
  var K = "stethoscope:history";
  var state = { history: [], unreadable: null };

  var els = {
    status: $("status"), disclaimer: $("disclaimer"), machine: $("machine"), recBtn: $("recBtn"), grindBtn: $("grindBtn"),
    scoreNum: $("scoreNum"), scoreSays: $("scoreSays"), bars: $("bars"), findingList: $("findingList"),
    trendSays: $("trendSays"), trendList: $("trendList"), exportBtn: $("exportBtn"), ioNote: $("ioNote")
  };

  function today() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function setStatus(k, m) { els.status.className = "status show " + k; els.status.textContent = m; }
  function node(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  function persist() {
    try { window.localStorage.setItem(K, S.serialize(state.history)); return true; }
    catch (e) { setStatus("bad", "NOT SAVED: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") + ". The recordings on screen are unchanged."); return false; }
  }

  function samples(grind) {
    var a = [], N = 64;
    for (var i = 0; i < N; i++) {
      a.push(Math.sin(2 * Math.PI * 0.35 * i) * 0.6 + Math.sin(2 * Math.PI * 0.7 * i) * 0.2);
      if (grind) a[i] += Math.sin(2 * Math.PI * 0.875 * i) * 0.9;
    }
    return a;
  }

  function render() {
    var base = state.history[0];
    els.bars.textContent = "";
    els.findingList.textContent = "";
    if (!base) { els.scoreNum.textContent = ""; els.scoreSays.textContent = "Record a machine to start."; els.trendSays.textContent = ""; els.trendList.textContent = ""; return; }
    var last = state.history[state.history.length - 1];
    var out = S.score(base, last);
    els.scoreNum.textContent = out.ok ? String(out.score) : "";
    els.scoreSays.textContent = out.ok ? out.says : out.reason;

    var max = Math.max.apply(null, last.spectrum.concat([0.01]));
    last.spectrum.forEach(function (v, i) {
      var bar = node("div");
      bar.style.height = Math.max(2, Math.round((v / max) * 88)) + "px";
      if (out.findings && out.findings.some(function (f) { return f.band === i + 1; })) bar.className = "hot";
      bar.title = "band " + (i + 1);
      els.bars.appendChild(bar);
    });

    (out.findings || []).forEach(function (f) {
      var named = S.nameFinding(f);
      var li = node("li", null, named.says);
      li.appendChild(node("span", "meta", "band " + f.band + " \u00b7 about " + f.frequencyHz + " Hz \u00b7 +" + f.excess + " over the baseline"));
      els.findingList.appendChild(li);
    });
    if (out.findings && !out.findings.length) els.findingList.appendChild(node("li", null, "No band stands out from the baseline."));

    var tr = S.trend(state.history, base);
    els.trendSays.textContent = tr.ok ? tr.says : tr.reason;
    els.trendList.textContent = "";
    (tr.points || []).forEach(function (p) {
      var li = node("li", null, "Score " + p.score);
      li.appendChild(node("span", "meta", p.on + " " + p.clock));
      els.trendList.appendChild(li);
    });
  }

  function record(grind) {
    var out = S.record(els.machine.value, samples(grind), Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.history.push(out.recording);
    var saved = persist();
    render();
    if (saved) setStatus("ok", out.says + (state.history.length === 1 ? " This is the baseline." : ""));
  }

  function doExport() {
    var out = S.exportFile("history", { history: state.history }, { when: today() }, function (name, text, mime) {
      if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
      window.Export.save(name, text, mime); return true;
    });
    if (out.ok) { els.ioNote.textContent = "Wrote " + out.filename + "."; setStatus("ok", "Exported."); }
    else setStatus("bad", out.reason + ".");
  }

  els.recBtn.addEventListener("click", function () { record(false); });
  els.grindBtn.addEventListener("click", function () { record(true); });
  els.exportBtn.addEventListener("click", doExport);

  var raw = null;
  try { raw = window.localStorage.getItem(K); } catch (e) { raw = null; }
  if (raw) {
    var parsed = S.parseState(raw);
    if (parsed.ok) state.history = parsed.history;
    else {
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable recordings");
      keep.addEventListener("click", function () {
        var out = S.exportFile("raw", parsed, { when: today() }, function (name, text, mime) {
          if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
          window.Export.save(name, text, mime); return true;
        });
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.ioNote.parentNode.insertBefore(keep, els.ioNote);
    }
  }

  els.disclaimer.textContent = S.NOT_A_DIAGNOSIS;
  render();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
