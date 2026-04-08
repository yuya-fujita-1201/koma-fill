import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePosition, UploadedImage } from '../types';

interface ImageUploaderProps {
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}

function normalizePosition(value: string): ImagePosition {
  if (value === 'start' || value === 'end') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 'start';
}

export default function ImageUploader({ onImagesChange, maxImages = 2 }: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const imagesRef = useRef<UploadedImage[]>([]);
  // コールバックを ref で保持し、依存配列から除外して無限ループを防止
  const onImagesChangeRef = useRef(onImagesChange);
  onImagesChangeRef.current = onImagesChange;

  useEffect(() => {
    imagesRef.current = images;
    onImagesChangeRef.current(images);
  }, [images]);

  // アンマウント時のみ残っているObjectURLを解放
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      setImages((prev) => {
        const remaining = Math.max(maxImages - prev.length, 0);
        const nextFiles = acceptedFiles.slice(0, remaining);
        const next: UploadedImage[] = nextFiles.map((file, index) => ({
          file,
          previewUrl: URL.createObjectURL(file),
          position: prev.length + index === 0 ? ('start' as ImagePosition) : ('end' as ImagePosition),
        }));
        return [...prev, ...next];
      });
    },
    [maxImages]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    maxFiles: maxImages,
    maxSize: 20 * 1024 * 1024,
  });

  const hasLimitReached = images.length >= maxImages;

  const selectablePanels = useMemo(
    () => Array.from({ length: 8 }, (_, i) => i + 1),
    []
  );

  const updatePosition = (index: number, position: ImagePosition) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, position } : img)));
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
          ${hasLimitReached ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}
        `}
      >
        <input {...getInputProps()} disabled={hasLimitReached} />
        <p className="text-sm text-gray-600">ここに画像をドラッグ＆ドロップ、またはクリックして選択</p>
        <p className="mt-1 text-xs text-gray-400">
          JPEG, PNG, WebP（最大{maxImages}枚、各20MBまで）
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {images.map((image, index) => (
            <div key={`${image.file.name}-${index}`} className="overflow-hidden rounded-xl border bg-white">
              <img
                src={image.previewUrl}
                alt={`uploaded-${index}`}
                className="h-24 w-full object-cover"
              />
              <div className="space-y-2 p-3">
                <p className="truncate text-xs text-gray-700" title={image.file.name}>
                  {image.file.name}
                </p>
                <label className="block text-[11px] text-gray-500">ストーリー上の位置</label>
                <select
                  value={String(image.position)}
                  onChange={(e) => updatePosition(index, normalizePosition(e.target.value))}
                  className="w-full rounded border border-gray-300 p-2 text-xs"
                >
                  <option value="start">開始シーン</option>
                  <option value="end">終端シーン</option>
                  {selectablePanels.map((panelNo) => (
                    <option key={panelNo} value={panelNo}>
                      パネル {panelNo}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="w-full rounded bg-red-100 px-3 py-2 text-xs text-red-700 hover:bg-red-200"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
