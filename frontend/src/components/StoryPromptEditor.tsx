/**
 * StoryPromptEditor - ストーリープロンプト入力コンポーネント
 *
 * 担当: Agent E
 *
 * Props:
 * - value: string
 * - onChange: (value: string) => void
 * - imageStyle: string
 * - onStyleChange: (style: string) => void
 *
 * 機能:
 * - テキストエリアでストーリー入力
 * - 文字数カウンター
 * - スタイルプリセット選択 (manga, comic, watercolor, etc.)
 * - サンプルプロンプト表示
 */

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
  // TODO: [Agent E] テキストエリア + スタイル選択 + サンプル表示
  return (
    <div className="space-y-4">
      <textarea
        className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-y
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="ストーリーを入力してください...&#10;例: 少女が雨の中で子猫を見つけ、傘を差し出して一緒に帰る物語"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex justify-between text-sm text-gray-400">
        <span>{value.length} 文字</span>
        <span>推奨: 50〜300文字</span>
      </div>

      {/* スタイル選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">画風スタイル</label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.value}
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
    </div>
  );
}
