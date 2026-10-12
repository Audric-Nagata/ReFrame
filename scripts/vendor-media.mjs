// Builds the loadable extension folder: tsc emits JS here, this script copies the
// static manifest/HTML and vendors MediaPipe runtime + models (no remote code, D-013).
// Run: npm run build:ext
import { cpSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ext = path.join(root, '..', 'extension');
const lib = path.join(ext, 'lib');
const models = path.join(lib, 'models');
mkdirSync(models, { recursive: true });

cpSync(path.join(root, '..', 'src', 'extension', 'static'), ext, { recursive: true });

const wasmSrc = path.join(root, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const bundleSrc = path.join(root, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'vision_bundle.mjs');

cpSync(wasmSrc, path.join(lib, 'wasm'), { recursive: true });
cpSync(bundleSrc, path.join(lib, 'vision_bundle.mjs'));

const modelUrls = {
  'blaze_face_short_range.tflite':
    'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  'selfie_segmenter.tflite':
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
};

for (const [name, url] of Object.entries(modelUrls)) {
  const dest = path.join(models, name);
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`keep  ${name} (already downloaded)`);
    continue;
  }
  console.log(`fetch ${name} …`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`ok    ${name} (${statSync(dest).size} bytes)`);
}
console.log('vendor complete →', ext);
