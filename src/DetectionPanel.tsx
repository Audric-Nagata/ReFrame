import type { Rect } from './layout';

export type DetectionStatus = 'idle' | 'detecting' | 'detected' | 'uncertain' | 'error';

export interface DetectionState {
  status: DetectionStatus;
  candidateFaceRect: Rect | null;
  candidateSourceRect: Rect | null;
  confidence: number | null;
  message: string;
}

interface DetectionPanelProps {
  detection: DetectionState;
  log: string[];
  onDetect: () => void;
  onUseRegion: () => void;
  onFlagIncorrect: () => void;
  onCopyLog: () => void;
}

const STATUS_LABEL: Record<DetectionStatus, string> = {
  idle: 'Idle — not run yet',
  detecting: 'Detecting…',
  detected: 'Face detected (likely region proposed)',
  uncertain: 'Uncertain — no reliable face found in sampled frames',
  error: 'Detection failed',
};

export function DetectionPanel({
  detection,
  log,
  onDetect,
  onUseRegion,
  onFlagIncorrect,
  onCopyLog,
}: DetectionPanelProps) {
  const { status, candidateSourceRect, confidence, message } = detection;
  return (
    <section className="panel">
      <h2>Detection experiment</h2>
      <p className={`detect-status detect-status-${status}`} role="status">
        {STATUS_LABEL[status]}
        {confidence !== null && ` · confidence ${(confidence * 100).toFixed(0)}%`}
      </p>
      {message && <p className="helper">{message}</p>}
      <div className="control-row">
        <button type="button" onClick={onDetect} disabled={status === 'detecting'}>
          {status === 'detecting' ? 'Detecting…' : 'Detect facecam'}
        </button>
        <button
          type="button"
          onClick={onUseRegion}
          disabled={candidateSourceRect === null}
          title="Apply the proposed region to the crop inputs; adjust manually from there"
        >
          Use this region
        </button>
        <button type="button" onClick={onFlagIncorrect}>
          Flag as incorrect
        </button>
        <button type="button" onClick={onCopyLog} disabled={log.length === 0}>
          Copy log
        </button>
      </div>
      <p className="helper">
        A detected face is not proof of the streamer or the full webcam boundary. This is a
        feasibility experiment; results are logged locally below.
      </p>
      {log.length > 0 && (
        <details className="detect-log">
          <summary>Detection log ({log.length})</summary>
          <pre>{log.join('\n')}</pre>
        </details>
      )}
    </section>
  );
}
