# Product Requirements Document (PRD)

## 1. Product summary

**Working name:** ReFrame  
**Product type:** Viewer-side tool for customizing facecam placement in gaming videos and livestreams.  
**Initial direction:** Validate a browser-extension experience first, while keeping a creator-side integration as a possible future path.

ReFrame explores a simple idea: viewers should be able to choose where a streamer's facecam appears, how large it is, and whether it is visible, rather than being limited to the creator's original layout.

The intended experience is to **automatically detect the facecam**, then allow viewers to move, resize, hide, or restore it. Manual selection remains available when automatic detection fails.

The second half of the problem is the **original** facecam location: the tool should estimate and fill the region the baked-in facecam covers — neighboring-frame reuse first, lightweight inpainting only if reuse leaves gaps (approved direction 2026-10-12; details in `update.md`). Every fill is an estimate, never recovered pixels.

## 2. Problem

In gameplay videos and livestreams, the facecam can cover important game UI such as a minimap, health bar, subtitles, inventory, or other visual information. Viewers usually cannot change the creator's baked-in layout.

## 3. Target users

### Primary

- Viewers of gaming livestreams and Let's Play videos.
- Viewers who want to keep the facecam visible but move it away from important gameplay UI.
- Viewers who want to resize or hide the facecam for their own viewing session.

### Secondary, future

- Streamers who want to offer viewers more control over their presentation.
- Viewers of other video formats where independently movable picture-in-picture elements would be useful.

## 4. Product principles

1. **Viewer-controlled:** Layout changes affect the current viewer, not the creator's stream or other viewers.
2. **Non-destructive:** Never modify or redistribute the original video.
3. **Honest about limitations:** Do not imply that a baked-in facecam can be perfectly separated or that obscured gameplay can be recovered.
4. **Progressive validation:** Prove the interaction, detection feasibility, and technical compatibility before building a streaming platform or backend.
5. **Minimal permissions:** Request only the browser permissions needed for the supported experience.
6. **Fallback over failure:** When automatic detection is uncertain or incorrect, let the viewer select or correct the region manually.

## 5. MVP goal

Determine whether a browser-based tool can provide a useful, understandable facecam-repositioning experience on a narrowly defined set of videos, and identify the technical limits of doing this on existing livestream platforms.

The MVP is a **feasibility prototype**, not a promise of universal compatibility with YouTube, Twitch, or every video player.

A key experiment is whether a lightweight computer-vision approach can identify a likely facecam region reliably enough to reduce or eliminate manual selection for the tested videos.

A second experiment covers **background repair**: whether the original facecam region can be filled with a convincing estimate of the hidden gameplay (temporal reuse first, inpainting only if needed), without claiming perfect recovery.

## 6. MVP scope

### Phase 0: Local prototype

> **Status: archived 2026-10-12 (D-015).** The localhost harness was retired to `archive/harness/`; the extension is now the sole test surface. The requirements below record what Phase 0 validated before archiving.

- Play a test video in a simple development page.
- Implement manual rectangular facecam-region selection as a baseline and fallback.
- Experiment with automatic face detection to locate a likely facecam.
- Estimate the facecam region from the detected face, including enough surrounding area to capture the webcam view.
- Track the detected region across sampled video frames where feasible.
- Allow the developer to correct the detected rectangle manually.
- Render the selected or detected crop as a separate overlay.
- Drag the overlay to a new position.
- Resize the overlay within defined minimum and maximum limits.
- Hide and show the overlay.
- Provide a mask over the original facecam region for experimentation.
- Clearly document that masking covers the original facecam; it does not restore the gameplay behind it.
- Log detection failures and test results, including false detections, missed facecams, and unstable region tracking.

**Phase 0 detection constraint:** Begin with a lightweight, pretrained face detector rather than training a custom model. Treat the full facecam-boundary estimation as an experiment because detecting a face does not automatically identify the entire webcam rectangle.

### Phase 1: Browser-extension feasibility spike

- Target one desktop browser, preferably Chrome/Chromium.
- Detect supported video elements on a test page.
- Verify what can and cannot be accessed from the page and its player.
- Test whether a crop/overlay can be rendered without breaking normal playback controls.
- Investigate whether the selected detection approach can process accessible video frames within acceptable resource limits.
- Test automatic facecam detection on a small, representative set of supported videos.
- Compare automatic detection with manually selected regions.
- Provide manual correction or selection when detection fails or is uncertain.
- Record compatibility, detection accuracy, performance, and failure cases.
- Use a user-triggered activation flow rather than automatically modifying every video page.

### Phase 2: Background-repair prototype (approved 2026-10-12)

- Build a small test harness that processes consecutive frames from short, documented clips.
- Test **temporal frame reuse** first: fill the original facecam rectangle from past frames (and future frames for prerecorded video), with motion alignment where needed.
- Compare four conditions on the same clips: original video, basic inpainting, temporal reuse, and reuse + inpainting.
- Evaluate across moving gameplay, camera motion, scene cuts, and overlays; record coverage gaps and flicker.
- Evaluate a lightweight inpainting model (LaMa as candidate) for browser feasibility only after temporal-reuse results are known; review conversion, operator support, memory use, and runtime cost first.
- Benchmark ONNX Runtime Web and WebGPU on lower-spec hardware; expect that CPU fallback or degraded modes may be necessary.
- Treat ~480p repair at 15–30 updates per second as an experiment target, not a specification; measure latency, utilization, memory, dropped frames, and flicker before making claims.
- Integrate repair into the extension only after standalone tests are repeatable.

### MVP acceptance criteria

- A test video plays normally.
- A facecam region can be selected manually if automatic detection is unavailable or unsuccessful.
- On a defined set of test videos, the prototype can attempt to detect a likely facecam without requiring the viewer to draw the rectangle first.
- Detection results can be corrected manually.
- The facecam overlay can be dragged, resized, hidden, and restored.
- Overlay interaction does not unexpectedly pause or seek the video.
- The prototype communicates when the original facecam area is merely masked.
- Detection failures and incorrect detections can be recorded during testing.
- Unsupported pages fail gracefully and explain the limitation.
- No account, server, database, analytics, or cloud-hosted AI model is required for the local prototype.

**Acceptance criteria note:** Do not set an arbitrary detection-accuracy or frame-rate target before establishing a baseline. Define measurable thresholds after testing representative clips.

## 7. Future possibilities (not MVP commitments)

- More robust facecam-region detection across different layouts, shapes, and scene changes.
- A specialized object-detection model if a lightweight pretrained approach proves insufficient.
- Saved per-channel or per-video layouts.
- Optional OBS companion/plugin that works with separate creator-provided sources.
- Support for additional browsers and video platforms.
- User profiles and cloud synchronization.
- More general repositioning of multiple video elements.
- Higher-quality reconstruction than the Phase 2 approaches (for example full video-inpainting models), subject to feasibility and the limitation that fully obscured gameplay cannot be recovered reliably from a single composited frame.

These are hypotheses, not approved MVP requirements.

## 8. Out of scope

Do not build these unless the product owner explicitly changes this document:

- A new livestreaming platform.
- A video-hosting service or CDN.
- A custom streaming protocol or streaming server.
- A backend, database, user accounts, or authentication.
- Cloud synchronization or social features.
- Chat, donations, subscriptions, creator monetization, or moderation tools.
- Training a custom AI model before evaluating simpler detection approaches.
- Shipping any model or benchmark tool whose license forbids the intended use (ProPainter is offline-benchmark-only).
- Claims that the extension can extract a facecam from every existing stream.
- Claims that hidden gameplay pixels can be restored from a single composited frame.
- Bypassing DRM, access controls, paywalls, or platform restrictions.
- Scraping private APIs or relying on undocumented platform internals.
- Downloading, recording, or redistributing livestream content.
- Contacting YouTube, Twitch, or OBS as a prerequisite to the initial local prototype.

## 9. Risks and assumptions

| Risk / assumption | Impact | Response |
|---|---|---|
| Facecam is baked into one video stream | Cannot cleanly separate the facecam | Validate crop-and-mask limitations early |
| Face detection identifies an in-game character or another person | Incorrect region is selected | Test false detections and provide manual correction |
| Detected face does not represent the full facecam boundary | Crop excludes parts of the streamer or includes unwanted gameplay | Estimate surrounding boundaries and allow manual adjustment |
| Facecam position changes between scenes | Crop becomes inaccurate | Track the region and re-detect when needed |
| Streamer leaves the frame or detection confidence drops | Overlay may jump, drift, or become inaccurate | Handle uncertain detections gracefully and allow manual control |
| Video element is inaccessible or protected | Extension may not access frames | Test real pages and document unsupported cases |
| Detection consumes too much CPU/GPU | Playback or interaction becomes sluggish | Sample frames, use lightweight models, and measure resource use |
| Mask covers gameplay underneath | Visual artifact remains | Explain limitation and treat it as a known trade-off |
| Neighboring frames never show the hidden content (fast motion, cuts, overlays, new content) | Filled region is wrong or incomplete | Compare reuse vs inpainting per scene type; degrade to plain mask |
| Frame-by-frame inpainting flickers over time | Repair area shimmers, breaks trust | Measure flicker explicitly; use temporal methods only where justified |
| WebGPU/driver variance across devices | Repair too slow on some hardware | CPU fallback, degraded modes, test on actual low-spec hardware |
| Model/runtime licenses (e.g. ProPainter non-commercial terms) | Distribution blocker | Offline-benchmark-only for restricted licenses; license review before any addition |
| Live streams have no future frames | Weaker repair for live content | Restrict reuse to past frames and document the gap |
| Platform rules or browser permissions limit behavior | Distribution/compatibility risk | Use documented APIs and review applicable terms before release |
| Separate sources require creator cooperation | Limits future creator-integration adoption | Keep creator integration as a later path |

## 10. Success measures

For the first prototype, success means learning, not growth:

- Can a user understand and operate the controls without instruction?
- Does repositioning work smoothly on the test video?
- How often does automatic detection correctly locate the intended facecam on the test set?
- How often does detection select the wrong person, miss the facecam, or estimate incorrect boundaries?
- How stable is the detected region when the streamer moves or scenes change?
- How much processing time and CPU/GPU resource use does detection require?
- How often does the original facecam remain visible or leave artifacts after masking?
- On the comparison set, does temporal reuse cover enough of the original region to be useful, and where does it fail?
- Does any fill visibly flicker or look wrong enough to break trust?
- What repair rate and resource use does the target hardware sustain?
- Can the extension interact with a real target player through documented browser capabilities?
- Is the resulting experience useful enough to justify further development?

Record the test videos, conditions, failures, and results. Do not invent usage, performance, or user-satisfaction metrics before measuring them.

## 11. Open questions

- Which platform should be the first compatibility target?
- Which facecam layouts should the initial detection experiment support?
- Is manual selection acceptable as a fallback when automatic detection fails?
- Should the product primarily support recorded videos, livestreams, or both?
- Is a visible mask acceptable, or is a separate-source creator workflow required for a good experience?
- What detection approach can identify the facecam region without imposing excessive processing costs?
- What exact permission model is necessary for the chosen target pages?
- What measured detection accuracy and performance would justify continuing to a public extension prototype?