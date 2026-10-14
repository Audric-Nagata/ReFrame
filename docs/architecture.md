# Architecture and Implementation Plan

## 1. Current decision

Build a **local web prototype first**, then run a time-boxed browser-extension feasibility spike. Do not build a backend or streaming infrastructure yet.

The product has two potential technical paths:

- **Path A — viewer-side extension:** Operates on an existing video page, subject to browser and platform limitations.
- **Path B — creator-side separate sources:** A future OBS-compatible workflow exposes gameplay and facecam independently, allowing a custom player to compose them.

Path B is not part of the initial implementation.

Automatic facecam detection is now an approved **feasibility experiment** for the local prototype. It is not a promise of robust or universal detection. Manual region selection remains the baseline and fallback. First validate crop/overlay behavior with a known rectangle, then evaluate detection independently.

**New direction (2026-10-12, D-014): background repair.** The project now also aims to fill the original facecam region with an estimated reconstruction: temporal frame reuse first (Stage 1), lightweight inpainting only where reuse leaves gaps (Stage 2, LaMa as candidate, subject to rules.md §2 review), and an offline video-inpainting model (ProPainter) as a quality benchmark only — never shipped. Repair experiments start in a local harness; extension integration happens only after standalone tests are repeatable (`update.md`). Every fill is an estimate; never present fills as recovered pixels.

## 2. Proposed MVP stack

Keep the stack deliberately small:

- TypeScript
- React with Vite for the local prototype UI
- Standard HTML video element for test playback
- CSS for overlay positioning and sizing
- Pointer events for drag interactions
- Browser extension APIs only during the extension feasibility phase
- Local component state for settings; no persistent storage until needed
- A lightweight pretrained face detector only if needed for the detection experiment and after reviewing browser support, dependency size, runtime cost, and license
- ONNX Runtime Web and WebGPU as *candidates* for repair inference — added only after the rules.md §2 need/compatibility/cost/license review
- Canvas-based compositing for the repair layer, reusing the existing draw primitives before considering new rendering dependencies

Avoid introducing a backend framework, database, message queue, cloud storage, custom model training, or streaming infrastructure. Do not select a model or library before establishing the test conditions and confirming it can run locally in the intended environment.

## 3. High-level components

### Local prototype

1. **Video stage** — displays the test video and defines the coordinate system.
2. **Crop configuration** — stores the source rectangle for the facecam, whether entered manually or proposed by detection.
3. **Detection experiment** — samples accessible video frames and estimates a likely face location; it must not be tightly coupled to overlay rendering.
4. **Region estimation and correction** — turns a detected face into a candidate facecam crop region, then allows manual correction. A face rectangle is not assumed to equal the full webcam boundary.
5. **Facecam overlay** — displays the selected crop as an independently movable layer.
6. **Mask layer** — optionally covers the original facecam region. This is only a visual cover, not background reconstruction.
7. **Controls** — toggle visibility, resize, reset layout, and select/correct the crop region.
8. **Status/help text** — explains detection status, the current prototype mode, and known limitations.
9. **Repair layer** — fills the original facecam rectangle with an estimate (temporal reuse first, inpainting only if the approved experiments warrant it). Renders as its own layer below the movable overlay and is always labeled an estimate. Deferred to Phase 2.

Keep manual crop selection functional when detection is unavailable, disabled, or unsuccessful.

### Extension feasibility spike

1. **Content script** — identifies candidate video elements on a supported test page.
2. **Activation control** — user explicitly enables the overlay.
3. **Compatibility adapter** — isolates page-specific behavior; do not assume every player works the same way.
4. **Frame-access check** — verifies whether frames can be accessed through documented browser capabilities before attempting detection or cropping.
5. **Overlay renderer** — displays controls and the crop where technically possible.
6. **Diagnostics** — development-only information about detected video elements and unsupported conditions.
7. **Repair renderer** *(Phase 2, deferred)* — composites the estimated fill over the original facecam rectangle, below the movable overlay. Integrates only after standalone repair tests are repeatable.

Do not assume a content script can read pixels from every cross-origin, DRM-protected, or platform-controlled video. Verify access experimentally and follow platform/browser rules. Do not work around access restrictions.

## 4. Data flow

### Local prototype: manual baseline

1. Browser loads a local test page and sample video.
2. User configures the facecam source rectangle.
3. The prototype renders the selected rectangle in an overlay.
4. User drags/resizes the overlay; only its display geometry changes.
5. Optional mask covers the original facecam rectangle.
6. All state remains in memory for the session.

### Local prototype: detection experiment

1. Browser loads and plays a local test video.
2. The detector samples accessible frames at a controlled interval; it does not process every frame by default.
3. The detector returns a candidate face location, if any.
4. Region-estimation logic proposes a larger crop region around the face. This estimate is provisional because the face does not reveal the exact webcam boundaries.
5. The user can accept, adjust, or replace the proposed region manually.
6. The existing crop/overlay pipeline renders the chosen region and supports drag, resize, hide/show, and reset.
7. The prototype records local development observations about missed detections, false detections, boundary errors, stability, and resource use. Do not upload frames or add analytics.

### Background repair (Phase 2)

1. Frames around the current playback time are buffered (past frames only for live streams; future frames available for prerecorded video).
2. A fill source is chosen: aligned neighboring-frame pixels (Stage 1), or an approved inpainting model's output (Stage 2).
3. The fill is rendered into the original facecam rectangle as its own layer, under the movable overlay.
4. The viewer's moved/resized crop or cutout renders above it.
5. When the fill fails or is unavailable, degrade to the existing mask behavior — never fake success.

### Future creator-side path

1. Creator supplies gameplay and facecam as separate sources.
2. A compatible transport delivers synchronized sources.
3. Player renders gameplay as the base layer.
4. Player renders facecam as a separate overlay.
5. Viewer changes only their local layout.

This future flow requires source synchronization and a supported delivery mechanism. It is not solved merely by adding an OBS plugin.

## 5. Important technical limitations

If a source video already contains the facecam composited into gameplay, a crop can duplicate the facecam elsewhere but cannot recover the gameplay pixels hidden underneath it. Covering the original facecam region may obscure the facecam, but it may also cover important game content.

Face detection identifies a face, not necessarily the facecam's complete rectangular boundary or the identity of the streamer. In-game characters, portraits, multiple people, camera movement, overlays, scene changes, and a streamer leaving the frame can produce false detections or unstable crop estimates. Detection must therefore remain correctable by the user.

For repair specifically: neighboring frames may not contain the hidden content at all (fast motion, scene cuts, overlays, newly appearing content), so any fill is an approximation. Frame-by-frame processing can flicker temporally. Live streams have no future frames, which weakens reuse for live content.

Do not promise perfect separation for existing YouTube or Twitch streams. The extension spike exists to determine what is possible on specific supported pages.

## 6. Suggested project structure

> **Updated 2026-10-12 (D-015):** the local harness was archived to `archive/harness/` (gitignored); the extension below is the single product and test surface.

```text
ReFrame/
├── docs/                      # prd, architecture, rules, design, tasks, memory, update, repair-tests
├── scripts/
│   └── vendor-media.mjs       # copies static files + MediaPipe wasm/models into the build
├── src/
│   └── extension/             # MV3 source: content, overlay, background, offscreen, popup,
│                              # repair*, static/ (manifest, popup/offscreen html)
├── extension/                 # build output of npm run build:ext (gitignored)
├── tsconfig.extension.json
├── package.json               # scripts: build:ext, lint
├── archive/harness/           # retired localhost prototype (kept locally, gitignored)
└── README.md
```

The exact structure may be adjusted to match the repository, but avoid premature abstraction. Do not create a detection module until there is actual detection code to isolate.

## 7. Layout and detection state model

A minimal in-memory layout state can contain:

- `sourceRect`: crop rectangle in source-video coordinates.
- `overlayRect`: overlay position and dimensions in stage-relative coordinates.
- `visible`: whether the overlay is shown.
- `maskOriginal`: whether to cover the original facecam region.
- `enabled`: whether the prototype interaction is active.

Detection state, if implemented, should be separate and minimal:

- `status`: idle, detecting, detected, uncertain, or unavailable/error.
- `candidateFaceRect`: the latest detected face rectangle, if any.
- `candidateSourceRect`: proposed facecam crop rectangle, if estimated.
- `confidence`: optional model confidence, only if the chosen detector provides a meaningful value; do not treat it as calibrated certainty.
- `lastDetectionTime`: local diagnostic timestamp or elapsed time for tracking/re-detection.

Do not persist these values or introduce user profiles in the MVP. Normalize coordinates where practical so the layout scales with the player size. Validate values to prevent the overlay from being dragged entirely outside the stage unless that behavior is intentionally supported.

## 8. Performance and accessibility

- Do not process every video frame with AI in the MVP by default.
- Start with sampled frames and measure whether the chosen approach is fast enough before adding continuous tracking.
- Avoid unnecessary canvas readbacks or frame copies.
- Keep drag interactions responsive and avoid rerendering unrelated UI on every pointer movement.
- Keep detection work separate from pointer-move and overlay-rendering work.
- Provide keyboard-accessible controls for visibility, reset, and size adjustments.
- Ensure overlay controls remain usable at different player sizes.
- Respect the underlying player's controls and playback state.
- Keep detection local to the device; do not upload video frames.
- Repair is the heaviest new workload — budget it separately. Experiment target: roughly 480p at 15–30 repair updates per second on supported entry-level GPUs, with the video itself continuing at normal frame rate. Provide degraded modes when hardware cannot keep up, and measure latency, utilization, memory, dropped frames, and flicker before making any claim.

## 9. Validation plan

1. Verify local video playback.
2. Verify crop coordinates at multiple aspect ratios and player sizes.
3. Verify drag, resize, hide/show, and reset.
4. Test whether masking makes the result worse when gameplay UI sits behind the original facecam.
5. Establish a small, documented test set containing facecams, no-facecam clips, movement, scene changes, and in-game faces.
6. Evaluate a lightweight pretrained detector on accessible local test frames; record missed detections, false detections, crop-boundary errors, stability, and resource use.
7. Compare detection-assisted setup with manual selection; keep manual correction available.
8. Run an extension feasibility spike on a deliberately selected target page and verify frame access through documented browser capabilities.
9. Record what works, what fails, and why before expanding platform support.
10. Build a consecutive-frame repair harness and compare the four conditions (original, basic inpainting, temporal reuse, reuse + inpainting) on documented clips covering motion, scene cuts, overlays, and no-facecam segments; record coverage gaps, flicker, and resource use.
11. Benchmark any repair model/runtime on lower-spec hardware before claiming it is viable in the browser.

Do not define or claim an accuracy threshold until the test set and measurement method are documented. Do not assume local-file results will transfer to a protected or platform-controlled video player.

## 10. Decision gates

- **Continue with A** if a target platform exposes enough video access for a useful experience within documented APIs.
- **Limit A** if access is inconsistent or the original baked-in facecam makes the result unacceptable.
- **Continue automatic detection** only if measured results on representative test clips reduce manual setup without making the experience unreliable or resource-intensive.
- **Keep manual selection as fallback** if automatic detection misses clips, estimates incorrect boundaries, or cannot access frames.
- **Explore B** if independent sources are necessary for quality and there is a plausible creator workflow.
- **Do not build a streaming platform** until user validation justifies the cost and operational complexity.
- **Proceed with Stage 1 (temporal reuse)** if it covers enough of the original facecam region with acceptable artifacts on representative clips.
- **Add Stage 2 (LaMa/inpainting)** only where reuse leaves gaps and the browser-feasibility review (rules.md §2) passes.
- **Stop or degrade repair** if flicker or resource use makes the result worse than the plain mask on target hardware.
- **Keep ProPainter offline** as a benchmark reference only (license and compute cost); never ship it.
