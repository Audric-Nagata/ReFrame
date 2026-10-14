# ReFrame: Background Repair — Development Notes

> Formerly "Facecam Freedom". The project name is **ReFrame** (`prd.md`). This document is the approved project direction as of 2026-10-12 (decision D-014 in `memory.md`).

## Project goal

ReFrame (formerly Facecam Freedom) is a viewer-side browser extension that lets people reposition, resize, or hide a streamer facecam in existing YouTube videos and live streams, ideally without requiring creators to change their setup — and, as of the 2026-10-12 direction change, fill the original facecam region with an estimate of what it covers.

The current prototype targets YouTube in Chrome.

## Core technical constraint

Most OBS-style streams combine gameplay, webcam, and overlays into one encoded video. The YouTube player generally does not expose the original independent layers.

When the facecam is composited into the video, the pixels behind it are not available in that frame. Segmentation can extract the streamer, but it cannot recover the hidden gameplay by itself. The extension must estimate or reconstruct the covered region.

Perfect reconstruction is not always possible. Neighboring frames may help, but if the hidden content never appears elsewhere, any fill is an approximation.

## Work completed / observed

- Inspected YouTube's page using DevTools and identified the likely active video element.
- Confirmed the main video element was playing at 2560 × 1440.
- Successfully read decoded video pixels through a canvas and `getImageData()` in the DevTools page context.
- Repeated canvas readbacks for five seconds: 25 reads, zero read errors, with video playback time advancing.
- Tried loading MediaPipe directly into the YouTube page. Chrome's Trusted Types policy blocked assigning a remote URL to `script.src`.
- Moved experimentation to a standalone local HTML segmentation lab instead of trying to bypass YouTube's security restrictions. (Superseded — the experiment now lives in ReFrame code.)
- The segmentation prototype now works intermittently, but streamer/face detection is unreliable. Model selection and segmentation quality remain open tasks.
- **2026-10-12 update:** the MV3 extension spike works end-to-end on `youtube.com/watch`: offscreen MediaPipe detection + person segmentation, canvas crop overlay with drag, mask, and a "Mark facecam" rectangle draw tool. Detection is usable in practice (accuracy tests still open).
- **2026-10-12 update:** decoded-pixel access was re-verified **from the extension context** — sampled frames reach the offscreen detector roughly every 700 ms with working detection. This retires the DevTools-only caveat below.
- **2026-10-12 update:** running MediaPipe in an extension offscreen document additionally required `'wasm-unsafe-eval'` in the extension's CSP (the MV3-legal token for WebAssembly).

### Important status distinction

Canvas readback was verified in DevTools page context. This does **not** yet prove the same technique will work from the actual Chrome extension. The standalone segmentation lab has worked intermittently, but stable detection and performance have not been established.

**Superseded 2026-10-12:** both points are now resolved — pixel access is verified from the extension context (working detection on real watch pages), and the segmentation experiment lives in the extension's offscreen document with usable detection results. Accuracy and full test-matrix coverage remain open.

## Proposed architecture

1. **Capture video frames**
   - Read frames from the YouTube player using an extension-compatible approach.
   - Verify frame access inside the real extension, not only in DevTools.
2. **Detect and segment the streamer**
   - Produce a foreground mask and transparent streamer cutout.
   - Initially, use a manually selected facecam region if automatic detection is unreliable.
3. **Repair the original facecam area**
   - Cover the complete original facecam rectangle, including borders and shadows.
   - Estimate the missing background using neighboring frames and/or inpainting.
4. **Composite the result**
   - Render the repaired background at the original facecam location.
   - Render the extracted streamer as a separate movable/resizable overlay.
5. **Handle device capability**
   - Prefer browser-side inference so the viewer's device performs the work.
   - Detect WebGPU availability and provide a fallback where feasible.
   - Avoid assuming that all devices or drivers support WebGPU equally well.

## Background-repair plan

### Stage 1: Temporal frame reuse

Start by testing whether pixels from earlier or later frames can fill the facecam rectangle.

- For prerecorded videos, both past and future frames may be available if we buffer them.
- For live streams, only past frames are available, making reconstruction more difficult.
- Motion estimation or optical flow may help align neighboring frames.
- Fast motion, scene cuts, overlays, and newly appearing content can make frame reuse fail.

This is the first approach to prototype because it avoids immediately introducing a large generative model.

### Stage 2: Lightweight image inpainting

Test a frame-based inpainting model if temporal reuse leaves gaps.

- **LaMa** is a candidate for offline evaluation because it is designed for large-mask image inpainting.
- Browser compatibility is not guaranteed just because a model can run in Python. We must verify model conversion, operator support, memory use, and actual WebGPU performance.
- Frame-by-frame inpainting may produce temporal flicker because each frame is processed independently.

### Stage 3: Video-inpainting quality benchmark

Use **ProPainter** as an offline quality benchmark, not the initial browser implementation.

- It uses information across multiple frames and can provide a reference for reconstruction quality.
- It is substantially more demanding than a lightweight browser pipeline.
- Check the current repository/model license before any commercial use. The project's stated non-commercial terms may be incompatible with a commercial product without separate permission.

## Browser inference direction

Candidate stack:

- **ONNX Runtime Web** for supported browser-side model inference.
- **WebGPU** as an acceleration backend where available.
- Canvas or another suitable browser rendering path for compositing.
- Keep models and scripts packaged locally with the extension where practical. Do not inject remote scripts into YouTube or attempt to bypass Trusted Types.

WebGPU does not automatically make a model lightweight. The chosen model and resolution must be benchmarked on lower-spec devices. CPU fallback may be too slow for some workloads, so degraded modes may be necessary.

## Initial performance target

Treat this as an experiment target, not a guaranteed product specification:

- Try repairing at approximately **480p** first.
- Aim to sustain **15–30 repair updates per second** on supported entry-level GPUs.
- Allow the original video to continue at its normal frame rate while the repair updates less frequently, if visual quality remains acceptable.
- Measure latency, GPU/CPU utilization, memory use, dropped frames, and visual flicker.
- Test on actual lower-spec hardware before making performance claims.

## Next steps

1. ~~Stabilize the current segmentation prototype enough to test consistently.~~ **Done (2026-10-12):** working end-to-end in the extension.
2. ~~Add manual facecam rectangle selection so repair experiments do not depend on automatic face detection.~~ **Done (2026-10-12):** "Mark facecam" draw tool.
3. Build a small test harness that processes consecutive frames from a short video.
4. Compare:
   - the original video,
   - basic inpainting,
   - temporal frame reuse,
   - temporal reuse plus inpainting.
5. Evaluate quality across moving gameplay, camera motion, scene cuts, and overlays.
6. Benchmark the chosen approach using ONNX Runtime Web and WebGPU on lower-spec hardware.
7. Verify video frame access and rendering from the actual Chrome extension.
8. Integrate the best-performing approach only after the standalone tests are repeatable.

## Known risks and open questions

- **Irrecoverable information:** hidden pixels may not exist in any nearby frame; AI-generated fills are estimates.
- **Temporal artifacts:** reused pixels may be misaligned; image-only inpainting may flicker.
- **Segmentation quality:** the current prototype detects the streamer inconsistently. *(Improved 2026-10-12 — detection is usable in the extension; formal accuracy tests still pending.)*
- **Extension access:** successful DevTools canvas reads do not guarantee equivalent extension access. *(Resolved 2026-10-12 — verified from the extension context.)*
- **Performance:** segmentation, frame capture, motion estimation, repair, and rendering compete for resources.
- **Compatibility:** WebGPU and model operator support vary across browsers, operating systems, and drivers.
- **Live streams:** lack of future frames limits reconstruction options.
- **Licensing:** verify model, weights, runtime, and dependency licenses before distribution or commercial use.

## Decision for now

Build a repeatable offline/browser prototype around **manual facecam masking + temporal frame reuse**, then test **LaMa** as a candidate fallback. Keep **ProPainter** as a quality reference rather than committing to it for the extension MVP.
