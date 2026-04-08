import React, { useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';

interface MangaLayoutViewerProps {
  imageUrl: string;
  alt?: string;
  dimensions?: { width: number; height: number };
  showControls?: boolean;
  enableWheelZoom?: boolean;
  align?: 'center' | 'top';
}

export function MangaLayoutViewer({
  imageUrl,
  alt = 'Manga Layout',
  dimensions,
  showControls = true,
  enableWheelZoom = true,
  align = 'center',
}: MangaLayoutViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!enableWheelZoom || (!e.ctrlKey && !e.metaKey)) {
      return;
    }
    e.preventDefault();
    setZoom((prev) => {
      if (e.deltaY < 0) {
        return Math.min(prev + 0.1, 3);
      }
      return Math.max(prev - 0.1, 0.25);
    });
  }, [enableWheelZoom]);

  const containerClass = isFullScreen
    ? 'fixed inset-0 z-50 bg-gray-900 flex flex-col'
    : 'relative bg-gray-100 rounded-lg overflow-hidden';

  return (
    <div className={containerClass} ref={containerRef}>
      {showControls && (
        <div className="flex items-center gap-2 bg-gray-800 p-2 text-white">
          <button onClick={handleZoomOut} className="rounded p-1 hover:bg-gray-700" title="ズームアウト" type="button">
            <ZoomOut size={20} />
          </button>
          <span className="min-w-[4rem] text-center text-sm">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="rounded p-1 hover:bg-gray-700" title="ズームイン" type="button">
            <ZoomIn size={20} />
          </button>
          <button onClick={() => setZoom(1)} className="rounded px-2 py-1 text-xs hover:bg-gray-700" type="button">
            リセット
          </button>
          <div className="flex-1" />
          <button onClick={() => setIsFullScreen((prev) => !prev)} className="rounded p-1 hover:bg-gray-700" type="button" title="フルスクリーン">
            {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          {dimensions && (
            <span className="text-xs text-gray-400">
              {dimensions.width} × {dimensions.height}
            </span>
          )}
        </div>
      )}

      <div
        className={`flex-1 overflow-auto p-4 ${align === 'top' ? 'flex items-start justify-center' : 'flex items-center justify-center'}`}
        onWheel={handleWheel}
      >
        <img
          src={imageUrl}
          alt={alt}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: align === 'top' ? 'top center' : 'center center',
            transition: 'transform 0.1s ease-out',
            maxWidth: 'none',
          }}
          className="select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
