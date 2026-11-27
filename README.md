# Stethoscope

Listen to a machine, keep its baseline, and see what changed — with the finding **named** and its frequency
shown. **It is not a medical device and it does not diagnose.**

- **Demo:** https://drsamonline.github.io/app-stethoscope/play/index.html
- **Landing page:** https://drsamonline.github.io/app-stethoscope/
- **Release:** https://github.com/drsamonline/app-stethoscope/releases/tag/app-latest
- **Plan row:** #33 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-stethoscope` (lead)
- **Licence:** PolyForm Noncommercial 1.0.0
- **Sponsor:** [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) — free, offline, no account

## Status

| | |
|---|---|
| **Built** | A spectrum from a sample buffer; a baseline per machine; a score against it; named findings with frequencies; a trend; an export. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **A microphone.** The app works on a sample buffer the page can hold and a test can check — a microphone would be a second job and a privacy question the spec does not ask for. |
| **Untested** | Any real machine. The arithmetic is exact and the synthetic grinding tone is caught; whether this hears a failing bearing in a noisy room is not something a sample buffer can tell you. |

## The spec's "done means", counted

| The spec says | The test |
|---|---|
| a healthy baseline scores high | the same healthy samples score **100** |
| a grinding tone scores lower, with the finding named | lower than 100, at least one finding, and a name — *a high whistle around 3556 Hz* |
| the spectrum shows a peak at the added tone's frequency | the added 0.875-normalised tone lands in the **top band**, with a positive excess over the baseline |
| three recordings plot a trend | three points, `100, 100, 0` |
| with the network off nothing is uploaded | no `fetch`/XHR/WebSocket/beacon, no URL in the engine, CSP `connect-src 'none'` |

## What it will not do

- **Diagnose** — no condition, fault or verdict field in the engine.
- **Claim to be medical** — the disclaimer is attached to every score.
- **Record from a microphone** — no `getUserMedia`, `MediaRecorder` or `AudioContext`.
- **Upload anything.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | No machine name or fewer than sixteen samples — refused with the field named. |
| **No network** | Nothing changes; nothing is uploaded. |
| **Storage full or unavailable** | **NOT SAVED**, recordings unchanged. |
| **Corrupt saved state** | Reported and offered for export, never replaced with an empty history. |

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 46 assertions
node tests/ui-tests.js        # the page in jsdom — 18 assertions
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 26/11/2026, all red: the score ignoring the spectrum (2 failures), a finding never
named (crash), the disclaimer dropped (crash), a broken history starting empty (4), the trend dropping a
point (3), and a too-short recording accepted (1).

## Layout

```
docs/index.html                landing page
docs/play/index.html           the app — record, the score, the bars, the findings, the trend
docs/play/app.js               DOM wiring: record, render the spectrum, the findings, export
docs/play/stethoscope-core.js  the engine — spectrum, baseline, score, findings, trend, storage
docs/play/web-kit.js           vendored kit (unmodified)
docs/play/export-kit.js        vendored kit (unmodified)
tests/self-tests.js            engine suite (46)
tests/ui-tests.js              page suite (18, jsdom)
tests/page-smoke.js            shape on disk
PAGES.json                     landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **A sample buffer, not a microphone.** The analysis is the part that can be true here; a microphone would be a second job, and the page says which is which.
- **Eight bands, not a spectrogram.** Eight named bands can be tested and read; a picture cannot.
- **The finding is NAMED, not just scored.** The spec asks for "that finding named", so the app says *a high whistle* and quotes the hertz.
- **The disclaimer travels with the score**, not on a help page — every result carries it.
- **A baseline is the machine's own first recording**, so "healthy" means "how it was", not a reference sample from somewhere else.

## What is not built, and why

**A microphone, and any judgement about the machine.** The first is a second job; the second is a diagnosis,
and this app does arithmetic on a spectrum and nothing more.
