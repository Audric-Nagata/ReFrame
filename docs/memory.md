# Project Memory and Decision Log

This file records verified progress, important decisions, test results, and unresolved questions. Update it as work happens; do not use it as a wishlist.

## Current project state

- Status: Phase 1 extension spike **browser-verified working** on `youtube.com/watch` (2026-10-12): activation, detection, segmentation, crop overlay, drag, "Mark facecam" draw tool, mask. Stage 1 **background repair (D-014) is now integrated into the extension** (code + checks green; browser matrix open). Local harness **archived** (D-015). Extension test matrix + detection accuracy tests still open.
- Product name: **ReFrame** (formerly Facecam Freedom).
- Implemented: MV3 extension only (`src/extension/`, built to `extension/` via `npm run build:ext`, MediaPipe vendored per D-013). The Vite/React harness lives retired in `archive/harness/` (D-015); scripts are `build:ext` + `lint`.
- Approved scope: person segmentation sampled-frame experiment (D-011); YouTube-only extension target (D-010); background-repair direction (D-014); extension-only surface (D-015).

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
**Decision:** Pretrained person segmentation (streamer cutout) is approved for the local prototype and the extension offscreen document, sampled frames only, optional toggle. Generative reconstruction remains banned. *(Ban scope superseded 2026-10-12 by D-014 — bounded repair experiments now approved; the estimate-vs-recovery honesty rule stands.)*  
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

### D-014 — Background repair approved as the new direction
**Decision:** The project direction expands from move/hide to also **fill the original facecam region** with an estimated reconstruction. Stage 1 — temporal frame reuse (copy from neighboring frames) — is approved. Stage 2 — lightweight inpainting (LaMa as candidate) — is approved as a bounded browser-feasibility experiment, gated on the rules.md §2 need/compatibility/cost/license review. Stage 3 — ProPainter — is an offline quality benchmark only and must never ship (non-commercial license risk). Repair experiments start in a local harness; extension integration only after standalone tests are repeatable (update.md next step 8). All fills are estimates and must never be presented as recovered or restored pixels. Backend/account/cloud/custom-training bans unchanged.  
**Reason:** Product-owner approval of `update.md` as the project direction (2026-10-12). `rules.md` §2, `prd.md` §6 Phase 2, `architecture.md`, and `design.md` updated to match.  
**Status:** Accepted.

### D-015 — Local harness archived; extension is the sole surface (2026-10-12)
**Decision:** The localhost harness (`src/App.tsx`, `src/repair/*`, vite/tsconfigs/`index.html`, `public/`) was **moved to `archive/harness/`** (gitignored, kept locally) at the product owner's direction — "don't test on a different system; the harness has drifted from the extension." All repair testing, development, and demos now happen **in the MV3 extension on YouTube**. Stage 1 repair was ported to `src/extension/{repair,repair-fill,repair-ui}.ts` (classic scripts). This also **supersedes D-014's "extension integration only after standalone tests are repeatable"** clause — the user directed immediate integration, with the extension itself as the repeatability surface. `package.json` reduced to `build:ext` + `lint`; `.gitignore` `extension/` anchored to `/extension/` so `src/extension/` is finally trackable; README rewritten extension-only.  
**Reason:** Harness/extension divergence made dual maintenance pure cost; user owns the testing loop and wants one system.  
**Status:** Accepted (2026-10-12).

## Technical assumptions to verify

- A local test video can be used to validate crop and overlay geometry.
- Browser-extension access to video frames may vary by player, origin, and content protections.
- An overlay can be positioned relative to a video stage without disrupting playback controls.
- The source crop may need manual configuration in the first prototype.

These are assumptions until tested.

## Verification log

### 2026-10-14 — "Segment face" reported as detection failure: isolation + diagnostics
- **Reported:** clicking *Segment person* → status shows `uncertain / miss`, on frontal, profile, and avatar facecams alike. Read carefully: the checkbox **cannot** affect face detection (independent paths) — detection was missing on its own, and segment offered no rescue (it only masks *inside an existing crop region*; no region → no cutout). What DID exist was a real bug: **segment failures wrote the shared detection status**, so any segment error displayed as "detection failed".
- **Static verification (clean):** `@mediapipe/tasks-vision` 1.1.0 = package range; typings match every field we read (`detections`, `categories`, `confidenceMasks`, `getAsFloat32Array`, `detectForVideo(bitmap, ts)`); both `.tflite` files valid (`TFL3` magic, 229 746 / 249 537 bytes). → miss is runtime-only; no static bug found.
- **Diagnostics (ride the task response, no new infra):** offscreen detect returns `diag: detections=N, topScore, bitmap=WxH, meanLuma` (subsampled luma probe) — logged on every face miss; separates blank frame (luma ~0) / detector-blind (good luma, 0 detections) / threshold gate (>0 detections, low score). Segment returns `masks`, `maskIdx`, `meanAlpha` — logged only when the mask is weak/empty (no spam). The person-category guess (`confidenceMasks[1]`, never verified) is now visible as `idx` + `meanAlpha`.
- **Fixes (no-regret):** segment failures are **log-only** and never touch the detection status (error + throw paths); segment calls **serialized** with one in-flight flag (`Segment: skipped (busy)` once per episode) — checkbox/sampler/Detect-now overlapped on one `ImageSegmenter`; split face/segment handlers into new `content-detect.ts` (content.ts 305→296) and added it to **both** injection lists.
- Checks: `lint` ✓ · `build:ext` ✓ · both repair self-checks PASS ✓ · `extension/content-detect.js` emitted ✓ · manifest list updated ✓. Lines: overlay.ts 344 still over (pre-existing debt, untouched).
- OPEN (developer run): reload unpacked → on a frontal-face video, read the popup log `Detect: miss — … | detections=…, topScore=…, meanLuma=…` line and paste it; it decides the fix (capture path vs detector vs thresholds). Record results here.

### 2026-10-13 — Whole-buffer coverage history (multi-reference reuse)
- **Motivation (user retest):** fill quality below expectation — a single lag frame caps coverage at one displacement (~10 %); the plan (approved): use the whole buffer as source context now, judge the rules.md §2 LaMa review later if static scenes still disappoint.
- **New:** `src/extension/repair-history.ts` (199 lines) — per rect pixel an entry `(anchorSeq, cumX, cumY)` = where that pixel's background was last observable; apply time `src = pixelPos + (cumNow − cumAnchor)` sampled from the anchor frame. Three paths per pixel: existing entry → fresh observe from the previous frame (instant fill after a reveal) → scan buffer newest→oldest. Untrusted motion clears all entries (the trust gate is the stale-content guard). Added to **both** injection lists (`manifest.json` + `background.ts`).
- **Rework:** motion is now estimated vs the *previous* frame (1 NCC search/tick, its luma planes were already cached); repair-ui chains `cur.cum = prev.cum + ema(step)` (frozen on untrusted ticks); `REPAIR_REF_LAG` removed — no fixed baseline anymore (the naive control keeps `REPAIR_NAIVE_LAG = 13`); status gained `edge only (static)`; log lines renamed `history off — …`.
- **Check:** `runHistorySelfCheck()` (runs at first enable, logged) — synthetic +2 px/tick pan over 10 ticks: coverage 5 %→50 %, **0 wrong of 600 written pixels** vs true background (catches cum/anchor sign errors). Both self-checks PASS; `lint` + `build:ext` green. Lines: repair.ts 299, repair-history.ts 199, repair-ui.ts 169, repair-fill.ts 140 (all ≤300 — `repair.ts` doc trimmed, history split out).
- **Honest ceilings recorded (repair-history.ts comments + repair-tests.md):** after motion stops, history lives ~2.4 s (anchor eviction) then degrades to edge (upgrade path: one retained deep-anchor frame); no per-entry luma verification (unverifiable by construction — the content under the rect changes over time); future frames remain unreachable during playback.
- OPEN (developer run): reload unpacked → pan segments should show coverage growing past the old ~10 % strip and facecam staying smooth; then the full matrix per `docs/repair-tests.md`. If **static** scenes remain the quality complaint → run the rules.md §2 LaMa feasibility review (plan B, judged with these numbers).

### 2026-10-13 — Repair always-masked + facecam lag fixed (hybrid fill, 10 Hz loop)
- **Reported (user retest):** status stuck on `repair: masked (score …)` with a permanent dark cover; facecam overlay lagged only while Repair was checked (GPU-composited video can't lag — our JS canvas does).
- **Root causes:** (1) the 20% coverage gate was structurally unreachable — static video → dx=0 → coverage 0; real pans → |shift|/rect-width ≈ 5–15%; below gate → dark every time. (2) 15 Hz loop did full readback + two blurred luma planes + fresh canvas/ImageData each tick (~10–15 ms spikes + ~3 MB/s garbage) → GC pauses delayed requestVideoFrameCallback overlay draws.
- **Fix — fill (`repair-fill.ts`):** `reuse-motion` is now hybrid — edge-interpolation base always drawn, history pixels overwrite only where the motion source lands outside the rect; untrusted motion → edge-only. `FILL_MIN_COVERAGE` and the dark fallback **deleted** (dark = "Cover original" only). Output canvas/ImageData cached per rect size.
- **Fix — jank:** blurred luma cached on the frame (`ColorFrame.planes`) — each frame is `cur` once, `prev` once ~1.3 s later → one plane build per tick instead of two; blur tmp workspace reused; `REPAIR_SAMPLE_MS` 66→100 (10 Hz), `REPAIR_REF_LAG` 20→13 keeps the ~1.3 s baseline; `estimateMotion` returns the best match regardless of threshold, trust gate moved to `repair-ui` (status can report the score below 0.5).
- **Status/log:** `repair: NN% history · NN ms` / `repair: edge only (motion 0.NN)` / `repair: edge · …` / `repair: no-align control · …`; transitions logged as `history fill active` / `motion untrusted — edge only`; canvas always drawn.
- Checks: `npm run lint` pass · `npm run build:ext` pass · node-concat self-check `expected (7,-3) got (7,-3) score 1.00 → PASS` exit 0. Lines: repair.ts 295, repair-fill.ts 149, repair-ui.ts 149 (all ≤300).
- OPEN (developer run): reload unpacked → verify fill appears + facecam stays smooth, then the full matrix per `docs/repair-tests.md`.

### 2026-10-12 — Stage 1 repair ported into the extension + harness archived (D-015)
- **New:** `src/extension/repair.ts` (buffer + pre-blur NCC motion + self-check, 280 lines), `repair-fill.ts` (edge / reuse-naive / reuse-motion + coverage/score gate, 129), `repair-ui.ts` (state, 66 Hz→15 Hz loop, bar controls, status string, 143). Wiring: overlay (repair canvas into shadow root, mode `<select>`, % positioning, status append, destroy cleanup), content (stop on deactivate), manifest + `background.ts` injection fallback now load `["repair.js","repair-fill.js","repair-ui.js","content.js","overlay.js"]`.
- Fixed during build: `type FillMode` collided with TypeScript's **DOM lib `FillMode`** → renamed `RepairMode`.
- Checks: `npm run lint` pass · `npm run build:ext` pass · **emitted classic files self-check PASS** (`expected (7,-3) got (7,-3) score 1.00`, run by concatenating `extension/repair*.js` under node) · harness `npm run build` green on its final run before archiving.
- **Archive:** harness moved to `archive/harness/` (incl. `public/sample-video/test.mp4`, old README); `dist/` deleted; `npm uninstall react react-dom vite @vitejs/plugin-react @types/react* @types/node` (24 packages removed, 0 vulns); scripts = `build:ext` + `lint`; `.oxlintrc.json` ignores `archive`; `.gitignore`: `/extension/` anchored (fixes the src/extension-invisibility bug) + `archive/`.
- Line debt (pre-existing, worsened): `content.ts` 305, `overlay.ts` 344 — both over the 300 split line; extract candidates if touched again.
- OPEN (developer run): reload unpacked extension → repair matrix per `docs/repair-tests.md` on YouTube; also the extension test matrix + detection checklist above.

### 2026-10-11 — Automated checks (Windows, Node 24.11.1, npm 11.6.2)
- `npm run lint` (oxlint): pass, 0 findings.
- `npm run build` (tsc -b + vite build): pass — MediaPipe correctly lazy-loads as a separate chunk (`vision_bundle`, 154 KB gz 46 KB; model/WASM stay on CDN).
- `npm run dev` smoke test: server starts, `GET /` returns HTTP 200 with app markup (run twice — pre- and post-detection).
- Fix applied during earlier checks: removed unused `clampSizePx` import by wiring it into `scaleOverlay` (Smaller/Larger now respect min/max bounds).

### 2026-10-12 — Extension end-to-end browser verification (developer runs)
Pipeline confirmed working on `youtube.com/watch` (video 1280×720): content script injects, popup activates, offscreen tasks round-trip, auto-detect → 16:9-expanded box, "Mark facecam" draw tool, segment person, mask. Root-caused and fixed during the session, each verified by a developer retest:
- Spread-order bug `{ kind: 'task', ...msg }` → the `'frame'` tag clobbered `'task'`, offscreen never answered ("no response"). Fixed to `{ ...msg, kind: 'task' }`; relay now surfaces a named error instead of `undefined`.
- MV3 CSP blocked MediaPipe WASM (`script-src 'self'`). Fixed: `content_security_policy.extension_pages` += `'wasm-unsafe-eval'` (MV3-legal token; no `unsafe-eval`, no remote code).
- ImageSegmenter created with `runningMode: 'VIDEO'` but called via the IMAGE-mode API `segment()` — fixed by removing `runningMode` (defaults to IMAGE).
- Overlay root used page coordinates while appended to positioned `#movie_player` — fixed with host-relative positioning + fullscreen re-host.
- Silent activation failures — added try/catch + ack surfacing in the popup, `/watch`-URL guard, and a `chrome.scripting` injection fallback (also covers extension-reload-without-tab-reload).
- Stale content-script copies log "Extension context invalidated" after extension reload — reload the tab after reloading the extension; `reframeLogAdd` guarded.
**Canvas readback from the extension context is now VERIFIED** (frames sampled ~every 700 ms with working detection) — retires the provisional caveat in the 2026-10-11 entry above.
- Checks: `npm run build:ext`, `oxlint`, and app build all passed after each change across the session.
- Open: extension test matrix (fullscreen/theater/ads/live/shorts), detection accuracy checklist.

### 2026-10-12 — Stage 1 repair prototype built (local harness only) *(superseded by D-015 — code archived to `archive/harness/`, live port is the extension entry at the top of this log)*
- `docs/repair-tests.md` written first (rules.md §8): 5 modes (original / mask / edge-fill / reuse-naive control / reuse-motion), 4 test segments, metrics defined. *(Now extension-scoped — see the current version.)*
- New: `src/repair/{buffer,motion,fill,selfcheck}.ts`, `src/RepairLayer.tsx`, `src/RepairPanel.tsx`; extracted `Controls.tsx` + `CropRegion.tsx` (App.tsx back under 300 lines — 286).
- Algorithm: 15 Hz grayscale→RGBA frames at ≤480p, 24-frame ring; NCC block match (32 px windows outside the rect, ±48 px, coarse step 3 + refine) on box-blurred luma (r=3); fill sources must land OUTSIDE the rect or they're still webcam; score < 0.5 or coverage < 20% → honest fallback (mask look + status line); EMA smoothing (α=0.4).
- Two bugs found and fixed during build: (1) coarse+refine search missed the peak on noise-like content — the correlation peak was 1 px wide; fixed with pre-blur, which real video gets for free; (2) garbled bounds check in the offset probe.
- Measured (node, synthetic 480×270): `estimateMotion` 7.1 ms, recovers known (9,−5) exactly, score 1.00. Dev self-check (`selfcheck.ts`, white-noise worst case): `expected (7,-3) got (7,-3) score 1.00 → PASS`.
- Checks: `npm run lint` pass, `npm run build` (tsc + vite) pass. All files ≤286 lines.
- Was open at the time: comparison matrix on `public/sample-video/test.mp4`; future-frame pre-scan (Stage 1b) not implemented — past-frames-only. *(Matrix now runs in the extension; test.mp4 lives in `archive/harness/public/`.)*

### 2026-10-11 — Extension scaffold build checks (Windows, Node 24.11.1)
- `npm run build:ext` (`tsc -p tsconfig.extension.json` + static copy + MediaPipe vendor): pass. Extension loads from `extension/` (manifest, content/overlay/background/offscreen/popup JS, vendored `lib/` with wasm ~38 MB + models ~480 KB).
- `npm run lint` (oxlint, `extension/` build output ignored): pass, 0 findings.
- `npm run build` (app harness: tsc -b + vite build): pass.
- Local harness: `.overlay` now has `overflow: hidden` — the doubled-video bug is fixed in code (browser verification pending).
- NOT yet verified in a browser at that time: the extension itself — pixel access re-verification, detection, drag, fullscreen, and the rest of the test matrix were open. *(Superseded by the end-to-end verification entry above, same date: pixel access, detection, drag, and activation are now verified; fullscreen/theater/ads and the detection accuracy checklist remain open.)*

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
- [x] Browser-extension access on a target platform. *(Verified 2026-10-12 — see the end-to-end entry above.)*
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
