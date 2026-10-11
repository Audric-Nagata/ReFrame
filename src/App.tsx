import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoStage } from './VideoStage';
import { FacecamOverlay } from './FacecamOverlay';
import { DetectionPanel, type DetectionState } from './DetectionPanel';
import {
  aggregateSamples,
  estimateFacecamRect,
  sampleDetections,
} from './detection';
import {
  clampPosition,
  clampSizePx,
  DEFAULT_OVERLAY_RECT,
  DEFAULT_SOURCE_RECT,
  type Rect,
} from './layout';

const VIDEO_SRC = 'sample-video/test.mp4';

const IDLE_DETECTION: DetectionState = {
  status: 'idle',
  candidateFaceRect: null,
  candidateSourceRect: null,
  confidence: null,
  message: '',
};

export default function App() {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);

  const [sourceRect, setSourceRect] = useState<Rect>(DEFAULT_SOURCE_RECT);
  const [overlayRect, setOverlayRect] = useState<Rect>(DEFAULT_OVERLAY_RECT);
  const [visible, setVisible] = useState(true);
  const [maskOriginal, setMaskOriginal] = useState(false);
  const [freeRatio, setFreeRatio] = useState(false);
  const [showCropRegion, setShowCropRegion] = useState(true);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [videoFailed, setVideoFailed] = useState(false);
  const [detection, setDetection] = useState<DetectionState>(IDLE_DETECTION);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = useCallback((entry: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [...prev.slice(-49), `[${stamp}] ${entry}`]);
  }, []);

  useEffect(() => {
    const main = mainVideoRef.current;
    const pip = overlayVideoRef.current;
    if (!main || !pip || !visible) return;
    const mirror = () => {
      pip.playbackRate = main.playbackRate;
      if (main.paused) pip.pause();
      else void pip.play().catch(() => {});
      if (Math.abs(main.currentTime - pip.currentTime) > 0.35) pip.currentTime = main.currentTime;
    };
    main.addEventListener('play', mirror);
    main.addEventListener('pause', mirror);
    main.addEventListener('seeked', mirror);
    const drift = window.setInterval(() => {
      if (!main.paused && Math.abs(main.currentTime - pip.currentTime) > 0.35) {
        pip.currentTime = main.currentTime;
      }
    }, 2000);
    mirror();
    return () => {
      main.removeEventListener('play', mirror);
      main.removeEventListener('pause', mirror);
      main.removeEventListener('seeked', mirror);
      window.clearInterval(drift);
    };
  }, [visible]);

  const onStageSize = useCallback((w: number, h: number) => setStageSize({ w, h }), []);
  const onVideoAspect = useCallback((aspect: number) => setVideoAspect(aspect), []);
  const onError = useCallback((failed: boolean) => setVideoFailed(failed), []);

  const runDetection = async () => {
    const video = mainVideoRef.current;
    if (!video) return;
    setDetection({ ...IDLE_DETECTION, status: 'detecting' });
    appendLog('Detection started (5 samples, 500 ms apart).');
    try {
      const samples = await sampleDetections(video);
      const agg = aggregateSamples(samples);
      if (!agg) {
        setDetection({
          status: 'uncertain',
          candidateFaceRect: null,
          candidateSourceRect: null,
          confidence: null,
          message: 'No face found in the sampled frames. Try a moment where your face is visible.',
        });
        appendLog('Result: 0/5 samples with a face — no region proposed.');
        return;
      }
      const region = estimateFacecamRect(agg.face);
      const stable = agg.hits >= Math.ceil(agg.total / 2);
      setDetection({
        status: stable ? 'detected' : 'uncertain',
        candidateFaceRect: agg.face,
        candidateSourceRect: region,
        confidence: agg.confidence,
        message: stable
          ? 'Likely region proposed — review the dashed outline, then use or correct it.'
          : 'Face seen in only some samples; treat the proposal as unreliable.',
      });
      appendLog(
        `Result: ${agg.hits}/${agg.total} samples hit, confidence ${(agg.confidence * 100).toFixed(0)}%, ` +
          `avg inference ${agg.avgInferenceMs.toFixed(0)} ms, face [${formatRect(agg.face)}], ` +
          `estimated region [${formatRect(region)}].`,
      );
    } catch (err) {
      setDetection({
        ...IDLE_DETECTION,
        status: 'error',
        message: `Could not run detection: ${err instanceof Error ? err.message : String(err)}`,
      });
      appendLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const useCandidateRegion = () => {
    if (!detection.candidateSourceRect) return;
    setSourceRect(detection.candidateSourceRect);
    appendLog('Proposed region applied to crop inputs (user accepted).');
  };

  const flagIncorrect = () => {
    appendLog(
      `Flagged current crop as incorrect: [${formatRect(sourceRect)}] ` +
        `(${detection.status}${detection.confidence !== null ? `, conf ${(detection.confidence * 100).toFixed(0)}%` : ''}).`,
    );
  };

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(log.join('\n'));
      appendLog('Log copied to clipboard.');
    } catch {
      appendLog('Clipboard write failed (browser permission).');
    }
  };

  const scaleOverlay = (factor: number) => {
    if (stageSize.w === 0 || stageSize.h === 0) return;
    let wPx = overlayRect.w * stageSize.w * factor;
    let hPx = overlayRect.h * stageSize.h * factor;
    ({ wPx, hPx } = clampSizePx(wPx, hPx, stageSize.w, stageSize.h));
    const nextW = wPx / stageSize.w;
    const nextH = hPx / stageSize.h;
    const pos = clampPosition(overlayRect.x, overlayRect.y, nextW, nextH);
    setOverlayRect({ x: pos.x, y: pos.y, w: nextW, h: nextH });
  };

  const resetLayout = () => {
    setOverlayRect(DEFAULT_OVERLAY_RECT);
    setSourceRect(DEFAULT_SOURCE_RECT);
    setVisible(true);
    setMaskOriginal(false);
  };

  const setCropField = (field: keyof Rect, raw: string) => {
    const value = Math.min(Math.max(Number(raw) || 0, 0), 100) / 100;
    const next: Rect = { ...sourceRect, [field]: value };
    next.w = Math.max(next.w, 0.01);
    next.h = Math.max(next.h, 0.01);
    next.x = Math.min(next.x, 1 - next.w);
    next.y = Math.min(next.y, 1 - next.h);
    setSourceRect(next);
  };

  const rectStyle = (r: Rect) => ({
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  });

  return (
    <div className="app">
      <header className="app-header">
        <h1>ReFrame</h1>
        <p className="subtitle">Local prototype — crop and reposition a facecam on a test video.</p>
      </header>

      {videoFailed ? (
        <div className="notice notice-warning" role="alert">
          No video found. Place a test file at <code>public/sample-video/test.mp4</code> and
          reload. (Do not commit copyrighted material.)
        </div>
      ) : (
        <VideoStage
          src={VIDEO_SRC}
          aspect={videoAspect}
          videoRef={mainVideoRef}
          onStageSize={onStageSize}
          onVideoAspect={onVideoAspect}
          onError={onError}
        >
          {showCropRegion && <div className="crop-outline" style={rectStyle(sourceRect)} aria-hidden />}
          {maskOriginal && <div className="mask" style={rectStyle(sourceRect)} aria-hidden />}
          {visible && stageSize.w > 0 && (
            <FacecamOverlay
              src={VIDEO_SRC}
              videoRef={overlayVideoRef}
              sourceRect={sourceRect}
              rect={overlayRect}
              stageW={stageSize.w}
              stageH={stageSize.h}
              videoAspect={videoAspect}
              freeRatio={freeRatio}
              onChange={setOverlayRect}
            />
          )}
        </VideoStage>
      )}

      <section className="panel">
        <h2>Controls</h2>
        <div className="control-row">
          <button type="button" onClick={() => setVisible((v) => !v)}>
            {visible ? 'Hide facecam' : 'Show facecam'}
          </button>
          <button type="button" onClick={() => scaleOverlay(1 / 1.1)}>
            Smaller
          </button>
          <button type="button" onClick={() => scaleOverlay(1.1)}>
            Larger
          </button>
          <button type="button" onClick={resetLayout}>
            Reset layout
          </button>
        </div>
        <div className="control-row">
          <label>
            <input
              type="checkbox"
              checked={maskOriginal}
              onChange={(e) => setMaskOriginal(e.target.checked)}
            />{' '}
            Cover original facecam
          </label>
          <label title="When enabled, resizing no longer preserves the crop's aspect ratio">
            <input
              type="checkbox"
              checked={freeRatio}
              onChange={(e) => setFreeRatio(e.target.checked)}
            />{' '}
            Customize aspect ratio
          </label>
          <label>
            <input
              type="checkbox"
              checked={showCropRegion}
              onChange={(e) => setShowCropRegion(e.target.checked)}
            />{' '}
            Show crop region outline
          </label>
        </div>
        {maskOriginal && (
          <div className="notice notice-warning" role="status">
            The original facecam is covered, but gameplay behind it cannot be restored.
          </div>
        )}
      </section>

      <DetectionPanel
        detection={detection}
        log={log}
        onDetect={runDetection}
        onUseRegion={useCandidateRegion}
        onFlagIncorrect={flagIncorrect}
        onCopyLog={copyLog}
      />

      <section className="panel">
        <h2>Facecam crop region (% of video)</h2>
        <div className="crop-grid">
          {(['x', 'y', 'w', 'h'] as const).map((field) => (
            <label key={field}>
              {field.toUpperCase()}
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(sourceRect[field] * 100)}
                onChange={(e) => setCropField(field, e.target.value)}
              />
            </label>
          ))}
        </div>
        <p className="helper">
          This is a crop of the composited video, not an independent facecam source. The dashed
          outline on the video shows the current crop region.
        </p>
      </section>
    </div>
  );
}

function formatRect(r: Rect): string {
  return `${(r.x * 100).toFixed(0)},${(r.y * 100).toFixed(0)} ${(r.w * 100).toFixed(0)}×${(r.h * 100).toFixed(0)}%`;
}
