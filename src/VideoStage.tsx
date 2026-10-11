import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface VideoStageProps {
  src: string;
  children: ReactNode;
  aspect: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  onStageSize: (w: number, h: number) => void;
  onVideoAspect: (aspect: number) => void;
  onError: (failed: boolean) => void;
}

export function VideoStage({
  src,
  children,
  aspect,
  videoRef,
  onStageSize,
  onVideoAspect,
  onError,
}: VideoStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      onStageSize(el.clientWidth, el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onStageSize]);

  return (
    <div className="stage-wrap">
      <div ref={containerRef} className="stage" style={{ aspectRatio: aspect }}>
        <video
          ref={videoRef}
          className="stage-video"
          src={src}
          controls
          playsInline
          onError={() => onError(true)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            onError(false);
            if (v.videoWidth > 0) onVideoAspect(v.videoWidth / v.videoHeight);
          }}
        />
        {children}
      </div>
    </div>
  );
}
