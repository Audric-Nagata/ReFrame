// ReFrame extension — offscreen document: MediaPipe face detection + person segmentation.
// Runs in the extension origin — page Trusted Types never applies here (D-012).
// MediaPipe is vendored locally under lib/ (D-013: no remote code).

interface VisionModule {
  FilesetResolver: {
    forVisionTasks(base: string): Promise<unknown>;
  };
  FaceDetector: {
    createFromOptions(fileset: unknown, options: unknown): Promise<{
      detectForVideo(input: ImageBitmap, timestampMs: number): {
        detections?: Array<{
          boundingBox?: { originX: number; originY: number; width: number; height: number };
          categories?: Array<{ score?: number }>;
        }>;
      };
      close(): Promise<void>;
    }>;
  };
  ImageSegmenter: {
    createFromOptions(fileset: unknown, options: unknown): Promise<{
      segment(input: ImageBitmap): Promise<{
        confidenceMasks?: Array<{
          getAsFloat32Array(): Float32Array;
          width: number;
          height: number;
        }>;
      }>;
      close(): Promise<void>;
    }>;
  };
}

let visionPromise: Promise<VisionModule> | null = null;
let faceDetector: Awaited<ReturnType<VisionModule['FaceDetector']['createFromOptions']>> | null = null;
let segmenter: Awaited<ReturnType<VisionModule['ImageSegmenter']['createFromOptions']>> | null = null;

async function reframeVision(): Promise<VisionModule> {
  if (!visionPromise) {
    visionPromise = import(chrome.runtime.getURL('lib/vision_bundle.mjs')) as Promise<VisionModule>;
  }
  return visionPromise;
}

async function reframeFaceDetector() {
  if (!faceDetector) {
    const vision = await reframeVision();
    const fileset = await vision.FilesetResolver.forVisionTasks(chrome.runtime.getURL('lib/wasm'));
    faceDetector = await vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: chrome.runtime.getURL('lib/models/blaze_face_short_range.tflite') },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.15,
    });
  }
  return faceDetector;
}

async function reframeSegmenter() {
  if (!segmenter) {
    const vision = await reframeVision();
    const fileset = await vision.FilesetResolver.forVisionTasks(chrome.runtime.getURL('lib/wasm'));
    segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: chrome.runtime.getURL('lib/models/selfie_segmenter.tflite') },
      // no runningMode: defaults to IMAGE — matches segment(); VIDEO would require segmentForVideo()
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  }
  return segmenter;
}

async function reframeDecode(dataUrl: string): Promise<ImageBitmap> {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

/** Diagnostic: mean luma of the decoded frame — a blank/black capture shows up here. */
function reframeMeanLuma(bitmap: ImageBitmap): number {
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = c.getContext('2d');
  if (!ctx) return -1;
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 256) {
    // every 64th pixel — subsampled so the probe stays ~free at 700 ms cadence
    sum += (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    n++;
  }
  return n > 0 ? Math.round(sum / n) : -1;
}

async function reframeHandleTask(msg: {
  mode: string;
  dataUrl: string;
  sentW: number;
  sentH: number;
  videoW: number;
  videoH: number;
}) {
  const bitmap = await reframeDecode(msg.dataUrl);
  try {
    if (msg.mode === 'detect') {
      const detector = await reframeFaceDetector();
      const t0 = performance.now();
      const result = detector.detectForVideo(bitmap, performance.now());
      const inferenceMs = performance.now() - t0;
      const d = result.detections?.[0];
      const box = d?.boundingBox;
      // diag separates the three miss worlds: blank frame (luma ~0) vs detector-blind
      // (good luma, detections=0) vs threshold gate (detections>0, low topScore)
      const diag = `detections=${result.detections?.length ?? 0}, topScore=${d?.categories?.[0]?.score?.toFixed(2) ?? '-'}, bitmap=${msg.sentW}x${msg.sentH}, meanLuma=${reframeMeanLuma(bitmap)}`;
      if (!box) return { ok: true, type: 'face', rect: null, confidence: 0, inferenceMs, diag };
      return {
        ok: true,
        type: 'face',
        rect: {
          x: box.originX / msg.sentW,
          y: box.originY / msg.sentH,
          w: box.width / msg.sentW,
          h: box.height / msg.sentH,
        },
        confidence: d?.categories?.[0]?.score ?? 0,
        inferenceMs,
        diag,
      };
    }
    if (msg.mode === 'segment') {
      const seg = await reframeSegmenter();
      const t0 = performance.now();
      const result = await seg.segment(bitmap);
      const inferenceMs = performance.now() - t0;
      const masksN = result.confidenceMasks?.length ?? 0;
      const mask = result.confidenceMasks?.[0];
      if (!mask) return { ok: false, error: `no confidence mask (masks=${masksN})` };
      const floats = mask.getAsFloat32Array();
      const w = mask.width;
      const h = mask.height;
      // ponytail: person = category 1 in selfie_segmenter; confidenceMasks[1] when available
      const person = result.confidenceMasks?.[1] ?? mask;
      const personFloats = person === mask ? floats : person.getAsFloat32Array();
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: false, error: 'no 2d context' };
      const img = ctx.createImageData(w, h);
      let alphaSum = 0;
      for (let i = 0; i < personFloats.length; i++) {
        alphaSum += personFloats[i];
        const a = Math.round(Math.min(Math.max(personFloats[i], 0), 1) * 255);
        img.data[i * 4] = 255;
        img.data[i * 4 + 1] = 255;
        img.data[i * 4 + 2] = 255;
        img.data[i * 4 + 3] = a;
      }
      const meanAlpha = personFloats.length > 0 ? alphaSum / personFloats.length : 0;
      ctx.putImageData(img, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
      return {
        ok: true,
        type: 'segment',
        maskDataUrl: dataUrl,
        sentW: msg.sentW,
        sentH: msg.sentH,
        videoW: msg.videoW,
        videoH: msg.videoH,
        inferenceMs,
        masks: masksN,
        maskIdx: person === mask ? 0 : 1,
        meanAlpha: Math.round(meanAlpha * 100) / 100,
      };
    }
    return { ok: false, error: `unknown mode ${msg.mode}` };
  } finally {
    bitmap.close();
  }
}

chrome.runtime.onMessage.addListener((msg: { kind?: string }, _sender, sendResponse) => {
  if (msg.kind !== 'task') return;
  void reframeHandleTask(msg as Parameters<typeof reframeHandleTask>[0])
    .then(sendResponse)
    .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
  return true;
});
