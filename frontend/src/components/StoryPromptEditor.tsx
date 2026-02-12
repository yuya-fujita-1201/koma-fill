interface StoryPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  imageStyle: string;
  onStyleChange: (style: string) => void;
}

const STYLE_PRESETS = [
  { value: 'manga style, black and white ink drawing', label: '漫画（白黒）' },
  { value: 'manga style, full color', label: '漫画（カラー）' },
  { value: 'comic book style, vivid colors', label: 'コミック' },
  { value: 'watercolor illustration', label: '水彩画' },
  { value: 'digital art, anime style', label: 'アニメ風' },
  { value: 'minimalist line art', label: '線画' },
];

const SAMPLE_PROMPTS = [
  '少女が雨の中で子猫を見つけ、傘を差し出して一緒に帰る物語',
  '侍が月明かりの下で桜の木の前に立ち、剣を抜く決意をする場面',
  'ロボットが初めて花を見つけ、その美しさに感動する瞬間',
];

export default function StoryPromptEditor({
  value,
  onChange,
  imageStyle,
  onStyleChange,
}: StoryPromptEditorProps) {
  return (
    <div className="space-y-4">
      <textarea
        className="w-full h-36 p-4 border border-gray-300 rounded-lg resize-y
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="ストーリーを入力してください..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="flex justify-between text-sm text-gray-400">
        <span>{value.length} 文字</span>
        <span>推奨: 50〜300文字</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">画風スタイル</label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`px-3 py-1 rounded-full text-sm border transition-colors
                ${imageStyle === preset.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              onClick={() => onStyleChange(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">サンプルプロンプト</p>
        <div className="space-y-2">
          {SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample}
              type="button"
              className="w-full text-left text-sm border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100"
              onClick={() => onChange(sample)}
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
