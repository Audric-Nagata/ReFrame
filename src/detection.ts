import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { Rect } from './layout';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

// ponytail: padding is a hand-tuned heuristic, not learned boundary estimation.
// A detected face box is not the webcam rectangle — pad generously, user corrects.
const PAD_X = 0.35; // each side, fraction of face width
const PAD_TOP = 0.45;
const PAD_BOTTOM = 1.1;

export interface DetectionSample {
  face: Rect | null;
  confidence: number;
  inferenceMs: number;
}

export interface DetectionAggregate {
  face: Rect;
  confidence: number;
  hits: number;
  total: number;
  avgInferenceMs: number;
}

let detectorPromise: Promise<FaceDetector> | null = null;

export function loadDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      return vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.3,
      });
    })().catch((err) => {
      detectorPromise = null; // allow retry after CDN failure
      throw err;
    });
  }
  return detectorPromise;
}

export async function sampleDetections(
  video: HTMLVideoElement,
  sampleCount = 5,
  intervalMs = 500,
): Promise<DetectionSample[]> {
  if (video.videoWidth === 0) throw new Error('Video has no dimensions yet.');
  const detector = await loadDetector();
  const samples: DetectionSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, intervalMs));
    const t0 = performance.now();
    const result = detector.detectForVideo(video, performance.now());
    const inferenceMs = performance.now() - t0;
    const detection = result.detections?.[0];
    const box = detection?.boundingBox;
    if (box) {
      samples.push({
        face: {
          x: box.originX / video.videoWidth,
          y: box.originY / video.videoHeight,
          w: box.width / video.videoWidth,
          h: box.height / video.videoHeight,
        },
        confidence: detection?.categories?.[0]?.score ?? 0,
        inferenceMs,
      });
    } else {
      samples.push({ face: null, confidence: 0, inferenceMs });
    }
  }
  return samples;
}

export function aggregateSamples(samples: DetectionSample[]): DetectionAggregate | null {
  const hits = samples.filter((s) => s.face !== null);
  if (hits.length === 0) return null;
  const face: Rect = {
    x: median(hits.map((s) => s.face!.x)),
    y: median(hits.map((s) => s.face!.y)),
    w: median(hits.map((s) => s.face!.w)),
    h: median(hits.map((s) => s.face!.h)),
  };
  return {
    face,
    confidence: median(hits.map((s) => s.confidence)),
    hits: hits.length,
    total: samples.length,
    avgInferenceMs: hits.reduce((a, s) => a + s.inferenceMs, 0) / hits.length,
  };
}

export function estimateFacecamRect(face: Rect): Rect {
  const w = face.w * (1 + 2 * PAD_X);
  const h = face.h * (1 + PAD_TOP + PAD_BOTTOM);
  return {
    x: Math.min(Math.max(face.x - face.w * PAD_X, 0), 1 - w),
    y: Math.min(Math.max(face.y - face.h * PAD_TOP, 0), 1 - h),
    w: Math.min(w, 1),
    h: Math.min(h, 1),
  };
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
