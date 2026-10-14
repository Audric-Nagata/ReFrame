// ReFrame extension — repair fill of the original facecam rectangle (Stage 1, D-014).
// Classic script. All fills are estimates (prd.md §1); reuse pixels are only sampled from
// OUTSIDE the cam rect, otherwise they'd just be more webcam.

type RepairMode = 'edge' | 'reuse-naive' | 'reuse-motion';

interface FillResult {
  canvas: HTMLCanvasElement;
  coverage: number; // share of rect pixels written from buffered history (motion mode only)
  score: number; // motion match score (0 for non-motion modes)
  ms: number;
}

// ponytail: one output canvas reused per rect size — creating a canvas + ImageData every
// tick was measurable GC churn on YouTube's main thread.
let fillCanvasCache: HTMLCanvasElement | null = null;
let fillCtxCache: CanvasRenderingContext2D | null = null;
let fillImageCache: ImageData | null = null;
let fillCacheW = 0;
let fillCacheH = 0;

function fillEnsure(rect: RectPx): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  out: ImageData;
} {
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  if (!fillCanvasCache || !fillCtxCache || !fillImageCache || fillCacheW !== w || fillCacheH !== h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context for repair fill');
    fillCanvasCache = canvas;
    fillCtxCache = ctx;
    fillImageCache = ctx.createImageData(w, h);
    fillCacheW = w;
    fillCacheH = h;
  }
  return { canvas: fillCanvasCache, ctx: fillCtxCache, out: fillImageCache };
}

/** Naive edge interpolation: linear blend between the colors just OUTSIDE the rect's
 * left/right edges of the CURRENT frame (the rect itself is all webcam). Always writes
 * every pixel — acts as the base layer for the hybrid motion fill. */
function fillEdge(cur: ColorFrame, rect: RectPx, out: ImageData): number {
  const x0 = Math.round(rect.x);
  const y0 = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(cur.h - 1, y0 + y);
    const li = (sy * cur.w + Math.min(cur.w - 1, x0 - 1)) * 4;
    const ri = (sy * cur.w + Math.min(cur.w - 1, x0 + w)) * 4;
    for (let x = 0; x < w; x++) {
      const t = w > 1 ? x / (w - 1) : 0;
      const o = (y * w + x) * 4;
      out.data[o] = cur.data[li] * (1 - t) + cur.data[ri] * t;
      out.data[o + 1] = cur.data[li + 1] * (1 - t) + cur.data[ri + 1] * t;
      out.data[o + 2] = cur.data[li + 2] * (1 - t) + cur.data[ri + 2] * t;
      out.data[o + 3] = 255;
    }
  }
  return 1;
}

/** Temporal reuse write for the naive control. `sourceAt` maps an output pixel to its
 * source position in `prev` (or null → invalid, alpha left at 0). */
function fillReuse(
  prev: ColorFrame | null,
  rect: RectPx,
  out: ImageData,
  sourceAt: (x: number, y: number) => { x: number; y: number } | null,
): number {
  if (!prev) return 0;
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  let valid = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = sourceAt(x, y);
      const o = (y * w + x) * 4;
      if (src && src.x >= 0 && src.y >= 0 && src.x < prev.w && src.y < prev.h) {
        const si = (src.y * prev.w + src.x) * 4;
        out.data[o] = prev.data[si];
        out.data[o + 1] = prev.data[si + 1];
        out.data[o + 2] = prev.data[si + 2];
        out.data[o + 3] = 255;
        valid++;
      } else {
        out.data[o + 3] = 0;
      }
    }
  }
  return w * h > 0 ? valid / (w * h) : 0;
}

/**
 * Produce the fill for the original rect.
 * - `reuse-motion` (hybrid): edge interpolation as base, then coverage history overwrites
 *   every rect pixel whose background is observable somewhere in the buffer; untrusted
 *   motion (`motion` null) clears history → edge only, never stale pixels, never dark.
 * - `reuse-naive`: same rect from a lagged frame, no alignment (control — expected to fail).
 * - `edge`: the non-model baseline on its own (stands in for "basic inpainting" in the matrix).
 */
function computeFill(
  mode: RepairMode,
  cur: ColorFrame,
  prev: ColorFrame | null,
  rect: RectPx,
  motion: Motion | null,
  buffer: FrameBuffer | null,
): FillResult {
  const t0 = performance.now();
  const { canvas, ctx, out } = fillEnsure(rect);
  const rectX0 = Math.round(rect.x);
  const rectY0 = Math.round(rect.y);

  let coverage: number;
  let score = 0;

  if (mode === 'edge') {
    coverage = fillEdge(cur, rect, out);
  } else if (mode === 'reuse-naive') {
    coverage = fillReuse(prev, rect, out, (x, y) => ({ x: rectX0 + x, y: rectY0 + y }));
  } else {
    score = motion ? motion.score : 0;
    fillEdge(cur, rect, out); // base — always something honest to show
    if (motion && buffer) {
      coverage = historyApply(cur, prev, rect, buffer, motion, out.data);
    } else {
      historyClear();
      coverage = 0;
    }
  }

  ctx.putImageData(out, 0, 0);
  return { canvas, coverage, score, ms: performance.now() - t0 };
}
