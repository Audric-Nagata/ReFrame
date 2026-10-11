// ponytail: one Rect type; units documented per usage —
// sourceRect is normalized to the video (0-1), overlayRect to the stage (0-1).
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MIN_SIZE_PX = 48;
export const MAX_SIZE_RATIO = 0.5;

// ponytail: defaults guess a typical OBS layout (facecam bottom-left, overlay parked
// top-right) so the layers are visibly distinct on first load; the real crop is dialed
// in per video via the inputs or detection.
export const DEFAULT_SOURCE_RECT: Rect = { x: 0.03, y: 0.7, w: 0.22, h: 0.28 };
export const DEFAULT_OVERLAY_RECT: Rect = { x: 0.74, y: 0.05, w: 0.22, h: 0.28 };

export function clampSizePx(
  wPx: number,
  hPx: number,
  stageW: number,
  stageH: number,
): { wPx: number; hPx: number } {
  const w = Math.min(Math.max(wPx, Math.min(MIN_SIZE_PX, stageW)), stageW * MAX_SIZE_RATIO);
  const h = Math.min(Math.max(hPx, Math.min(MIN_SIZE_PX, stageH)), stageH * MAX_SIZE_RATIO);
  return { wPx: w, hPx: h };
}

export function clampPosition(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 0), Math.max(0, 1 - w)),
    y: Math.min(Math.max(y, 0), Math.max(0, 1 - h)),
  };
}
