/**
 * ExportOptions - エクスポート設定コンポーネント
 *
 * 担当: Agent E
 *
 * Props:
 * - onExport: (options: ExportSettings) => void
 * - isExporting: boolean
 *
 * 機能:
 * - フォーマット選択 (PNG, JPG, PDF)
 * - 解像度選択 (web=72dpi, print=300dpi)
 * - 圧縮レベル選択
 * - ダウンロードボタン
 */

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
  // TODO: [Agent E] useState で設定を管理
  // TODO: [Agent E] フォーマット/解像度/圧縮の選択UI
  // TODO: [Agent E] エクスポートボタン

  return (
    <div className="bg-white p-6 rounded-lg border space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {/* フォーマット */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">フォーマット</label>
          <select className="w-full border rounded-lg p-2">
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        {/* 解像度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">解像度</label>
          <select className="w-full border rounded-lg p-2">
            <option value="web">Web (72dpi)</option>
            <option value="print">印刷 (300dpi)</option>
          </select>
        </div>

        {/* 圧縮 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">品質</label>
          <select className="w-full border rounded-lg p-2">
            <option value="high">高品質</option>
            <option value="medium">標準</option>
            <option value="low">軽量</option>
          </select>
        </div>
      </div>

      <button
        className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold
                   hover:bg-green-700 disabled:bg-gray-300 transition-colors"
        disabled={isExporting}
        onClick={() => onExport({ format: 'png', compression: 'high', resolution: 'web' })}
      >
        {isExporting ? 'エクスポート中...' : 'ダウンロード'}
      </button>
    </div>
  );
}
