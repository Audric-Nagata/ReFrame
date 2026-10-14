// ReFrame extension — overlay UI + crop renderer (classic script; globals from content.js).
// ponytail: canvas crop blit via rVFC replaces the local harness's duplicate-<video> trick
// (D-013) — YouTube's MSE blob source cannot be cloned into a second element.

let reframeRoot: HTMLDivElement | null = null;
let reframeCropBox: HTMLDivElement | null = null;
let reframeCropCanvas: HTMLCanvasElement | null = null;
let reframeMaskRect: HTMLDivElement | null = null;
let reframeStatusLine: HTMLSpanElement | null = null;
let reframeRvfc = 0;
let reframeCropVisible = true;
let reframeTempCanvas: HTMLCanvasElement | null = null;
let reframeHostEl: Element | null = null;
// ponytail: root is position:absolute inside its host — page coords only apply when the
// host is static (containing block = document); a positioned host needs host-relative coords.
let reframeHostRelative = false;

function reframeRehost() {
  if (!reframeRoot) return;
  const host = (document.fullscreenElement ?? document.querySelector('#movie_player') ?? document.body) as Element;
  reframeRoot.remove();
  host.appendChild(reframeRoot);
  reframeHostEl = host;
  reframeHostRelative = getComputedStyle(host).position !== 'static';
}

function reframeCreateOverlayUi() {
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:2147483646;';
  const shadow = root.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .box { position:absolute; outline:2px solid #7C8CFF; outline-offset:-2px; pointer-events:auto; cursor:grab; touch-action:none; }
    .box:active { cursor:grabbing; }
    canvas { display:block; width:100%; height:100%; }
    .band { position:absolute; outline:2px dashed #7C8CFF; outline-offset:-2px; pointer-events:none; }
    .mask { position:absolute; background:#000; opacity:.85; pointer-events:none; }
    .bar { position:absolute; left:8px; top:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap; max-width:calc(100% - 16px); pointer-events:auto; font:12px/1.3 system-ui,sans-serif; color:#F4F5F7; }
    .bar button, .bar label { font:12px/1.3 system-ui,sans-serif; color:#F4F5F7; background:#1B1E25; border:1px solid #373D49; border-radius:6px; padding:4px 8px; cursor:pointer; }
    .bar select { font:12px/1.3 system-ui,sans-serif; color:#F4F5F7; background:#1B1E25; border:1px solid #373D49; border-radius:6px; padding:4px 8px; cursor:pointer; }
    .bar button:hover, .bar label:hover { border-color:#7C8CFF; }
    .bar button:focus-visible { outline:2px solid #7C8CFF; }
    .bar label { display:inline-flex; gap:4px; align-items:center; }
    .status { color:#A6ACB8; background:#1B1E25CC; border-radius:6px; padding:4px 8px; }
    .status-detected { color:#34D399; }
    .status-error { color:#F87171; }
    .status-uncertain, .status-detecting { color:#FBBF24; }
  `;

  const bar = document.createElement('div');
  bar.className = 'bar';

  const hideBtn = document.createElement('button');
  hideBtn.textContent = 'Hide facecam';
  hideBtn.addEventListener('click', () => {
    reframeCropVisible = !reframeCropVisible;
    if (reframeCropBox) reframeCropBox.style.display = reframeCropVisible ? '' : 'none';
    hideBtn.textContent = reframeCropVisible ? 'Hide facecam' : 'Show facecam';
  });
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => {
    reframeUserAdjusted = false;
    reframeDetectNow();
  });

  const detectBtn = document.createElement('button');
  detectBtn.textContent = 'Detect now';
  detectBtn.addEventListener('click', () => reframeDetectNow());

  const maskLabel = reframeCheckbox('Cover original', reframeMaskOn, (on) => {
    reframeMaskOn = on;
  });
  const segLabel = reframeCheckbox('Segment person', reframeSegmentOn, (on) => {
    reframeSegmentOn = on;
    if (on) void reframeSendFrame('segment');
  });

  // Paint-style rectangle tool: draw a full-size box by dragging; replaces corner resize.
  const surface = document.createElement('div');
  surface.style.cssText = 'position:absolute;inset:0;cursor:crosshair;display:none;pointer-events:auto;';
  const band = document.createElement('div');
  band.className = 'band';
  band.style.display = 'none';
  surface.append(band);
  let d0: { x: number; y: number } | null = null;
  const bandTo = (p: { x: number; y: number }) => {
    band.style.left = `${Math.min(d0!.x, p.x)}px`;
    band.style.top = `${Math.min(d0!.y, p.y)}px`;
    band.style.width = `${Math.abs(p.x - d0!.x)}px`;
    band.style.height = `${Math.abs(p.y - d0!.y)}px`;
  };
  surface.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    surface.setPointerCapture(e.pointerId);
    d0 = reframeLocalPoint(e);
    band.style.display = '';
    bandTo(d0);
  });
  surface.addEventListener('pointermove', (e) => {
    if (d0) bandTo(reframeLocalPoint(e));
  });
  const finishDraw = (e: PointerEvent) => {
    if (!d0) return;
    e.stopPropagation();
    const a = d0;
    d0 = null;
    surface.style.display = 'none';
    drawBtn.textContent = 'Mark facecam';
    band.style.display = 'none';
    const p = reframeLocalPoint(e);
    const w = Math.abs(p.x - a.x);
    const h = Math.abs(p.y - a.y);
    const v = reframeVideo;
    if (w < REFRAME_MIN_PX || h < REFRAME_MIN_PX || !v) return;
    const vr = v.getBoundingClientRect();
    reframeOverlay = { x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w, h };
    reframeClampOverlay();
    const o = reframeOverlay;
    reframeCrop = reframeNormRect({ x: o.x / vr.width, y: o.y / vr.height, w: o.w / vr.width, h: o.h / vr.height });
    reframeUserAdjusted = true;
    reframeLogAdd(`Box drawn [${o.x.toFixed(0)},${o.y.toFixed(0)} ${o.w.toFixed(0)}×${o.h.toFixed(0)}px].`);
  };
  surface.addEventListener('pointerup', finishDraw);
  surface.addEventListener('pointercancel', finishDraw);
  surface.addEventListener('click', (e) => e.stopPropagation());
  const drawBtn = document.createElement('button');
  drawBtn.textContent = 'Mark facecam';
  drawBtn.addEventListener('click', () => {
    const on = surface.style.display === 'none';
    surface.style.display = on ? '' : 'none';
    drawBtn.textContent = on ? 'Drag on video…' : 'Mark facecam';
  });

  const status = document.createElement('span');
  status.className = 'status';
  status.setAttribute('role', 'status');
  reframeStatusLine = status;

  bar.append(hideBtn, resetBtn, detectBtn, drawBtn, maskLabel, segLabel);
  reframeRepairAddControls(bar);
  bar.append(status);

  const maskRect = document.createElement('div');
  maskRect.className = 'mask';
  maskRect.style.display = 'none';
  reframeMaskRect = maskRect;

  // repair fill canvas (repair-ui paints it; this block only places it over the original rect)
  const repairCanvas = document.createElement('canvas');
  repairCanvas.style.cssText = 'position:absolute;display:none;pointer-events:none;';
  reframeRepairCanvas = repairCanvas;

  const box = document.createElement('div');
  box.className = 'box';
  box.style.display = 'none';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Facecam overlay. Drag to move.');
  const canvas = document.createElement('canvas');
  box.append(canvas);
  reframeCropBox = box;
  reframeCropCanvas = canvas;

  shadow.append(style, maskRect, repairCanvas, box, bar, surface);
  reframeRoot = root;
  reframeRehost();

  attachDrag(box);
  reframeRenderLoop();
}

function reframeCheckbox(labelText: string, checked: boolean, onChange: (on: boolean) => void) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  label.append(input, labelText);
  return label;
}

function reframeLocalPoint(e: { clientX: number; clientY: number }) {
  const rect = reframeVideo?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function attachDrag(box: HTMLDivElement) {
  let start: { px: number; py: number; ox: number; oy: number } | null = null;
  box.addEventListener('pointerdown', (e) => {
    if (e.target === reframeCropCanvas || e.target === box) {
      e.preventDefault();
      box.setPointerCapture(e.pointerId);
      const p = reframeLocalPoint(e);
      start = { px: p.x, py: p.y, ox: reframeOverlay.x, oy: reframeOverlay.y };
    }
  });
  box.addEventListener('pointermove', (e) => {
    if (!start) return;
    const p = reframeLocalPoint(e);
    reframeOverlay.x = start.ox + (p.x - start.px);
    reframeOverlay.y = start.oy + (p.y - start.py);
    reframeUserAdjusted = true;
    reframeClampOverlay();
  });
  const end = () => {
    start = null;
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
}

function reframeRenderLoop() {
  const v = reframeVideo;
  const root = reframeRoot;
  if (!v || !root || !reframeEnabled) {
    reframeRvfc = 0;
    return;
  }
  const rect = v.getBoundingClientRect();
  if (reframeHostEl) {
    if (reframeHostRelative) {
      const hr = reframeHostEl.getBoundingClientRect();
      root.style.left = `${rect.left - hr.left}px`;
      root.style.top = `${rect.top - hr.top}px`;
    } else {
      root.style.left = `${rect.left + window.scrollX}px`;
      root.style.top = `${rect.top + window.scrollY}px`;
    }
  }
  root.style.width = `${rect.width}px`;
  root.style.height = `${rect.height}px`;

  if (reframeStatusLine) {
    reframeStatusLine.textContent = `${reframeDetectionStatus}${reframeStatusDetail ? ` — ${reframeStatusDetail}` : ''}${reframeRepairStatus ? ` | ${reframeRepairStatus}` : ''}`;
    reframeStatusLine.className = `status status-${reframeDetectionStatus}`;
  }

  if (reframeMaskRect) {
    if (reframeMaskOn && reframeCrop) {
      reframeMaskRect.style.display = '';
      reframeMaskRect.style.left = `${reframeCrop.x * 100}%`;
      reframeMaskRect.style.top = `${reframeCrop.y * 100}%`;
      reframeMaskRect.style.width = `${reframeCrop.w * 100}%`;
      reframeMaskRect.style.height = `${reframeCrop.h * 100}%`;
    } else {
      reframeMaskRect.style.display = 'none';
    }
  }

  if (reframeRepairCanvas) {
    if (reframeRepairOn && reframeCrop) {
      const c = reframeCrop;
      reframeRepairCanvas.style.display = '';
      reframeRepairCanvas.style.left = `${c.x * 100}%`;
      reframeRepairCanvas.style.top = `${c.y * 100}%`;
      reframeRepairCanvas.style.width = `${c.w * 100}%`;
      reframeRepairCanvas.style.height = `${c.h * 100}%`;
    } else {
      reframeRepairCanvas.style.display = 'none';
    }
  }

  if (reframeCropBox && reframeCropCanvas && reframeCrop && v.videoWidth > 0) {
    reframeCropBox.style.display = reframeCropVisible ? '' : 'none';
    reframeCropBox.style.left = `${reframeOverlay.x}px`;
    reframeCropBox.style.top = `${reframeOverlay.y}px`;
    reframeCropBox.style.width = `${reframeOverlay.w}px`;
    reframeCropBox.style.height = `${reframeOverlay.h}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(reframeOverlay.w * dpr));
    const ch = Math.max(1, Math.round(reframeOverlay.h * dpr));
    if (reframeCropCanvas.width !== cw || reframeCropCanvas.height !== ch) {
      reframeCropCanvas.width = cw;
      reframeCropCanvas.height = ch;
    }
    const ctx = reframeCropCanvas.getContext('2d');
    const c = reframeCrop;
    const sx = c.x * v.videoWidth;
    const sy = c.y * v.videoHeight;
    const sw = c.w * v.videoWidth;
    const sh = c.h * v.videoHeight;
    if (ctx) {
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, cw, ch);
      if (reframeSegmentOn && reframeMaskImage) {
        const temp = (reframeTempCanvas ??= document.createElement('canvas'));
        temp.width = cw;
        temp.height = ch;
        const tctx = temp.getContext('2d');
        if (tctx) {
          tctx.clearRect(0, 0, cw, ch);
          tctx.drawImage(v, sx, sy, sw, sh, 0, 0, cw, ch);
          const m = reframeMaskMeta;
          const kx = m.sentW / v.videoWidth;
          const ky = m.sentH / v.videoHeight;
          tctx.globalCompositeOperation = 'destination-in';
          tctx.drawImage(
            reframeMaskImage,
            sx * kx,
            sy * ky,
            sw * kx,
            sh * ky,
            0,
            0,
            cw,
            ch,
          );
          tctx.globalCompositeOperation = 'source-over';
          ctx.clearRect(0, 0, cw, ch);
          ctx.drawImage(temp, 0, 0);
        }
      }
    }
  } else if (reframeCropBox) {
    reframeCropBox.style.display = 'none';
  }

  reframeRvfc = v.requestVideoFrameCallback(() => reframeRenderLoop());
}

function reframeDestroyOverlayUi() {
  if (reframeRvfc && reframeVideo) reframeVideo.cancelVideoFrameCallback(reframeRvfc);
  reframeRvfc = 0;
  reframeRepairStop();
  reframeRepairCanvas = null;
  reframeRoot?.remove();
  reframeRoot = null;
  reframeCropBox = null;
  reframeCropCanvas = null;
  reframeMaskRect = null;
  reframeStatusLine = null;
  reframeTempCanvas = null;
  reframeHostEl = null;
  reframeHostRelative = false;
}

document.addEventListener('fullscreenchange', () => {
  if (!reframeEnabled || !reframeRoot) return;
  reframeRehost();
});
