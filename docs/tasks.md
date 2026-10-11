# Tasks — Current Session

## Current objective

Build a local proof of concept that validates the facecam overlay interaction before committing to a browser extension or creator integration.

## In scope for this session

- [x] Inspect the existing repository and identify its framework/conventions.
- [x] Create a local video stage using a developer-provided test video.
- [x] Add manual rectangular facecam-region selection as the baseline and fallback.
- [x] Render the selected crop in a separate overlay.
- [x] After the manual baseline works, run a small local feasibility experiment with a lightweight pretrained face detector.
- [x] Estimate a candidate facecam region from detected faces and allow manual correction.
- [ ] Test clips with no facecam, moving faces, scene changes, and in-game faces; record false detections and misses.
- [ ] Measure detection responsiveness and resource use before considering continuous tracking.
- [x] Support dragging the overlay within the video stage.
- [x] Support resizing with minimum and maximum bounds.
- [x] Add hide/show and reset controls.
- [x] Add an optional mask for the original facecam region.
- [x] Display an explicit warning that masking cannot restore obscured gameplay.
- [x] Verify behavior when the stage is resized.
- [x] Run the available checks and record actual results in `memory.md`.

> Note: checked items are implemented and pass `tsc`/`oxlint`/`vite build`. The two unchecked detection-test items require developer browser runs (OBS clip plus no-facecam/in-game-face/movement scenarios) with results pasted from the in-app **Copy log** into `memory.md` — detection accuracy cannot be verified headlessly.

## Explicitly not part of this session

- [ ] Do not build a backend or database.
- [ ] Do not add accounts, analytics, or cloud persistence.
- [ ] Do not train a custom model or add AI segmentation, inpainting, or generative reconstruction.
- [ ] Do not make automatic detection a prerequisite for validating the overlay interaction.
- [ ] Do not claim compatibility with YouTube or Twitch.
- [ ] Do not build an OBS plugin yet.
- [ ] Do not build streaming or transcoding infrastructure.

## Definition of done

- The local prototype runs using the repository's documented command.
- The core interactions work with a supplied test video.
- Unsupported conditions and the masking limitation are communicated clearly.
- Relevant tests/type checks/lint are run if available.
- `memory.md` records what actually works, what was tested, and remaining issues.

## Next session (not current scope)

Run a time-boxed feasibility investigation for a Chrome/Chromium extension on one selected target platform. Verify video access and document the result before implementing platform-specific support. Compare browser-page detection feasibility with the local prototype results.

