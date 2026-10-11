import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { clampPosition, clampSizePx, MAX_SIZE_RATIO, type Rect } from './layout';

interface FacecamOverlayProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  sourceRect: Rect;
  rect: Rect;
  stageW: number;
  stageH: number;
  videoAspect: number;
  freeRatio: boolean;
  onChange: (rect: Rect) => void;
}

export function FacecamOverlay({
  src,
  videoRef,
  sourceRect,
  rect,
  stageW,
  stageH,
  videoAspect,
  freeRatio,
  onChange,
}: FacecamOverlayProps) {
  const dragState = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    rect: Rect;
  } | null>(null);

  const beginInteraction =
    (mode: 'move' | 'resize') => (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = { mode, startX: e.clientX, startY: e.clientY, rect: { ...rect } };
    };

  const handleMove = (e: ReactPointerEvent<HTMLElement>) => {
    const state = dragState.current;
    if (!state || stageW === 0 || stageH === 0) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const start = state.rect;
    const startW = start.w * stageW;
    const startH = start.h * stageH;

    if (state.mode === 'move') {
      const pos = clampPosition((start.x * stageW + dx) / stageW, (start.y * stageH + dy) / stageH, start.w, start.h);
      onChange({ ...start, x: pos.x, y: pos.y });
      return;
    }

    let wPx = startW + dx;
    let hPx = freeRatio ? startH + dy : (wPx * sourceRect.h) / sourceRect.w / videoAspect;
    ({ wPx, hPx } = clampSizePx(wPx, hPx, stageW, stageH));
    if (!freeRatio) {
      hPx = (wPx * sourceRect.h) / sourceRect.w / videoAspect;
      if (hPx > stageH * MAX_SIZE_RATIO) {
        hPx = stageH * MAX_SIZE_RATIO;
        wPx = (hPx * sourceRect.w * videoAspect) / sourceRect.h;
      }
    }
    const w = wPx / stageW;
    const h = hPx / stageH;
    const pos = clampPosition(start.x, start.y, w, h);
    onChange({ x: pos.x, y: pos.y, w, h });
  };

  const endInteraction = () => {
    dragState.current = null;
  };

  return (
    <div
      className="overlay"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
      }}
      onPointerDown={beginInteraction('move')}
      onPointerMove={handleMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      role="group"
      aria-label="Facecam overlay. Drag to move."
    >
      {/* ponytail: duplicate <video> for the crop; playback drift vs main video possible, seek-snap on timeupdate in App if needed */}
      <video
        ref={videoRef}
        className="overlay-video"
        src={src}
        playsInline
        muted
        tabIndex={-1}
        style={{
          width: `${100 / sourceRect.w}%`,
          height: `${100 / sourceRect.h}%`,
          left: `${(-sourceRect.x / sourceRect.w) * 100}%`,
          top: `${(-sourceRect.y / sourceRect.h) * 100}%`,
        }}
      />
      <button
        type="button"
        className="resize-handle"
        aria-label="Resize facecam overlay"
        onPointerDown={beginInteraction('resize')}
        onPointerMove={handleMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
      />
    </div>
  );
}
