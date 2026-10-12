# Agent Rules and Coding Guardrails

These rules apply to AI coding agents and human contributors.

## 1. Product guardrails

- Treat `prd.md` as the product source of truth.
- Treat `architecture.md` as the current technical direction.
- Do not silently expand the MVP.
- Do not add features merely because they are easy to generate.
- If a requirement conflicts with these documents, explain the conflict and ask before making a major scope change.
- Do not claim universal YouTube, Twitch, or browser compatibility without testing.
- Automatic facecam detection is an approved feasibility experiment, not a guarantee of reliable detection on all videos.
- Keep manual facecam-region selection available as a baseline and fallback unless the product owner explicitly changes the scope.

## 2. Scope limits

Until explicitly approved, do not add:
- Backend services, databases, accounts, authentication, cloud sync, or analytics.
- Custom AI model training, inpainting, or generative reconstruction.
- Streaming infrastructure, transcoding, recording, or content redistribution.
- Payment systems, social features, chat, or creator dashboards.
- Undocumented/private platform APIs or DRM bypasses.

A lightweight, pretrained face-detection approach may be evaluated for the approved local-prototype experiment. Do not add a detection library or model until its need, browser compatibility, bundle/runtime cost, and license have been reviewed. Prefer a small experiment over a broad computer-vision subsystem.

**Approved scope change (2026-10-11):** pretrained *person segmentation* (streamer cutout) is approved as a sampled-frame experiment for the local prototype and the extension spike. It must not run on every frame by default, must be measurable, and must remain optional. Generative reconstruction of obscured gameplay remains banned.

Prefer the smallest change that validates the current task.

## 3. Engineering standards

- Use TypeScript for application code.
- Use clear, descriptive names and small, cohesive components.
- Prefer simple functions and explicit state over unnecessary abstractions.
- Keep rendering logic separate from pointer/drag state logic where practical.
- Validate geometry and clamp dimensions to safe, documented bounds.
- Handle missing video elements, unsupported pages, and failed initialization gracefully.
- Never silently swallow errors; show a useful user-facing state and log relevant development details.
- Do not add a dependency when browser or framework primitives are sufficient.
- Pin or constrain dependency versions through the package manager and commit the lockfile.
- Keep detection logic separate from crop rendering and overlay interaction so each can be tested independently.
- Treat face detection and facecam-boundary estimation as different problems; do not assume a detected face rectangle is the full facecam rectangle.
- If automatic detection is uncertain, unavailable, or wrong, preserve manual selection/correction rather than silently applying a questionable crop.
- Avoid running inference on every video frame by default; sample frames or use tracking only when the approach has been validated.

## 4. File and function size

These are review guidelines, not reasons to create awkward abstractions:
- Aim for source files under 250 lines.
- Aim for functions under 50 lines.
- If a file exceeds 300 lines, consider splitting it by responsibility.
- Keep components focused on one primary responsibility.
- Avoid giant configuration objects and monolithic components.

## 5. Naming and formatting

- Use `PascalCase` for React components and types.
- Use `camelCase` for variables and functions.
- Use `UPPER_SNAKE_CASE` only for genuine constants.
- Use descriptive file names such as `FacecamOverlay.tsx`.
- Use the repository's formatter and linter if configured.
- Avoid abbreviations unless they are widely understood in context.

## 6. Browser and platform safety

- Request only permissions necessary for the current feature.
- Do not collect browsing history, credentials, personal data, or video content for analytics.
- Do not upload video frames or page contents to a server.
- Do not bypass DRM, paywalls, access controls, or platform restrictions.
- Prefer documented browser and platform APIs.
- Treat page content and video metadata as untrusted input.
- Do not claim a crop is a true independent source when it is only a crop from a composited video.
- Do not claim that a mask reconstructs the gameplay behind the facecam.
- Do not assume video frames are readable from every page or player; verify access experimentally.
- Keep any approved face-detection experiment local to the user's device unless the product owner explicitly approves a documented alternative.

## 7. Testing requirements

For any change to overlay behavior, test:
- Dragging within the stage.
- Resizing to minimum and maximum sizes.
- Hiding and restoring the overlay.
- Resetting the layout.
- Resizing the video stage.
- Unsupported or missing video input.
- Keyboard operation for primary controls.

For detection-related changes, also test:
- A facecam with a clear, visible face.
- A facecam where the person moves or leaves the frame.
- A video with no facecam.
- Gameplay containing faces or character portraits that could cause false detections.
- Detection of a face versus estimation of the full facecam boundary.
- Manual correction after a missed or incorrect detection.
- Resource use and playback responsiveness on the test machine.

Add tests when a test framework exists. Do not introduce a large testing stack without approval. Do not claim accuracy or performance thresholds until they have been measured on a documented test set.

## 8. Change workflow

Before coding:
1. Read `prd.md`, `architecture.md`, `design.md`, and the current `tasks.md`.
2. Inspect the existing repository and reuse its conventions.
3. State the smallest implementation plan for the current task.
4. For detection work, define the test clips and the behavior being evaluated before choosing or integrating a model.

After coding:
1. Run available tests, lint, and type checks.
2. Report what changed and the exact checks run.
3. Record important decisions, limitations, and follow-up items in `memory.md`.
4. Update `tasks.md` only to reflect real progress.
5. Do not mark a task complete unless it has been implemented and checked.

## 9. Honesty

- Never fabricate test results, compatibility, benchmarks, or user feedback.
- Clearly distinguish implemented behavior from proposed behavior.
- State when a requirement could not be verified.
- If the architecture cannot support a requested feature, explain why before building a workaround.
- Describe automatic results as a likely facecam region unless the full boundary has actually been verified.
- Never present face detection as proof that the detected person is the streamer.
