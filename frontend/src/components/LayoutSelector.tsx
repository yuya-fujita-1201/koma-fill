/**
 * LayoutSelector - レイアウト設定コンポーネント
 *
 * 担当: Agent E
 *
 * Props:
 * - config: LayoutConfig
 * - onChange: (config: Partial<LayoutConfig>) => void
 *
 * 機能:
 * - パネル数選択 (4, 6, 8)
 * - フォーマット選択 (vertical, horizontal, square)
 * - 読み順選択 (japanese=右→左, western=左→右)
 * - レイアウトプレビュー（ミニチュア）
 */

import { LayoutConfig, LayoutFormat, ReadingOrder } from '../types';

interface LayoutSelectorProps {
  config: LayoutConfig;
  onChange: (config: Partial<LayoutConfig>) => void;
}

const PANEL_OPTIONS = [4, 6, 8];
const FORMAT_OPTIONS: { value: LayoutFormat; label: string }[] = [
  { value: 'vertical', label: '縦読み' },
  { value: 'horizontal', label: '横読み' },
  { value: 'square', label: '正方形' },
];
const READING_OPTIONS: { value: ReadingOrder; label: string }[] = [
  { value: 'japanese', label: '右→左（日本式）' },
  { value: 'western', label: '左→右（西洋式）' },
];

export default function LayoutSelector({ config, onChange }: LayoutSelectorProps) {
  return (
    <div className="space-y-6">
      {/* パネル数 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">パネル数</label>
        <div className="flex gap-3">
          {PANEL_OPTIONS.map((n) => (
            <button
              key={n}
              className={`px-6 py-3 rounded-lg border-2 font-semibold transition-colors
                ${config.totalPanels === n
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                }`}
              onClick={() => onChange({ totalPanels: n })}
            >
              {n}コマ
            </button>
          ))}
        </div>
      </div>

      {/* フォーマット */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">フォーマット</label>
        <div className="flex gap-3">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`px-4 py-2 rounded-lg border-2 transition-colors
                ${config.format === opt.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                }`}
              onClick={() => onChange({ format: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 読み順 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">読み順</label>
        <div className="flex gap-3">
          {READING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`px-4 py-2 rounded-lg border-2 transition-colors
                ${config.readingOrder === opt.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                }`}
              onClick={() => onChange({ readingOrder: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
