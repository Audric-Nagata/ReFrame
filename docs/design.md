# Design System

## 1. Design intent

The product should feel like a lightweight utility that enhances the video without competing with it. The video remains the primary focus; controls should be discoverable when needed and unobtrusive otherwise.

## 2. Experience principles

- **Video first:** Minimize chrome around the viewing area.
- **Direct manipulation:** The facecam should feel draggable and resizable.
- **Clear status:** Make it obvious when the tool is active, unsupported, or masking the original facecam.
- **Reversible actions:** Provide hide/show and reset controls.
- **No false promises:** Use language such as “crop”, “overlay”, and “cover original region” rather than “separate the facecam” when the source is a single composited video.

## 3. Visual direction

Use a dark, neutral interface suited to gaming video. Keep the palette restrained so the controls do not pull attention away from the video.

### Color tokens

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#111318` | Main background |
| `--color-surface` | `#1B1E25` | Panels and control surfaces |
| `--color-surface-raised` | `#252A33` | Popovers and elevated controls |
| `--color-text` | `#F4F5F7` | Primary text |
| `--color-text-muted` | `#A6ACB8` | Supporting text |
| `--color-border` | `#373D49` | Dividers and outlines |
| `--color-accent` | `#7C8CFF` | Primary actions and active state |
| `--color-danger` | `#F87171` | Errors and destructive actions |
| `--color-warning` | `#FBBF24` | Limitations and caution states |
| `--color-success` | `#34D399` | Confirmed active/healthy state |

Use contrast that remains readable on top of both dark and bright video frames. Do not rely on color alone to communicate state.

## 4. Typography

- Preferred system stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Use a compact hierarchy: page title, section label, control label, helper text.
- Body text should be readable at typical desktop sizes.
- Use tabular numerals for dimensions or numeric values where helpful.
- Avoid decorative display fonts.

## 5. Spacing and shape

Use a 4 px base spacing unit:
- `4px`: icon/text micro-gap.
- `8px`: compact control spacing.
- `12px`: grouped controls.
- `16px`: standard panel padding.
- `24px`: section spacing.
- `32px`: major separation.

Suggested radii:
- Small controls: `6px`.
- Panels: `10px`.
- Modal/popover: `12px`.

Borders should be subtle. Avoid excessive shadows, gradients, glass effects, and oversized rounded cards.

## 6. Components

### Video stage
- Preserve the video's aspect ratio.
- Keep the stage responsive.
- Position overlays relative to the stage, not the entire browser window.
- Prevent control UI from changing the video geometry unexpectedly.

### Facecam overlay
- Show a clear but subtle outline while selected or being dragged.
- Provide a visible drag affordance without permanently covering the facecam.
- Keep the overlay within stage bounds by default.
- Enforce a minimum usable size and a maximum size that does not consume the entire stage.
- Distinguish the overlay from the original facecam region during testing.

### Controls
- Use concise labels: `Show facecam`, `Hide facecam`, `Reset layout`, `Smaller`, `Larger`.
- Prefer icon-plus-label for unfamiliar actions.
- Provide tooltips for icon-only controls.
- Ensure buttons have visible hover, focus, active, and disabled states.

### Limitation notice
When masking the original facecam, display a clear notice such as:
> The original facecam is covered, but gameplay behind it cannot be restored.

Do not repeatedly interrupt the viewer after they have acknowledged the notice, but keep the limitation accessible.

## 7. Interaction rules

- Drag with pointer events and support mouse input first.
- Do not make dragging the only way to move the overlay; provide reset and keyboard-accessible alternatives.
- Preserve aspect ratio when resizing unless free aspect-ratio changes are deliberately implemented.
- Use predictable pointer capture and clean up listeners after interaction.
- Do not hijack the video's play/pause, seek, volume, or fullscreen controls.
- Keep keyboard focus visible.
- Respect reduced-motion preferences; avoid unnecessary animations.

## 8. Responsive behavior

The initial target is desktop Chromium browsers. The layout should still adapt to a smaller viewport:
- Keep controls within the visible window.
- Avoid overlays obscuring all video controls.
- Ensure minimum hit targets are practical.
- Do not promise mobile-browser extension support in the MVP.

## 9. Accessibility baseline

- Use semantic buttons and labels.
- Support keyboard access to visibility, reset, and size controls.
- Maintain readable contrast.
- Do not use color as the sole status indicator.
- Announce important unsupported/error states to assistive technology.
