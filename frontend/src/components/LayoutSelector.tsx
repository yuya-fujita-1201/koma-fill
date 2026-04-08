import {
  LayoutConfig,
  LayoutFormat,
  LAYOUT_TEMPLATES,
  ReadingOrder,
} from '../types';

interface LayoutSelectorProps {
  config: LayoutConfig;
  onChange: (config: Partial<LayoutConfig>) => void;
}

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
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          ページテンプレート
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          {LAYOUT_TEMPLATES.map((template) => {
            const selected = config.layoutTemplate === template.id;
            return (
              <button
                key={template.id}
                type="button"
                className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                  selected
                    ? 'border-blue-600 bg-blue-50 shadow-sm shadow-blue-100/60'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
                onClick={() =>
                  onChange({
                    layoutTemplate: template.id,
                    totalPanels: template.totalPanels,
                  })}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{template.label}</div>
                    <p className="mt-1 text-[11px] leading-4 text-gray-500">
                      {template.description}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
                    {template.totalPanels}コマ
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {template.preview.map((_, index) => (
                    <span
                      key={`${template.id}-thumb-${index}`}
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                        selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">フォーマット</label>
        <div className="flex flex-wrap gap-3">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                config.format === opt.value
                  ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
              }`}
              onClick={() => onChange({ format: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">読み順</label>
        <div className="flex flex-wrap gap-3">
          {READING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                config.readingOrder === opt.value
                  ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
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
