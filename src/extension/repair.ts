// ReFrame extension — repair Stage 1 algorithms (classic script: buffer, motion, self-check).
// Ported from the local harness (D-014). MV3 content scripts share one isolated world:
// no imports/exports here — overlay/content read these globals directly.

// ---------- frame buffer ----------

interface ColorFrame {
  w: number;
  h: number;
  data: Uint8ClampedArray; // RGBA, 4 bytes/pixel
  planes?: Float32Array; // cached blurred luma — built once (as cur), reused when it's prev next tick
  seq?: number; // buffer capture order (assigned by push) — coverage entries reference frames by seq
  cumX?: number; // cumulative trusted translation up to this frame (assigned by the repair loop)
  cumY?: number;
}

const REPAIR_MAX_W = 480; // matches the docs' ~480p experiment target
// 10 Hz: 15 Hz + per-tick allocations janked the facecam overlay on the main thread
// (video itself is compositor-rendered and can't lag) — see memory.md 2026-10-13.
const REPAIR_SAMPLE_MS = 100;

interface FrameBuffer {
  push(frame: ColorFrame): void;
  latest(): ColorFrame | null;
  /** Frame `n` steps behind the latest (0 = latest), null while history is short. */
  atBack(n: number): ColorFrame | null;
  /** Frame with the given capture seq, null if evicted. */
  atSeq(seq: number): ColorFrame | null;
  size(): number;
  clear(): void;
}

function createFrameBuffer(capacity: number): FrameBuffer {
  const frames: ColorFrame[] = [];
  let nextSeq = 1;
  return {
    push(frame) {
      frame.seq = nextSeq++;
      frames.push(frame);
      while (frames.length > capacity) frames.shift();
    },
    latest: () => frames[frames.length - 1] ?? null,
    atBack: (n) => frames[frames.length - 1 - n] ?? null,
    atSeq: (seq) => frames.find((f) => f.seq === seq) ?? null,
    size: () => frames.length,
    clear: () => {
      frames.length = 0;
    },
  };
}

/** Draw the video into the scratch canvas and read back a downscaled RGBA frame. */
function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): ColorFrame | null {
  if (video.videoWidth === 0 || video.readyState < 2) return null;
  const scale = Math.min(1, REPAIR_MAX_W / video.videoWidth);
  const w = Math.max(1, Math.round(video.videoWidth * scale));
  const h = Math.max(1, Math.round(video.videoHeight * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  return { w, h, data: img.data };
}

/** Integer luma approximation (77,150,29)/256 — used by motion matching. */
function lumaAt(frame: ColorFrame, x: number, y: number): number {
  const i = (y * frame.w + x) * 4;
  return (frame.data[i] * 77 + frame.data[i + 1] * 150 + frame.data[i + 2] * 29) >> 8;
}

/** Blurred luma, built once per frame and cached on it (GC'd with the buffer frame). */
function blurredLuma(frame: ColorFrame): Float32Array {
  return (frame.planes ??= blurPlane(lumaPlane(frame), frame.w, frame.h));
}

// ---------- motion estimation ----------

interface Motion {
  dx: number;
  dy: number;
  score: number; // best NCC, -1..1
}

interface RectPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MOTION_WIN = 32; // template size
const MOTION_RADIUS = 48; // px at ≤480p — covers typical pan displacement per buffer step
const MOTION_COARSE_STEP = 3;
const MOTION_BLUR_RADIUS = 3;
const SCORE_THRESHOLD = 0.5; // below this the fill must not be trusted (repair-tests.md)

/** Up to 4 windows just outside the rect edges; skips out-of-bounds placements. */
function pickWindows(
  frameW: number,
  frameH: number,
  rect: RectPx,
): Array<{ x: number; y: number }> {
  const gap = 4;
  const candidates = [
    { x: rect.x - MOTION_WIN - gap, y: rect.y + Math.floor(rect.h / 2) - MOTION_WIN / 2 }, // left
    { x: rect.x + rect.w + gap, y: rect.y + Math.floor(rect.h / 2) - MOTION_WIN / 2 }, // right
    { x: rect.x + Math.floor(rect.w / 2) - MOTION_WIN / 2, y: rect.y - MOTION_WIN - gap }, // top
    { x: rect.x + Math.floor(rect.w / 2) - MOTION_WIN / 2, y: rect.y + rect.h + gap }, // bottom
  ];
  return candidates.filter(
    (c) => c.x >= 0 && c.y >= 0 && c.x + MOTION_WIN <= frameW && c.y + MOTION_WIN <= frameH,
  );
}

function lumaPlane(frame: ColorFrame): Float32Array {
  const out = new Float32Array(frame.w * frame.h);
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      out[y * frame.w + x] = lumaAt(frame, x, y);
    }
  }
  return out;
}

/** Separable box blur, radius MOTION_BLUR_RADIUS, edge-clamped.
 * ponytail: tmp is a reused workspace; only the returned plane is retained per frame. */
let blurTmp: Float32Array | null = null;
function blurPlane(src: Float32Array, w: number, h: number): Float32Array {
  const r = MOTION_BLUR_RADIUS;
  const n = r * 2 + 1;
  const need = w * h;
  if (!blurTmp || blurTmp.length < need) blurTmp = new Float32Array(need);
  const tmp = blurTmp;
  const out = new Float32Array(need);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function planeStats(plane: Float32Array, w: number, x0: number, y0: number) {
  let sum = 0;
  let sumSq = 0;
  const vals = new Float64Array(MOTION_WIN * MOTION_WIN);
  let k = 0;
  for (let y = y0; y < y0 + MOTION_WIN; y++) {
    for (let x = x0; x < x0 + MOTION_WIN; x++) {
      const v = plane[y * w + x];
      vals[k++] = v;
      sum += v;
      sumSq += v * v;
    }
  }
  const n = vals.length;
  const mean = sum / n;
  return { vals, mean, varT: sumSq - n * mean * mean };
}

/** Best NCC offset of `cur` window vs `prev` search area; result = source delta (add to cur pos to sample prev). */
function bestOffsetForWindow(
  cur: Float32Array,
  prev: Float32Array,
  fw: number,
  wx: number,
  wy: number,
): Motion | null {
  const t = planeStats(cur, fw, wx, wy);
  if (t.varT <= 1e-6) return null;
  let best: Motion = { dx: 0, dy: 0, score: -1 };
  const fh = prev.length / fw;
  const test = (ox: number, oy: number): void => {
    const sx = wx + ox;
    const sy = wy + oy;
    if (sx < 0 || sy < 0 || sx + MOTION_WIN > fw || sy + MOTION_WIN > fh) return;
    let sum = 0;
    let sumSq = 0;
    let cross = 0;
    const n = t.vals.length;
    for (let y = 0; y < MOTION_WIN; y++) {
      const row = (sy + y) * fw + sx;
      const trow = y * MOTION_WIN;
      for (let x = 0; x < MOTION_WIN; x++) {
        const v = prev[row + x];
        sum += v;
        sumSq += v * v;
        cross += t.vals[trow + x] * v;
      }
    }
    const mean = sum / n;
    const varS = sumSq - n * mean * mean;
    const denom = Math.sqrt(t.varT * varS);
    if (denom <= 1e-6) return;
    const score = (cross - n * t.mean * mean) / denom;
    if (score > best.score) best = { dx: ox, dy: oy, score };
  };
  // coarse pass, then refine around the winner
  for (let oy = -MOTION_RADIUS; oy <= MOTION_RADIUS; oy += MOTION_COARSE_STEP) {
    for (let ox = -MOTION_RADIUS; ox <= MOTION_RADIUS; ox += MOTION_COARSE_STEP) test(ox, oy);
  }
  const cx = best.dx;
  const cy = best.dy;
  for (let oy = cy - MOTION_COARSE_STEP; oy <= cy + MOTION_COARSE_STEP; oy++) {
    for (let ox = cx - MOTION_COARSE_STEP; ox <= cx + MOTION_COARSE_STEP; ox++) test(ox, oy);
  }
  return best;
}

/**
 * Estimate translation between `prev` and `cur`. Windows come from `cur` positions derived
 * from the cam rect; the delta maps a `cur` position to its source in `prev`: `pos + {dx,dy}`.
 * Returns the best match even below SCORE_THRESHOLD — the caller decides trust.
 * ponytail: frames are box-blurred (the coarse grid needs a correlation peak wider than 1 px)
 * and luma is cached on the frame — each is `cur` once, `prev` next tick, one build per tick.
 * Upgrade path: pyramidal search if the grid ever misses.
 */
function estimateMotion(prev: ColorFrame, cur: ColorFrame, rect: RectPx): Motion | null {
  if (prev.w !== cur.w || prev.h !== cur.h) return null;
  const windows = pickWindows(cur.w, cur.h, rect);
  if (windows.length === 0) return null;
  const prevB = blurredLuma(prev);
  const curB = blurredLuma(cur);
  let best: Motion | null = null;
  for (const win of windows) {
    const m = bestOffsetForWindow(curB, prevB, cur.w, win.x, win.y);
    if (m && (!best || m.score > best.score)) best = m;
  }
  return best;
}

/** EMA smoothing so the fill doesn't jitter between updates (flicker control). */
function smoothMotion(prevEma: Motion | null, motion: Motion, alpha = 0.4): Motion {
  if (!prevEma) return motion;
  return {
    dx: alpha * motion.dx + (1 - alpha) * prevEma.dx,
    dy: alpha * motion.dy + (1 - alpha) * prevEma.dy,
    score: motion.score,
  };
}

// ---------- self-check ----------

// dev self-check for the motion estimator (rules: non-trivial logic gets one runnable check).
// Synthetic textured frame, known shift, must recover it.
function repairHashByte(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) & 255;
}

function repairMakeFrame(w: number, h: number, ox = 0, oy = 0): ColorFrame {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = repairHashByte(x + ox, y + oy); // shifted pattern: cur content = prev offset by (ox,oy)
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { w, h, data };
}

function runRepairSelfCheck(): { ok: boolean; detail: string } {
  const w = 160;
  const h = 120;
  const dx0 = 7;
  const dy0 = -3;
  const prev = repairMakeFrame(w, h, 0, 0);
  const cur = repairMakeFrame(w, h, dx0, dy0);
  const rect: RectPx = { x: 60, y: 45, w: 40, h: 30 };
  const m = estimateMotion(prev, cur, rect);
  if (!m) return { ok: false, detail: 'repair self-check: no motion estimated' };
  const errX = Math.abs(m.dx - dx0);
  const errY = Math.abs(m.dy - dy0);
  const ok = errX <= 2 && errY <= 2 && m.score >= 0.5;
  return {
    ok,
    detail: `repair self-check: expected (${dx0},${dy0}) got (${m.dx},${m.dy}) score ${m.score.toFixed(2)} → ${ok ? 'PASS' : 'FAIL'}`,
  };
}
