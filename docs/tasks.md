# Tasks — Current Session

## Current objective

Execute the background-repair direction (**D-014**) **inside the extension** and retire the localhost harness (**D-015**, both approved 2026-10-12): the extension is now the single build, test, and demo surface.

## In scope for this session

- [x] Realign all docs to the repair direction (`update.md`, `rules.md`, `prd.md`, `architecture.md`, `design.md`, `tasks.md`, `memory.md`).
- [x] Define the repair test conditions first (rules.md §8): `docs/repair-tests.md` — 5 modes, 4 segment types, metrics.
- [x] Build the frame buffer + motion-estimated reuse fill (Stage 1, past frames only) with honest fallback to mask.
- [x] **Extension integration (user-directed, supersedes update.md step 8's "after standalone repeatability"):** port repair to `src/extension/{repair,repair-fill,repair-ui}.ts`, wire overlay/content/manifest/background — code done, lint/`build:ext`/emitted self-check green; pending browser verification.
- [x] Fix user-reported retest failures (2026-10-13): unreachable coverage gate → hybrid edge+history fill (never dark); 15 Hz + per-tick allocations → 10 Hz, cached planes/canvas (facecam lag). Checks green; pending browser retest.
- [x] Widen Stage 1 to whole-buffer multi-reference fill (`repair-history.ts`, plan A of 2026-10-13): per-pixel coverage entries over the whole buffer, step-motion chaining, history self-check green. Pending browser retest; LaMa §2 review (plan B) judged after those numbers.
- [x] Archive the localhost harness to `archive/harness/`, prune package.json/vite/tsconfigs, anchor `.gitignore` `extension/`, extension-only README.
- [ ] Comparison matrix with real results per `docs/repair-tests.md`, run **in the extension on YouTube** (modes: original / mask / edge / reuse-naive / reuse-motion).
- [ ] Record coverage gaps, flicker, and resource use honestly in `memory.md`.

## Carried over from the extension spike (open)

- [ ] Run the extension test matrix: fullscreen, theater, pause/seek, live, ads, shorts, no-facecam segments, in-game faces, detection ms + CPU.
- [ ] Detection accuracy checklist (`memory.md`): face visible/away, in-game faces, region jitter, inference ms.
- [ ] Evaluate spike results against `architecture.md` §10 decision gates.

## Explicitly not part of this session

- [ ] No backend, accounts, analytics, or cloud sync.
- [ ] No custom model training.
- [ ] Do not add LaMa, ONNX Runtime Web, or WebGPU before the rules.md §2 need/compatibility/cost/license review with known test conditions.
- [ ] Do not ship ProPainter (or any restricted-license model) — offline benchmark only.
- [ ] Do not claim recovered or restored pixels — fills are estimates.
- [ ] Do not claim YouTube compatibility beyond the cases actually tested.

## Definition of done

- Extension loads with repair controls; reuse fill renders over the original facecam rectangle on a real watch page.
- Comparison matrix exists with recorded results, or an honest failure report.
- Checks (`build:ext`, lint) run and recorded in `memory.md`.

## Next session

Review the in-extension matrix: proceed to the LaMa feasibility review, or iterate on reuse alignment (multi-reference coverage, future-frame pre-scan).
