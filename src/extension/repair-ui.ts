// ReFrame extension — repair UI glue: state, capture loop, bar controls (classic script).
// The loop runs only while enabled + repair on + playing; canvas null (overlay destroyed) → skip.
// ponytail: motion is estimated against the PREVIOUS frame (its blurred luma is already
// cached), and the fill's coverage history chains per-tick steps over the whole buffer —
// there is no fixed reference lag anymore. Untrusted motion clears coverage: the trust
// gate is the stale-content guard (scene cuts, fast motion).

let reframeRepairOn = false;
let reframeRepairMode: RepairMode = 'reuse-motion';
let reframeRepairCanvas: HTMLCanvasElement | null = null;
let reframeRepairStatus = '';

const REPAIR_BUFFER_CAPACITY = 24; // 2.4 s at 10 Hz — Stage 1 uses past frames only
const REPAIR_NAIVE_LAG = 13; // control mode shows a ~1.3 s-old rect (deliberately unaligned)

let reframeRepairTimer = 0;
let reframeRepairSelfChecked = false;
let reframeRepairBuffer: FrameBuffer | null = null;
let reframeRepairEma: Motion | null = null;
let reframeRepairHistoryLogged = false;
let reframeRepairScratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null =
  null;

function reframeRepairStart() {
  if (reframeRepairTimer) return;
  if (!reframeRepairSelfChecked) {
    reframeRepairSelfChecked = true;
    const r = runRepairSelfCheck();
    reframeLogAdd(r.detail);
    const h = runHistorySelfCheck();
    reframeLogAdd(h.detail);
  }
  reframeRepairBuffer = createFrameBuffer(REPAIR_BUFFER_CAPACITY);
  reframeRepairEma = null;
  reframeRepairHistoryLogged = false;
  historyClear();
  reframeRepairTimer = window.setInterval(reframeRepairTick, REPAIR_SAMPLE_MS);
}

function reframeRepairStop() {
  if (reframeRepairTimer) window.clearInterval(reframeRepairTimer);
  reframeRepairTimer = 0;
  reframeRepairBuffer = null;
  reframeRepairEma = null;
  reframeRepairStatus = '';
  historyClear();
  const canvas = reframeRepairCanvas;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function reframeRepairTick() {
  const v = reframeVideo;
  const out = reframeRepairCanvas;
  const crop = reframeCrop;
  const buffer = reframeRepairBuffer;
  if (!reframeEnabled || !reframeRepairOn || !v || !out || !crop || !buffer) return;
  if (v.paused || v.readyState < 2) return;
  if (!reframeRepairScratch) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    reframeRepairScratch = { canvas, ctx };
  }
  const { canvas: scratch, ctx: scratchCtx } = reframeRepairScratch;
  const cur = captureFrame(v, scratch, scratchCtx);
  if (!cur) return;
  buffer.push(cur);

  const prevStep = buffer.atBack(1);
  const rectPx: RectPx = {
    x: crop.x * cur.w,
    y: crop.y * cur.h,
    w: crop.w * cur.w,
    h: crop.h * cur.h,
  };
  const lagRef = reframeRepairMode === 'reuse-naive' ? buffer.atBack(REPAIR_NAIVE_LAG) : null;
  if (reframeRepairMode === 'reuse-naive' && !lagRef) return;

  let motion: Motion | null = null;
  let motionScore = 0;
  if (reframeRepairMode === 'reuse-motion' && prevStep) {
    const m = estimateMotion(prevStep, cur, rectPx); // best match even if below threshold
    motionScore = m ? m.score : 0;
    const trusted = !!m && m.score >= SCORE_THRESHOLD;
    reframeRepairEma = trusted && m ? smoothMotion(reframeRepairEma, m) : null;
    motion = reframeRepairEma;
  }
  // cumulative translation advances only on trusted ticks (frozen otherwise) — the coverage
  // history keys entry positions off this, so an untrusted gap is a no-op, not a drift
  cur.cumX = (prevStep?.cumX ?? 0) + (motion?.dx ?? 0);
  cur.cumY = (prevStep?.cumY ?? 0) + (motion?.dy ?? 0);

  const result = computeFill(
    reframeRepairMode,
    cur,
    reframeRepairMode === 'reuse-motion' ? prevStep : lagRef,
    rectPx,
    reframeRepairMode === 'reuse-motion' ? motion : null,
    buffer,
  );

  out.width = Math.max(1, result.canvas.width);
  out.height = Math.max(1, result.canvas.height);
  const outCtx = out.getContext('2d');
  if (!outCtx) return;
  outCtx.drawImage(result.canvas, 0, 0); // always an estimate — status names its composition

  const ms = result.ms.toFixed(0);
  const cover = (result.coverage * 100).toFixed(0);
  if (reframeRepairMode === 'reuse-motion') {
    reframeRepairStatus =
      result.coverage > 0
        ? `repair: ${cover}% history · ${ms} ms`
        : motion
          ? 'repair: edge only (static)'
          : `repair: edge only (motion ${motionScore.toFixed(2)})`;
  } else {
    reframeRepairStatus = `repair: ${reframeRepairMode === 'edge' ? 'edge' : 'no-align control'} · ${ms} ms`;
  }
  const historyOn = reframeRepairMode === 'reuse-motion' && result.coverage > 0;
  if (historyOn !== reframeRepairHistoryLogged) {
    reframeRepairHistoryLogged = historyOn;
    reframeLogAdd(
      historyOn
        ? `repair: history fill active (cover ${cover}%, score ${motionScore.toFixed(2)})`
        : `repair: history off — ${
            motion
              ? 'no visible source (static or evicted)'
              : `motion untrusted (score ${motionScore.toFixed(2)})`
          }`,
    );
  }
}

function reframeRepairAddControls(bar: HTMLElement) {
  const select = document.createElement('select');
  select.title = 'Repair mode';
  const modes: Array<[RepairMode, string]> = [
    ['edge', 'Basic edge fill'],
    ['reuse-naive', 'Reuse, no align (control)'],
    ['reuse-motion', 'Reuse, motion-aligned'],
  ];
  for (const [value, text] of modes) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    select.append(opt);
  }
  select.value = reframeRepairMode;
  select.disabled = !reframeRepairOn;
  select.addEventListener('change', () => {
    reframeRepairMode = select.value as RepairMode;
    reframeRepairEma = null;
    reframeRepairHistoryLogged = false;
    historyClear();
    reframeLogAdd(`Repair mode: ${reframeRepairMode}.`);
  });
  const label = reframeCheckbox('Repair (experimental)', reframeRepairOn, (on) => {
    reframeRepairOn = on;
    select.disabled = !on;
    if (on) reframeRepairStart();
    else reframeRepairStop();
  });
  bar.append(label, select);
  if (reframeRepairOn) reframeRepairStart();
}
