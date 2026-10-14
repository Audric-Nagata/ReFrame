// ReFrame extension — repair coverage history: whole-buffer multi-reference fill (Stage 1).
// Classic script. Per rect pixel: the frame seq + cumulative translation at which this
// pixel's background was last observable. At apply time the source position is
//   src = pixelPos + (cumNow - cumAnchor)
// sampled from the anchor frame — under the translation model that is exactly the content
// sitting at the rect pixel *now*. Entries are (re)observed from the previous frame each
// tick while a fresh source is visible, otherwise scanned newest→oldest across the buffer,
// so coverage grows with motion instead of being capped at one lag frame's displacement.
//
// Trust gate (repair-ui): untrusted motion clears all entries — that, plus source geometry
// (must sit outside the rect and inside the anchor frame), is the stale-content guard.
// ponytail: no per-entry luma verification — it is unverifiable by construction (content
// under the rect changes over time); geometry + clear-on-untrusted covers cuts.
// Ceiling: after motion stops, entries live ~2.4 s (anchor frame eviction) then degrade
// to edge. Upgrade path: one retained deep-anchor frame if repair-tests shows the fade.

let histRx = -1;
let histRy = -1;
let histRw = 0;
let histRh = 0;
let histSeq: Int32Array | null = null;
let histCumX: Float32Array | null = null;
let histCumY: Float32Array | null = null;

function historyClear(): void {
  histSeq = null;
  histCumX = null;
  histCumY = null;
  histRx = -1;
  histRy = -1;
  histRw = 0;
  histRh = 0;
}

/** Realloc on rect resize/move (entries are rect-indexed, so any change invalidates them). */
function historyEnsure(rx: number, ry: number, rw: number, rh: number): void {
  if (histSeq && rx === histRx && ry === histRy && rw === histRw && rh === histRh) return;
  historyClear();
  histSeq = new Int32Array(rw * rh).fill(-1);
  histCumX = new Float32Array(rw * rh);
  histCumY = new Float32Array(rw * rh);
  histRx = rx;
  histRy = ry;
  histRw = rw;
  histRh = rh;
}

/** Source is usable when inside the anchor frame but OUTSIDE the cam rect. */
function historySrcOk(
  f: ColorFrame,
  sx: number,
  sy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  if (sx < 0 || sy < 0 || sx >= f.w || sy >= f.h) return false;
  return sx < rx || sx >= rx + rw || sy < ry || sy >= ry + rh;
}

/**
 * Observe + apply in one pass; writes history pixels into `out` (rect-sized RGBA) and
 * returns the written share. Callers gate on trusted motion — null clears via computeFill.
 */
function historyApply(
  cur: ColorFrame,
  prev: ColorFrame | null,
  rect: RectPx,
  buffer: FrameBuffer,
  motion: Motion,
  out: Uint8ClampedArray,
): number {
  const rx = Math.round(rect.x);
  const ry = Math.round(rect.y);
  const rw = Math.max(1, Math.round(rect.w));
  const rh = Math.max(1, Math.round(rect.h));
  historyEnsure(rx, ry, rw, rh);
  const seq = histSeq;
  const cumX = histCumX;
  const cumY = histCumY;
  if (!seq || !cumX || !cumY) return 0;
  const curCumX = cur.cumX ?? 0;
  const curCumY = cur.cumY ?? 0;
  let written = 0;

  const write = (f: ColorFrame, sx: number, sy: number, o: number): void => {
    const si = (sy * f.w + sx) * 4;
    out[o] = f.data[si];
    out[o + 1] = f.data[si + 1];
    out[o + 2] = f.data[si + 2];
    out[o + 3] = 255;
    written++;
  };

  for (let y = 0; y < rh; y++) {
    const py = ry + y;
    for (let x = 0; x < rw; x++) {
      const px = rx + x;
      const i = y * rw + x;
      const o = i * 4;

      // a) existing entry: sample its anchor frame at the cum-adjusted position
      if (seq[i] >= 0) {
        const f = buffer.atSeq(seq[i]);
        if (f) {
          const sx = Math.round(px + curCumX - cumX[i]);
          const sy = Math.round(py + curCumY - cumY[i]);
          if (historySrcOk(f, sx, sy, rx, ry, rw, rh)) {
            write(f, sx, sy, o);
            continue;
          }
        }
        seq[i] = -1; // anchor evicted or position left the frame — rescan below
      }

      // b) fresh observation from the previous frame: instant fill after a reveal
      if (prev) {
        const sx = Math.round(px + motion.dx);
        const sy = Math.round(py + motion.dy);
        if (historySrcOk(prev, sx, sy, rx, ry, rw, rh)) {
          write(prev, sx, sy, o);
          seq[i] = prev.seq ?? -1;
          cumX[i] = prev.cumX ?? 0;
          cumY[i] = prev.cumY ?? 0;
          continue;
        }
      }

      // c) scan the buffer newest→oldest for any frame that shows this pixel's content
      for (let n = 0; n < buffer.size(); n++) {
        const f = buffer.atBack(n);
        if (!f) continue;
        const sx = Math.round(px + curCumX - (f.cumX ?? 0));
        const sy = Math.round(py + curCumY - (f.cumY ?? 0));
        if (historySrcOk(f, sx, sy, rx, ry, rw, rh)) {
          write(f, sx, sy, o);
          seq[i] = f.seq ?? -1;
          cumX[i] = f.cumX ?? 0;
          cumY[i] = f.cumY ?? 0;
          break;
        }
      }
    }
  }
  return written / (rw * rh);
}

// ---------- history self-check ----------

/** One runnable check for the coverage history (rules §7): a synthetic +2 px/tick pan must
 * grow coverage across the buffer, and every written pixel must equal the true background
 * value for the current tick (catches cum/anchor sign errors, the silent failure mode). */
function runHistorySelfCheck(): { ok: boolean; detail: string } {
  const w = 160;
  const h = 120;
  const rect: RectPx = { x: 60, y: 45, w: 40, h: 30 };
  const buffer = createFrameBuffer(24);
  const out = new Uint8ClampedArray(rect.w * rect.h * 4); // alpha 0 = not written
  historyClear();
  let prev = repairMakeFrame(w, h, 0, 0);
  buffer.push(prev);
  prev.cumX = 0;
  prev.cumY = 0;
  let firstCoverage = 0;
  let lastCoverage = 0;
  for (let tick = 1; tick <= 10; tick++) {
    const cur = repairMakeFrame(w, h, 2 * tick, 0);
    buffer.push(cur);
    const m = estimateMotion(prev, cur, rect);
    if (!m || m.score < SCORE_THRESHOLD) {
      return {
        ok: false,
        detail: `repair history self-check: tick ${tick} untrusted (${m ? m.score.toFixed(2) : 'null'})`,
      };
    }
    cur.cumX = (prev.cumX ?? 0) + m.dx;
    cur.cumY = (prev.cumY ?? 0) + m.dy;
    lastCoverage = historyApply(cur, prev, rect, buffer, m, out);
    if (tick === 1) firstCoverage = lastCoverage;
    prev = cur;
  }
  // after 10 ticks of +2, background at rect pixel p = pattern offset 20
  let written = 0;
  let wrong = 0;
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const o = (y * rect.w + x) * 4;
      if (out[o + 3] !== 255) continue;
      written++;
      if (out[o] !== repairHashByte(rect.x + x + 20, rect.y + y)) wrong++;
    }
  }
  const ok = firstCoverage > 0 && lastCoverage >= 0.3 && written > 0 && wrong === 0;
  return {
    ok,
    detail: `repair history self-check: coverage ${(firstCoverage * 100).toFixed(0)}%→${(lastCoverage * 100).toFixed(0)}%, ${wrong} wrong/${written} px → ${ok ? 'PASS' : 'FAIL'}`,
  };
}
