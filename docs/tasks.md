# Tasks — Current Session

## Current objective

Time-boxed Chrome extension feasibility spike for YouTube (`youtube.com/watch` only), building on the verified local prototype and the developer's preliminary page-access findings.

## In scope for this session

- [x] Sync docs to reflect decisions (YouTube-only target, segmentation approval, canvas renderer).
- [x] Fix the local harness overlay clipping bug (`overflow: hidden`) and keep the page as a dev harness.
- [x] Scaffold an MV3 extension: manifest, content script, offscreen document, popup (plain TS, no bundler; vendor MediaPipe files locally — no remote code).
- [ ] Re-verify decoded-pixel access to YouTube's `<video>` from the extension context; record the result.
- [x] Canvas-crop overlay renderer (`requestVideoFrameCallback` + `drawImage`) in a shadow DOM: drag, resize, hide/show, reset.
- [x] Sampled-frame face detection in the offscreen document (face → padded candidate region); manual correction via crop inputs.
- [x] Person-segmentation experiment toggle (approved scope change), sampled frames only.
- [x] Mask over the original region with the limitation warning.
- [x] Unsupported states explained, never silent: Shorts, no video element, ads interruption.
- [ ] Run the test matrix: watch page, fullscreen, theater, pause/seek, live, ads, shorts, no-facecam segments, in-game faces, detection ms + CPU.
- [x] Run `tsc`/`oxlint`/`vite build` and record actual results in `memory.md`.

## Explicitly not part of this session

- [ ] Do not support Shorts, embeds, or pages other than `youtube.com/watch`.
- [ ] Do not build a backend, accounts, analytics, or cloud sync.
- [ ] Do not train a custom model or add inpainting or generative reconstruction.
- [ ] Do not publish or prepare Chrome Web Store listing (bundling discipline only).
- [ ] Do not claim YouTube compatibility beyond the cases actually tested.
- [ ] Do not build streaming or transcoding infrastructure.

## Definition of done

- Extension loads unpacked; popup activation enables it on `youtube.com/watch`.
- Detection proposes a facecam region on a real YouTube video; overlay renders a live draggable crop; mask works.
- Failure cases and pixel-access verification are recorded honestly in `memory.md`.
- Relevant checks (`tsc`, lint, build) run and recorded.

## Next session (not current scope)

Evaluate spike results against architecture.md §10 decision gates: continue with the extension (broaden tests), limit it (document unsupported cases), or stop. Compare detection results with the local harness baseline.
