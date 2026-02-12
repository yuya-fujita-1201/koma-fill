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

  useEffect(() => {
    imagesRef.current = images;
    onImagesChange(images);
  }, [images, onImagesChange]);

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
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
          ${hasLimitReached ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}
        `}
      >
        <input {...getInputProps()} disabled={hasLimitReached} />
        <p className="text-gray-600">ここに画像をドラッグ＆ドロップ、またはクリックして選択</p>
        <p className="text-sm text-gray-400 mt-2">
          JPEG, PNG, WebP（最大{maxImages}枚、各20MBまで）
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {images.map((image, index) => (
            <div key={`${image.file.name}-${index}`} className="border rounded-lg overflow-hidden bg-white">
              <img
                src={image.previewUrl}
                alt={`uploaded-${index}`}
                className="w-full h-48 object-cover"
              />
              <div className="p-3 space-y-2">
                <p className="text-sm text-gray-700 truncate" title={image.file.name}>
                  {image.file.name}
                </p>
                <label className="block text-xs text-gray-500">ストーリー上の位置</label>
                <select
                  value={String(image.position)}
                  onChange={(e) => updatePosition(index, normalizePosition(e.target.value))}
                  className="w-full border border-gray-300 rounded p-2 text-sm"
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
                  className="w-full text-sm px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
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
