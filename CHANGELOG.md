# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 26/11/2026

### Added
- A **spectrum** from a sample buffer (a small DFT folded into eight bands), and a **baseline** per machine.
- A **score** against that baseline, band by band, with the disclaimer attached to every result.
- **Named findings**: *a low grind*, *a mid whine*, *a high whistle*, each with its frequency in hertz and how
  far above the baseline that band sits.
- A **trend** across recordings.
- Refusals: no machine name, fewer than sixteen samples, a score with no spectra, naming a finding that is
  not there.
- An unreadable history is reported and offered for export, **never** replaced with an empty one — an empty
  history would look like a machine that was never recorded.
- A failed save says **NOT SAVED** and leaves the recordings on screen unchanged.
- PWA shell, CI (46 engine assertions + 18 in jsdom + page smoke), and the app-builder pipeline pinned to the
  canonical SHA for the EXE/APK/Linux release.

### Not built
- **A microphone.** The app works on a sample buffer it can hold and test, and says so.
