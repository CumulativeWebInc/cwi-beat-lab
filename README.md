# CWI Beat Lab

A free 16-step browser sequencer from Cumulative Web Inc. Tap the squares, press play, share your pattern — a stranger makes a beat in under a minute.

**Live:** https://cumulativewebinc.github.io/cwi-beat-lab/

## What it is
- 16 steps × 4 rows (kick / snare / hat / perc), Web Audio API, zero dependencies.
- Tempo 60–200 BPM, three preset patterns + empty, play/stop, per-row audition on tap.
- **Share mechanic:** "Share my pattern" encodes the pattern into the URL hash. Anyone opening the link hears YOUR pattern — and every share links back to the lab.

## Rights architecture (the important part)
- Day one ships with the **CWI Synth Kit**: every drum sound is synthesized live in the browser. No audio files, no network requests, no samples = **no rights surface**.
- The That Boy Hi Hat stem pack is a **separate, clearance-gated module** (`docs/stems.js`). `validateManifest()` refuses the entire module unless every stem carries `id`, `url` (https), `clearedBy`, `clearedAt`, and `license`.
- The UI never implies artist sounds are included before clearance. The usage term is stated up front: beats are free for non-commercial use; commercial release needs a license via hp@cumulativeweb.com.

## Tests
`node test/run.js` — 57/57 green. Adversarial coverage: malformed/malicious share links rejected (never executed), prototype-pollution payloads neutralized, uncleared stem manifests refused on every missing field, no `fetch`/`eval`/external URLs anywhere in the app code, synth kit verified to schedule audio nodes.

## Kill rule
<100 third-party sessions in 60 days (by 2026-11-18) → intervene/rework, then kill. See KILL-RULE-LOG.md.

## Twenty Minds
Design verdict: BUILD NOW, synthesized-kit-first. Record: TWENTY-MINDS-BEAT-LAB-2026-09-19.md
