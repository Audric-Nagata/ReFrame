// ReFrame extension — face/segmentation result handlers (classic script; globals from content.js).
// Diagnostics ride the task response (offscreen.ts), so every miss is explainable from the
// popup log: detect failures carry detections/topScore/meanLuma, segment carries mask stats.

// ponytail: heuristic — cam ≈ 1.7× face height (head+shoulders framing), 16:9 wide,
// face centered horizontally, slight headroom. Tune when framing tests exist;
// manual free-resize covers misses. Applied only to the auto-detected box.
function reframeExpandFace(r: ReframeRect): ReframeRect {
  const v = reframeVideo;
  if (!v || !v.videoWidth || !v.videoHeight) return r;
  const faceH = r.h * v.videoHeight;
  const camH = faceH * 1.7;
  const camW = camH * (16 / 9);
  const cx = (r.x + r.w / 2) * v.videoWidth;
  return {
    x: (cx - camW / 2) / v.videoWidth,
    y: (r.y * v.videoHeight - camH * 0.08) / v.videoHeight,
    w: camW / v.videoWidth,
    h: camH / v.videoHeight,
  };
}

function reframeOnFace(result: {
  rect: ReframeRect | null;
  confidence: number;
  inferenceMs: number;
  diag?: string;
}) {
  const conf = result.confidence;
  const detail = `conf ${(conf * 100).toFixed(0)}%, infer ${result.inferenceMs.toFixed(0)} ms`;
  if (conf < 0.25 || !result.rect || !result.rect.w) {
    reframeSetStatus('uncertain', `no reliable face (${detail})`);
    reframeLogAdd(`Detect: miss — ${detail}${result.diag ? ` | ${result.diag}` : ''}`);
    return;
  }
  reframeSetStatus('detected', detail);
  if (!reframeCrop && !reframeUserAdjusted) {
    reframeCrop = reframeNormRect(reframeExpandFace(result.rect));
    reframePlaceOverlayOnCrop();
    reframeLogAdd(
      `Detect: auto-applied region [${(reframeCrop.x * 100).toFixed(0)}, ${(reframeCrop.y * 100).toFixed(0)} ${(reframeCrop.w * 100).toFixed(0)}×${(reframeCrop.h * 100).toFixed(0)}%] — ${detail}`,
    );
  } else {
    reframeLogAdd(`Detect: hold (region already set) — ${detail}`);
  }
}

async function reframeOnSegment(result: {
  maskDataUrl: string;
  sentW: number;
  sentH: number;
  videoW: number;
  videoH: number;
}) {
  try {
    const blob = await (await fetch(result.maskDataUrl)).blob();
    const bmp = await createImageBitmap(blob);
    reframeMaskImage?.close();
    reframeMaskImage = bmp;
    reframeMaskMeta = {
      videoW: result.videoW,
      videoH: result.videoH,
      sentW: result.sentW,
      sentH: result.sentH,
    };
  } catch (err) {
    reframeLogAdd(`Segment mask decode failed: ${err instanceof Error ? err.message : err}`);
    console.error('[ReFrame] mask decode failed:', err);
  }
}
