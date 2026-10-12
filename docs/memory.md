# Project Memory and Decision Log

This file records verified progress, important decisions, test results, and unresolved questions. Update it as work happens; do not use it as a wishlist.

## Current project state

- Status: Phase 0 local prototype complete and developer-verified for overlay interaction (one rendering bug still pending the one-line fix). Phase 1 extension spike started — YouTube `youtube.com/watch` only.
- Product name: **ReFrame**.
- Implemented: Vite + React 19 + TS local harness (stage, crop config + dashed outline, draggable/resizable overlay, mask, hide/show/reset, free-ratio, MediaPipe detection experiment with log).
- Approved scope additions: person segmentation as a sampled-frame experiment (local + extension); YouTube-only extension target.
- Pending immediate: `.overlay` `overflow: hidden` fix (doubled-video symptom), then extension scaffold.

## Product decisions

### D-001 — Validate viewer-side customization first
**Decision:** Start with a local prototype, then investigate a browser extension.  
**Reason:** It tests the core interaction without requiring platform partnerships or streaming infrastructure.  
**Status:** Accepted.

### D-002 — Treat existing-stream extraction as uncertain
**Decision:** Do not assume an extension can extract a facecam that is baked into a single video.  
**Reason:** A crop can duplicate the facecam, but cannot recover gameplay hidden beneath it. Browser and platform access also vary.  
**Status:** Accepted.

### D-003 — Keep creator integration as a future path
**Decision:** Consider an OBS-compatible workflow only after validating the local prototype and the feasibility of Path A.  
**Reason:** Separate sources provide a cleaner result but require a delivery path that preserves and synchronizes them.  
**Status:** Accepted.

### D-004 — No backend in the MVP
**Decision:** Keep the first prototype local and in-memory.  
**Reason:** User accounts, cloud sync, and a backend are unnecessary to validate the interaction.  
**Status:** Accepted.

### D-005 — Stack: Vite + React 19 + TypeScript, oxlint
**Decision:** Scaffolded from the official `vite` react-ts template; checks are `tsc -b`, `vite build`, `oxlint`. No extra dependencies.  
**Reason:** Matches architecture.md §2; template conventions reused as-is.  
**Status:** Accepted.

### D-006 — Crop rendered via duplicate `<video>` element (SUPERSEDED by D-013)
**Decision:** Second `<video>` (same src, muted) positioned inside an overflow-hidden overlay; playback mirrored from the main video via play/pause/seeked events plus a 2 s drift check.  
**Reason:** No canvas readback, no dependency; architecture.md §8.  
**Known ceiling:** drift possible between the two elements. Acceptable for PoC.  
**Status:** Superseded for the extension by D-013 — YouTube's MSE blob source cannot be cloned into a second video element. Kept only in the local harness.

### D-007 — Free aspect ratio behind a "Customize" setting
**Decision:** Resize preserves the crop's aspect ratio by default; a "Customize aspect ratio" checkbox enables free-ratio resizing.  
**Reason:** design.md §7 allows free ratio if deliberately implemented; user requested it as a setting.  
**Status:** Accepted.

### D-008 — Detection library: @mediapipe/tasks-vision (BlazeFace short-range)
**Decision:** Use `@mediapipe/tasks-vision` v1.1.0 (Apache-2.0, verified from package metadata) for the approved detection experiment. Loads WASM + short-range model from CDN on first **Detect facecam** click (~5 MB, browser-cached after); vendorable later if offline use matters. One-shot user-triggered sampling (5 frames, 500 ms apart, median-aggregated) — no continuous tracking until responsiveness is measured (tasks.md). Candidate region = face box padded by heuristic constants; never auto-applied — **Use this region** is explicit, manual inputs remain the correction path.  
**Reason:** rules.md §2 requires need/compat/cost/license review before adding a library — recorded here. Only maintained option with a video-frame API; tfjs heavier, face-api.js unmaintained. Desktop Chromium + WASM matches design.md target.  
**Status:** Accepted.

### D-009 — Crop-region outline + bottom-left defaults (user-reported bug fix)
**Decision:** Dashed outline on the stage shows the current crop region (toggleable); default crop moved to bottom-left (typical OBS layout) with the overlay parked top-right.  
**Reason:** Developer test report (2026-10-11): with identical default rects, the duplicate sat pixel-aligned over the original and read as "two of the same videos stacked"; the crop box also missed a bottom-left facecam entirely. Rendering math was verified correct — this was a defaults/feedback problem, not a crop bug.  
**Follow-up (honest correction, 2026-10-11):** a second, real rendering bug was then identified — `.overlay` lacked `overflow: hidden`, so the oversized inner video spilled across the whole stage ("doubled video"). The fix is one CSS line, still pending at doc-sync time.  
**Status:** Accepted.

### D-010 — Extension target: YouTube `youtube.com/watch` only
**Decision:** The Phase 1 spike targets `youtube.com/watch` exclusively — no Shorts, no embeds, no other pages.  
**Reason:** Product-owner decision; keeps the time-boxed spike narrow and testable.  
**Status:** Accepted.

### D-011 — Person segmentation approved as a sampled-frame experiment
**Decision:** Pretrained person segmentation (streamer cutout) is approved for the local prototype and the extension offscreen document, sampled frames only, optional toggle. Generative reconstruction remains banned.  
**Reason:** Product-owner approval of a scope change (2026-10-11 request via GPT-assisted exploration); `rules.md` §2 updated with the carve-out.  
**Status:** Accepted.

### D-012 — Canvas-crop renderer replaces duplicate-video (supersedes D-006 for the extension)
**Decision:** Extension overlay renders the crop with `drawImage(video, sx,sy,sw,sh, …)` into a canvas on `requestVideoFrameCallback`. Detection/segmentation runs in an extension-origin offscreen document receiving downscaled `ImageBitmap` frames; MediaPipe is never injected into the page (avoids Trusted Types). Overlay DOM is built programmatically in a shadow root (no `innerHTML`).  
**Reason:** YouTube serves video via MSE blob URL — a second `<video>` cannot share it; canvas blit was proven workable by the developer's pixel-read test (see verification log). Architecture already anticipates a "frame-access check" and "compatibility adapter".  
**Status:** Accepted.

### D-013 — Extension bundles MediaPipe locally (no CDN, no remote code)
**Decision:** WASM glue, `.wasm`, and `.tflite` model files are vendored into the extension package and loaded via `chrome.runtime.getURL`. The local ReFrame harness page keeps CDN loading.  
**Reason:** Chrome Web Store policy forbids remote code execution in extensions; designing bundled from day one avoids a rewrite later.  
**Status:** Accepted.

## Technical assumptions to verify

- A local test video can be used to validate crop and overlay geometry.
- Browser-extension access to video frames may vary by player, origin, and content protections.
- An overlay can be positioned relative to a video stage without disrupting playback controls.
- The source crop may need manual configuration in the first prototype.

These are assumptions until tested.

## Verification log

### 2026-10-11 — Automated checks (Windows, Node 24.11.1, npm 11.6.2)
- `npm run lint` (oxlint): pass, 0 findings.
- `npm run build` (tsc -b + vite build): pass — MediaPipe correctly lazy-loads as a separate chunk (`vision_bundle`, 154 KB gz 46 KB; model/WASM stay on CDN).
- `npm run dev` smoke test: server starts, `GET /` returns HTTP 200 with app markup (run twice — pre- and post-detection).
- Fix applied during earlier checks: removed unused `clampSizePx` import by wiring it into `scaleOverlay` (Smaller/Larger now respect min/max bounds).

### 2026-10-12 — Extension scaffold build checks (Windows, Node 24.11.1)
- `npm run build:ext` (`tsc -p tsconfig.extension.json` + static copy + MediaPipe vendor): pass. Extension loads from `extension/` (manifest, content/overlay/background/offscreen/popup JS, vendored `lib/` with wasm ~38 MB + models ~480 KB).
- `npm run lint` (oxlint, `extension/` build output ignored): pass, 0 findings.
- `npm run build` (app harness: tsc -b + vite build): pass.
- Local harness: `.overlay` now has `overflow: hidden` — the doubled-video bug is fixed in code (browser verification pending).
- NOT yet verified in a browser: the extension itself (needs developer load-unpacked run) — pixel access re-verification, detection, drag, fullscreen, and the rest of the test matrix are open.

### 2026-10-11 — Extension feasibility findings (developer + GPT-assisted, YouTube watch page)
Recorded as reported; not yet re-verified by the extension build itself.
- Found YouTube's active `<video>` element via DevTools; main video 2560×1440, actively playing.
- Decoded pixels read successfully via canvas `getImageData()`; 25 reads over 5 s, zero errors. (Surprising for cross-origin media — canvas tainting normally blocks this; treat as strong but provisional until re-verified from the extension context — see test matrix.)
- Loading MediaPipe directly into YouTube's page script context was **blocked by Trusted Types** (expected: youtube.com ships a strict TT/CSP policy). Workaround adopted in D-012: run MediaPipe in an extension-origin offscreen document, never in the page.
- A standalone local HTML person-segmentation lab was prepared with MediaPipe; superseded by D-011/D-013 — the experiment now lives in ReFrame/extension code, not a throwaway page.

### 2026-10-11 — Developer manual test (report, pre-detection build)
- Overlay drag/resize/hide worked on the developer's OBS test clip.
- Reported issue: overlay appeared as a 1:1 duplicate of the video — root-caused to identical default rects + oversized default crop vs a bottom-left facecam (not a rendering bug). Fixed in D-009.

### Detection tests — NOT yet run (developer browser runs required)
Run on the OBS clip first, then the listed scenarios; paste **Copy log** output here:
- [ ] OBS clip, facecam bottom-left: did detection find the face? Did the estimated region cover the full webcam view?
- [ ] Segment with streamer away / no facecam: expect `uncertain`, no region proposed.
- [ ] In-game faces or portraits: any false detections?
- [ ] Movement within frame: candidate stable or jittery?
- [ ] Responsibility/resource note: inference ms per sample from the log; playback sluggish?

### Manual checklist — overlay interaction (developer-verified except where noted)
- [x] Local video playback (empty-state notice also confirmed present in code path).
- [x] Crop region inputs update the overlay.
- [x] Drag: overlay moves, stays within stage bounds.
- [x] Resize: corner handle; min 48 px, max 50% of stage; aspect preserved unless "Customize aspect ratio" is on.
- [x] Hide/show and reset.
- [x] Mask covers original region; warning visible while enabled.
- [x] Stage/window resize: layout scales, no drift out of bounds.
- [ ] Overlay interaction does not pause/seek the main video.
- [x] Keyboard: all buttons reachable via Tab, visible focus rings.
- [ ] Playback sync between main video and overlay crop (watch for drift).

### Not yet tested
- [ ] Browser-extension access on a target platform.
- [ ] Performance on a real livestream.

Record each test with date, environment, result, and reproduction steps when available.

## Open questions

- First target platform: YouTube, Twitch, or local test page only?
- Is manual crop configuration acceptable for the first demo?
- What video test asset can be used lawfully and consistently?
- What result would be good enough to justify an extension?
- If Path A is too limited, what is the smallest creator-side experiment for Path B?

## Update rules

- Add decisions with IDs such as `D-005`.
- Record only observed results as facts.
- Keep failed experiments; they prevent repeated work.
- Update status when a decision changes and explain why.
- Do not duplicate the entire PRD or architecture here.
