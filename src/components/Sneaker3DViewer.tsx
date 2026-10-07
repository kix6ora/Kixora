import React, { Suspense, lazy, useEffect, useState } from 'react';
import { getOptimizedImageUrl } from '../lib/cloudinary';

const LazyViewer = lazy(() => import('./Sneaker3DScene'));
let viewerImport: Promise<typeof import('./Sneaker3DScene')> | undefined;

export const preloadSneaker3DViewer = () => {
  viewerImport ??= import('./Sneaker3DScene').catch((error) => {
    viewerImport = undefined;
    throw error;
  });
  return viewerImport;
};

type Sneaker3DViewerProps = {
  modelUrl?: string;
  images: string[];
  fallbackImage: string;
  name: string;
  autoRotate?: boolean;
  compact?: boolean;
  onImageChange?: (index: number) => void;
  onViewerError?: () => void;
};

function TurntableFallback({ images, fallbackImage, name, compact, onImageChange }: Pick<Sneaker3DViewerProps, 'images' | 'fallbackImage' | 'name' | 'compact' | 'onImageChange'>) {
  const [index, setIndex] = useState(0);
  const frames = images.length ? images : [fallbackImage];
  const changeFrame = (next: number) => {
    const frame = (next + frames.length) % frames.length;
    setIndex(frame);
    onImageChange?.(frame);
  };

  useEffect(() => {
    setIndex(0);
  }, [fallbackImage]);

  return (
    <div
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#181818] ${compact ? 'h-full min-h-0' : 'min-h-[250px] flex-1'}`}
      onTouchStart={(event) => {
        (event.currentTarget as HTMLDivElement).dataset.touchX = String(event.touches[0]?.clientX ?? 0);
      }}
      onTouchEnd={(event) => {
        const start = Number((event.currentTarget as HTMLDivElement).dataset.touchX || 0);
        const delta = (event.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(delta) > 30) changeFrame(index + (delta < 0 ? 1 : -1));
      }}
      onMouseMove={(event) => {
        if (frames.length < 2 || !(event.buttons & 1)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        changeFrame(Math.floor(((event.clientX - rect.left) / rect.width) * frames.length));
      }}
      aria-label="Turntable product image sequence"
    >
      <img
        key={frames[index] || fallbackImage}
        src={getOptimizedImageUrl(frames[index] || fallbackImage, { width: compact ? 500 : 900, quality: 'auto' })}
        alt={name}
        draggable={false}
        className="h-full w-full select-none object-contain p-3"
      />
      {frames.length > 1 ? (
        <div className="absolute bottom-2 flex gap-1.5" aria-label={`Image ${index + 1} of ${frames.length}`}>
          {frames.slice(0, 8).map((_, frame) => (
            <button key={frame} type="button" aria-label={`Show angle ${frame + 1}`} onClick={() => changeFrame(frame)} className={`h-1.5 rounded-full ${index === frame ? 'w-5 bg-[#FF7A00]' : 'w-1.5 bg-white/40'}`} />
          ))}
        </div>
      ) : null}
      {!compact ? <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[10px] text-white/70">2D image fallback</span> : null}
    </div>
  );
}

export default function Sneaker3DViewer(props: Sneaker3DViewerProps) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [viewerFailed, setViewerFailed] = useState(false);

  useEffect(() => {
    const hasWebGL = (() => {
      try {
        const canvas = document.createElement('canvas');
        return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch {
        return false;
      }
    })();
    setWebgl(hasWebGL);
  }, []);

  useEffect(() => {
    if (webgl && props.modelUrl) void preloadSneaker3DViewer().catch(() => setViewerFailed(true));
  }, [webgl, props.modelUrl]);

  if (webgl === null) return <div className={`w-full animate-pulse rounded-xl bg-[#181818] ${props.compact ? 'h-full' : 'min-h-[250px]'}`} />;
  if (!webgl || !props.modelUrl || viewerFailed) {
    return <TurntableFallback {...props} />;
  }

  return (
    <ErrorBoundary onError={() => setViewerFailed(true)} fallback={<TurntableFallback {...props} />}>
      <Suspense fallback={<TurntableFallback {...props} />}>
        <LazyViewer {...props} onViewerError={() => setViewerFailed(true)} />
      </Suspense>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component<{ onError: () => void; fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}