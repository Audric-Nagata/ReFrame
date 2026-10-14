# Repair Test Conditions (Stage 1 — temporal frame reuse)

Define conditions and metrics **before** evaluating (rules.md §8). Test surface: the extension on `youtube.com/watch` (D-015 — the localhost harness is archived). Pick any watch video with a facecam plus the segment types below; record where you watched.

## Modes under comparison (on-video bar)

| Mode | How to reach it |
|---|---|
| `original` | **Repair (experimental)** unchecked, **Cover original** unchecked |
| `mask` | **Cover original** checked (repair unchecked) |
| `edge` | Repair checked, mode = *Basic edge fill* |
| `reuse-naive` | Repair checked, mode = *Reuse, no align (control)* — expected to fail (stale cam), included as control |
| `reuse-motion` | Repair checked, mode = *Reuse, motion-aligned* (the candidate) |

## Test segments (watch each mode on each segment)

1. **Static background under the cam** — little/no camera motion. Expected: edge interpolation; any history from earlier motion persists ~2.4 s (anchor eviction), then degrades to edge. That fade is the known ceiling — note it, don't count it as a bug.
2. **Slow camera pan** — expected best case for `reuse-motion` (translation is a good model): coverage should **grow over the pan** (whole-buffer history), not stay at one lag strip, and keep filling while the scene is still.
3. **Fast motion** — match score should drop below 0.5 → coverage cleared, edge-only, not a smeared fill.
4. **Scene cut** — first tick goes untrusted → coverage cleared immediately; history pixels from the old scene must never persist. A smeared cross-cut fill is a bug.

The rect is **never dark** in any repair mode — dark comes only from **Cover original**; `edge`/untrusted states are the honest degradations.

## Metrics

- **Status line** (on video): `repair: NN% history · NN ms` while filling, `repair: edge only (static)` / `repair: edge only (motion 0.NN)` when there is no history, `repair: edge · NN ms` / `repair: no-align control · NN ms` for those modes.
- **Coverage %** — share of rect pixels written from buffered history (each pixel's source must sit outside the cam rect). Grows during motion; should beat the old single-lag strip (~10 %) on pans.
- **Update ms** — wall time per fill (target: no facecam stutter at 10 Hz sampling).
- **Score** — NCC step-match confidence; below 0.5 = untrusted (edge-only + coverage cleared).
- **Log** (popup): transition lines `repair: history fill active …` / `repair: history off — …`, plus the one-time `repair self-check … PASS/FAIL` and `repair history self-check … PASS/FAIL` at first enable (history-off transitions = how often it declined — honesty metric).
- **Flicker** — visual observation per segment (no automated metric in v1); record "stable / mild / bad".

## Recording

Paste results per mode × segment into `memory.md` under a dated entry, including failures. No accuracy or performance claim without these numbers. Expect main-thread cost on YouTube's player — note playback smoothness too.
