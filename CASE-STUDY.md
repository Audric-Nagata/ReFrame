# ReFrame — Case Study: moving a baked-in facecam (and why the pixels fight back)

## TL;DR

ReFrame is a local-only Chrome (MV3) extension that lets a viewer move, hide, or cover a streamer's facecam on `youtube.com/watch` — plus an experimental fill for the original spot estimated from neighboring frames. Fully on-device (vendored MediaPipe, no accounts, no telemetry, no remote code). The hard lesson: a composited facecam is **one flat video** — you can crop and cover it, but the gameplay behind it is gone, so every fill is an estimate, never a recovery.

## What it does today (verified)

- Enable on a watch page → on-video menu (Hide, Reset, **Detect now**, Mark facecam draw-a-box, Cover original, Segment person, experimental Repair + mode select), draggable crop overlay, popup log + Copy log.
- Face detection (BlazeFace short-range) + person segmentation run in an extension-origin **offscreen document** on sampled frames — never in the page, so YouTube's Trusted Types/CSP never applies.
- Canvas-crop renderer (`drawImage` on `requestVideoFrameCallback`) — required because YouTube serves MSE blob video a second `<video>` element can't clone.
- Detection is deliberately **manual-only**: enabling attaches and shows `idle — press Detect now`; a miss never auto-retries.
- Stage 1 repair: past-frame temporal reuse with motion alignment (10 Hz, ≤480p), whole-buffer coverage history, honest fallback to edge-fill/cover when motion is untrusted (score < 0.5) or a scene cuts.

## Key decisions (each bought something)

| Decision | Why |
|---|---|
| Offscreen document for MediaPipe | Page-context `script.src` blocked by Trusted Types; offscreen is extension-origin |
| Vendor WASM + `.tflite` locally (`'wasm-unsafe-eval'`) | Chrome Web Store forbids remote code; bundled from day one |
| Canvas blit, not duplicate `<video>` | MSE blob source can't be shared between elements |
| Manual-only detection | Auto-retry every 700 ms spammed failures; user clicks Detect now |
| Hybrid edge + history fill, never dark | Old 20% coverage gate was unreachable (static = 0%, pans ≈ 5–15%) so repair looked permanently broken |
| Archive localhost harness, extension-only | Dual surfaces drifted; one test system (D-015) |

## What's missing / honest gaps

1. **No measured numbers yet.** The comparison matrix (`docs/repair-tests.md`: 5 modes × 4 segment types) and the extension test matrix (fullscreen, theater, pause/seek, live, ads, shorts, in-game faces, inference ms + CPU) are defined but **unrun** — no accuracy, latency, or resource claim exists.
2. **Face box ≠ facecam box.** Auto-region is a heuristic (face height ×1.7, 16:9, centered) — wrong on non-standard layouts, multi-person streams, avatar/VTuber cams, in-game faces. Manual draw-a-box is the real fallback.
3. **No tracking.** Region is one-shot per click; streamer moves, scene changes, or camera cuts stale it until the user re-clicks.
4. **Repair ceilings are structural.** History lives ~2.4 s (buffer eviction), then fades to edge-fill; fast motion/scene cuts clear coverage by design; live streams have no future frames; static backgrounds never gain history.
5. **Segmentation person-index unverified.** `confidenceMasks[1]`-is-person is a guess, surfaced as `idx`/`meanAlpha` in the log, not proven.
6. **Rough edges.** No persistent layouts, no resize handles (draw-box + drag only), service-worker enabled-flag lost on sleep, YouTube-only, desktop-Chromium-only, no mobile story.

## Future research (cheapest first)

1. **Run the matrices** — fill `memory.md` with mode × segment results + the platform matrix; set accuracy/perf thresholds only after.
2. **Re-detect policy** — cheap wins before models: re-detect on scene-cut/large-motion signals, confidence-gated, still user-visible (no silent jumps).
3. **Facecam-boundary model** — replace the ×1.7 heuristic: webcam-rectangle detector trained on labeled facecam frames, or border/shadow cues; measure against manual boxes.
4. **Segmentation verification** — confirm mask-index semantics across clips; per-video threshold instead of fixed 0.05 meanAlpha.
5. **Repair upgrades in order** — retained deep-anchor frame (survive the 2.4 s eviction) → LaMa feasibility review (conversion, ops, memory, WebGPU bench on low-spec hardware) → keep ProPainter offline-only (license + cost).
6. **Creator-side path B** — OBS companion with separate gameplay/facecam sources; the only route to pixel-perfect separation.
7. **Product hardening** — per-channel saved layouts, resize handles, keyboard parity, SW-state persistence, multi-platform adapters behind the compatibility layer.

## Reproduce it

```powershell
npm install
npm run build:ext   # tsc → extension/ + vendored MediaPipe
npm run lint
```

Load `extension/` unpacked (Developer mode), open a `youtube.com/watch` video, Enable ReFrame, click **Detect now**. See `docs/repair-tests.md` for the test protocol and `docs/memory.md` for the decision/verification log.
