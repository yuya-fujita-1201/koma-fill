import { useState } from 'react';
import { ExportFormat } from '../types';

interface ExportSettings {
  format: ExportFormat;
  compression: 'low' | 'medium' | 'high';
  resolution: 'web' | 'print';
}

interface ExportOptionsProps {
  onExport: (options: ExportSettings) => void;
  isExporting: boolean;
}

export default function ExportOptions({ onExport, isExporting }: ExportOptionsProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [resolution, setResolution] = useState<'web' | 'print'>('web');
  const [compression, setCompression] = useState<'low' | 'medium' | 'high'>('medium');

  return (
    <div className="bg-white p-6 rounded-lg border space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">フォーマット</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="w-full border rounded-lg p-2"
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">解像度</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as 'web' | 'print')}
            className="w-full border rounded-lg p-2"
          >
            <option value="web">Web (72dpi)</option>
            <option value="print">印刷 (300dpi)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">品質</label>
          <select
            value={compression}
            onChange={(e) => setCompression(e.target.value as 'low' | 'medium' | 'high')}
            className="w-full border rounded-lg p-2"
          >
            <option value="high">高品質</option>
            <option value="medium">標準</option>
            <option value="low">軽量</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold
                   hover:bg-green-700 disabled:bg-gray-300 transition-colors"
        disabled={isExporting}
        onClick={() => onExport({ format, compression, resolution })}
      >
        {isExporting ? 'エクスポート中...' : `${format.toUpperCase()} でダウンロード`}
      </button>
    </div>
  );
}
