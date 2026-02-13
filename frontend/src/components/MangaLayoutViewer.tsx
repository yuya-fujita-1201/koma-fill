import React, { useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';

interface MangaLayoutViewerProps {
  imageUrl: string;
  alt?: string;
  dimensions?: { width: number; height: number };
}

export function MangaLayoutViewer({
  imageUrl,
  alt = 'Manga Layout',
  dimensions,
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
    e.preventDefault();
    setZoom((prev) => {
      if (e.deltaY < 0) {
        return Math.min(prev + 0.1, 3);
      }
      return Math.max(prev - 0.1, 0.25);
    });
  }, []);

  const containerClass = isFullScreen
    ? 'fixed inset-0 z-50 bg-gray-900 flex flex-col'
    : 'relative bg-gray-100 rounded-lg overflow-hidden';

  return (
    <div className={containerClass} ref={containerRef}>
      <div className="flex items-center gap-2 p-2 bg-gray-800 text-white">
        <button onClick={handleZoomOut} className="p-1 hover:bg-gray-700 rounded" title="ズームアウト" type="button">
          <ZoomOut size={20} />
        </button>
        <span className="text-sm min-w-[4rem] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} className="p-1 hover:bg-gray-700 rounded" title="ズームイン" type="button">
          <ZoomIn size={20} />
        </button>
        <button onClick={() => setZoom(1)} className="px-2 py-1 text-xs hover:bg-gray-700 rounded" type="button">
          リセット
        </button>
        <div className="flex-1" />
        <button onClick={() => setIsFullScreen((prev) => !prev)} className="p-1 hover:bg-gray-700 rounded" type="button" title="フルスクリーン">
          {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
        {dimensions && (
          <span className="text-xs text-gray-400">
            {dimensions.width} × {dimensions.height}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-4" onWheel={handleWheel}>
        <img
          src={imageUrl}
          alt={alt}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out', maxWidth: 'none' }}
          className="select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
