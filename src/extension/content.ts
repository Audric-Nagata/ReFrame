// ReFrame extension — content script (classic, shares isolated-world scope with overlay.js).
// Finds the watch-page video, samples frames to the offscreen detector, owns state.
// ponytail: MV3 content scripts are classic scripts — no imports; overlay.js reads these globals.

console.info('[ReFrame] content script loaded on', location.href);

interface ReframeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

let reframeVideo: HTMLVideoElement | null = null;
let reframeEnabled = false;
let reframeMaskOn = false;
let reframeSegmentOn = false;
let reframeCrop: ReframeRect | null = null;
let reframeOverlay = { x: 0, y: 0, w: 0, h: 0 }; // px relative to video box
let reframeUserAdjusted = false;
let reframeDetectionStatus = 'idle';
let reframeStatusDetail = '';
let reframeLog: string[] = [];
let reframeMaskImage: ImageBitmap | null = null;
let reframeMaskMeta = { videoW: 0, videoH: 0, sentW: 0, sentH: 0 };
let reframeOverlayReady = false;

const REFRAME_MIN_PX = 64;
const REFRAME_SAMPLE_MS = 700;

function reframeLogAdd(entry: string) {
  const stamp = new Date().toLocaleTimeString();
  reframeLog.push(`[${stamp}] ${entry}`);
  if (reframeLog.length > 60) reframeLog.shift();
  // ponytail: a stale copy (extension reloaded, tab not) has a dead channel — nothing to do but skip
  try {
    void chrome.runtime.sendMessage({ kind: 'content-log', log: reframeLog }).catch(() => {});
  } catch {
    /* context invalidated */
  }
}

function reframeFindVideo(): HTMLVideoElement | null {
  return (
    (document.querySelector('video.html5-main-video') as HTMLVideoElement | null) ??
    (document.querySelector('video') as HTMLVideoElement | null)
  );
}

function reframeSetStatus(status: string, detail = '') {
  reframeDetectionStatus = status;
  reframeStatusDetail = detail;
}

function reframeNormRect(r: ReframeRect): ReframeRect {
  const w = Math.min(Math.max(r.w, 0.01), 1);
  const h = Math.min(Math.max(r.h, 0.01), 1);
  return {
    x: Math.min(Math.max(r.x, 0), 1 - w),
    y: Math.min(Math.max(r.y, 0), 1 - h),
    w,
    h,
  };
}

let reframeSegmentBusy = false;
let reframeSegmentBusyLogged = false;

async function reframeSendFrame(mode: 'detect' | 'segment') {
  const v = reframeVideo;
  if (!v || v.videoWidth === 0 || v.readyState < 2) return;
  if (mode === 'segment') {
    // serialize: one segment() in flight per ImageSegmenter instance — checkbox, the 700 ms
    // sampler and Detect now all fire concurrently
    if (reframeSegmentBusy) {
      if (!reframeSegmentBusyLogged) {
        reframeSegmentBusyLogged = true;
        reframeLogAdd('Segment: skipped (busy).');
      }
      return;
    }
    reframeSegmentBusy = true;
  }
  try {
    const maxW = 640;
    const scale = Math.min(1, maxW / v.videoWidth);
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    // ponytail: 640px is already ~5× BlazeFace's fixed 128² input — more source pixels cannot help
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    const result = (await chrome.runtime.sendMessage({
      kind: 'frame',
      mode,
      dataUrl,
      sentW: w,
      sentH: h,
      videoW: v.videoWidth,
      videoH: v.videoHeight,
    })) as
      | {
          ok: true;
          type: 'face';
          rect: ReframeRect | null;
          confidence: number;
          inferenceMs: number;
          diag?: string;
        }
      | {
          ok: true;
          type: 'segment';
          maskDataUrl: string;
          sentW: number;
          sentH: number;
          videoW: number;
          videoH: number;
          masks?: number;
          maskIdx?: number;
          meanAlpha?: number;
        }
      | { ok: false; error: string };
    if (!result || result.ok === false) {
      const err = result && 'error' in result ? result.error : 'no response';
      if (mode === 'segment') {
        // segment failures are log-only — they must never clobber the face status line
        // (shared status made a segment error read as "detection failed")
        reframeLogAdd(`Segment task failed: ${err}`);
      } else {
        reframeSetStatus('error', err);
        reframeLogAdd(`Frame task failed (${mode}): ${reframeStatusDetail}`);
      }
      return;
    }
    if (result.type === 'face') reframeOnFace(result);
    else if (result.type === 'segment') {
      if ((result.masks ?? 1) === 0 || (result.meanAlpha ?? 1) < 0.05) {
        reframeLogAdd(
          `Segment: weak/empty mask (masks=${result.masks ?? '?'}, idx=${result.maskIdx ?? '?'}, meanAlpha=${(result.meanAlpha ?? 0).toFixed(2)})`,
        );
      }
      void reframeOnSegment(result);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (mode === 'segment') {
      reframeLogAdd(`Segment task threw: ${detail}`);
    } else {
      reframeSetStatus('error', detail);
      reframeLogAdd(`Frame task failed (${mode}): ${detail}`);
    }
    console.error('[ReFrame] frame task threw:', err);
  } finally {
    if (mode === 'segment') {
      reframeSegmentBusy = false;
      reframeSegmentBusyLogged = false;
    }
  }
}

function reframePlaceOverlayOnCrop() {
  const v = reframeVideo;
  if (!v || !reframeCrop) return;
  const rect = v.getBoundingClientRect();
  reframeOverlay = {
    x: reframeCrop.x * rect.width,
    y: reframeCrop.y * rect.height,
    w: reframeCrop.w * rect.width,
    h: reframeCrop.h * rect.height,
  };
  reframeClampOverlay();
}

function reframeClampOverlay() {
  const v = reframeVideo;
  if (!v) return;
  const rect = v.getBoundingClientRect();
  const o = reframeOverlay;
  o.w = Math.min(Math.max(o.w, REFRAME_MIN_PX), rect.width);
  o.h = Math.min(Math.max(o.h, REFRAME_MIN_PX), rect.height);
  o.x = Math.min(Math.max(o.x, 0), Math.max(0, rect.width - o.w));
  o.y = Math.min(Math.max(o.y, 0), Math.max(0, rect.height - o.h));
}

let reframeSampleTimer = 0;

function reframeStartSampling() {
  if (reframeSampleTimer) return;
  // detect is manual-only (Detect now) — sampler refreshes segment while it is on
  reframeSampleTimer = window.setInterval(() => {
    if (!reframeEnabled || !reframeVideo || reframeVideo.paused) return;
    if (reframeSegmentOn) void reframeSendFrame('segment');
  }, REFRAME_SAMPLE_MS);
}

function reframeStopSampling() {
  if (reframeSampleTimer) window.clearInterval(reframeSampleTimer);
  reframeSampleTimer = 0;
}

function reframeAttach() {
  if (!reframeVideo) reframeVideo = reframeFindVideo();
  if (!reframeVideo) {
    reframeSetStatus('uncertain', 'no video element found on this page');
    return false;
  }
  if (!reframeOverlayReady) reframeBuildOverlay();
  reframeSetStatus('idle', 'press Detect now');
  reframeLogAdd(`Attached to <video> ${reframeVideo.videoWidth || '?'}×${reframeVideo.videoHeight || '?'}.`);
  console.info(`[ReFrame] attached <video> ${reframeVideo.videoWidth}×${reframeVideo.videoHeight}`);
  reframeStartSampling();
  return true;
}

function reframeBuildOverlay() {
  // defined in overlay.js (shares this isolated world)
  reframeOverlayReady = true;
  reframeCreateOverlayUi();
}

function reframeActivate() {
  if (reframeEnabled) return;
  reframeEnabled = true;
  reframeLogAdd('Activated by user.');
  console.info('[ReFrame] activate on', location.pathname);
  if (location.pathname !== '/watch') {
    reframeSetStatus('error', 'not a /watch page — unsupported');
    reframeLogAdd('Unsupported page (not /watch).');
    return;
  }
  if (!reframeAttach()) {
    // SPA navigation or late player: poll briefly
    let tries = 0;
    const poll = window.setInterval(() => {
      tries += 1;
      if (reframeAttach() || tries > 20) window.clearInterval(poll);
    }, 500);
  }
}

function reframeDeactivate() {
  reframeEnabled = false;
  reframeStopSampling();
  reframeRepairStop();
  reframeDestroyOverlayUi();
  reframeOverlayReady = false;
  reframeVideo = null;
  reframeMaskImage?.close();
  reframeMaskImage = null;
  reframeLogAdd('Deactivated.');
}

function reframeDetectNow() {
  reframeCrop = null;
  reframeUserAdjusted = false;
  reframeSetStatus('detecting', 'manual run');
  reframeLogAdd('Manual detection requested.');
  void reframeSendFrame('detect');
  if (reframeSegmentOn) void reframeSendFrame('segment');
}

// YT is a SPA: re-attach when navigating between watch pages.
document.addEventListener('yt-navigate-finished', () => {
  if (!reframeEnabled) return;
  reframeVideo = reframeFindVideo();
  reframeOverlayReady = false;
  reframeDestroyOverlayUi();
  reframeAttach();
});

chrome.runtime.onMessage.addListener((msg: { kind?: string }, _sender, sendResponse) => {
  if (msg.kind === 'activate') {
    reframeActivate();
    sendResponse({
      ok: true,
      attached: !!reframeVideo,
      video:
        reframeVideo && reframeVideo.videoWidth > 0
          ? `${reframeVideo.videoWidth}×${reframeVideo.videoHeight}`
          : null,
      detail: reframeStatusDetail || reframeDetectionStatus,
    });
    return;
  }
  if (msg.kind === 'deactivate') {
    reframeDeactivate();
    sendResponse({ ok: true });
    return;
  }
  if (msg.kind === 'get-log') {
    void chrome.runtime.sendMessage({ kind: 'content-log', log: reframeLog });
  }
});
