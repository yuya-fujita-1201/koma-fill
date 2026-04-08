import { useState } from 'react';

interface StoryPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  imageStyle: string;
  onStyleChange: (style: string) => void;
  imageModel: string;
  onModelChange: (model: string) => void;
  outputResolution: '1K' | '2K' | '4K';
  onResolutionChange: (resolution: '1K' | '2K' | '4K') => void;
  useReferenceImages: boolean;
  onReferenceModeChange: (enabled: boolean) => void;
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

const MODEL_PRESETS = [
  {
    value: 'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2',
    description: '速度と品質のバランスが良く、通常はこちら。',
  },
  {
    value: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    description: '最も指示追従が強く、高精細向け。',
  },
  {
    value: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    description: '高速生成向け。解像度は1K固定。',
  },
  {
    value: 'dall-e-3',
    label: 'DALL-E 3',
    description: '既存互換のフォールバック。',
  },
] as const;

const RESOLUTION_PRESETS: Array<{ value: '1K' | '2K' | '4K'; label: string }> = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

function buildManualBrief(fields: {
  premise: string;
  beats: string;
  dialogue: string;
  emotion: string;
  composition: string;
}): string {
  return [
    fields.premise.trim() ? `概要:\n${fields.premise.trim()}` : '',
    fields.beats.trim() ? `各コマで起こること:\n${fields.beats.trim()}` : '',
    fields.dialogue.trim() ? `入れたいセリフ:\n${fields.dialogue.trim()}` : '',
    fields.emotion.trim() ? `感情の流れ:\n${fields.emotion.trim()}` : '',
    fields.composition.trim() ? `構図メモ:\n${fields.composition.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export default function StoryPromptEditor({
  value,
  onChange,
  imageStyle,
  onStyleChange,
  imageModel,
  onModelChange,
  outputResolution,
  onResolutionChange,
  useReferenceImages,
  onReferenceModeChange,
}: StoryPromptEditorProps) {
  const isGemini25 = imageModel === 'gemini-2.5-flash-image';
  const isDalle = imageModel === 'dall-e-3';
  const [manualFields, setManualFields] = useState({
    premise: '',
    beats: '',
    dialogue: '',
    emotion: '',
    composition: '',
  });

  const updateField = (key: keyof typeof manualFields, nextValue: string) => {
    setManualFields((current) => ({ ...current, [key]: nextValue }));
  };

  const applyManualBrief = () => {
    const next = buildManualBrief(manualFields);
    if (next) {
      onChange(next);
    }
  };

  const insertTemplate = () => {
    onChange(
      [
        '概要:',
        '主人公が何を望み、何にぶつかるかを簡潔に書く',
        '',
        '各コマで起こること:',
        '1. 導入',
        '2. 変化',
        '3. 山場',
        '4. 余韻',
        '',
        '入れたいセリフ:',
        'パネルごとの仮セリフを書く',
        '',
        '感情の流れ:',
        '驚き -> 迷い -> 決意',
        '',
        '構図メモ:',
        '引き / バストアップ / 手元アップ など',
      ].join('\n')
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-900">ページ下書きメモ</p>
            <p className="text-xs text-amber-800">ここで書いた内容はストーリー本文へ整形して反映します。コマ別の確定入力は 4. コマ別ネーム で行います。</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100"
            onClick={insertTemplate}
          >
            テンプレを本文へ挿入
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <textarea
            className="min-h-20 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm"
            placeholder="概要: 何が起きる話か"
            value={manualFields.premise}
            onChange={(e) => updateField('premise', e.target.value)}
          />
          <textarea
            className="min-h-20 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm"
            placeholder="各コマで起こること"
            value={manualFields.beats}
            onChange={(e) => updateField('beats', e.target.value)}
          />
          <textarea
            className="min-h-20 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm"
            placeholder="入れたいセリフ"
            value={manualFields.dialogue}
            onChange={(e) => updateField('dialogue', e.target.value)}
          />
          <textarea
            className="min-h-20 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm"
            placeholder="感情の流れ"
            value={manualFields.emotion}
            onChange={(e) => updateField('emotion', e.target.value)}
          />
        </div>

        <textarea
          className="min-h-16 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm"
          placeholder="構図メモ: カメラ距離、見せたい手や顔、視線方向"
          value={manualFields.composition}
          onChange={(e) => updateField('composition', e.target.value)}
        />

        <button
          type="button"
          className="rounded-lg bg-amber-900 px-4 py-2 text-sm text-white hover:bg-amber-950"
          onClick={applyManualBrief}
        >
          メモを本文へ反映
        </button>
      </div>

      <textarea
        className="h-28 w-full resize-y rounded-xl border border-gray-300 p-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
        placeholder="ストーリーを入力してください..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{value.length}文字</span>
        <span>推奨 50〜300文字</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
        ここにはページ全体の要約や意図を書きます。各コマの最終的な出来事・セリフは 4. コマ別ネーム で確定します。
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">画風スタイル</label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                imageStyle === preset.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400'
              }`}
              onClick={() => onStyleChange(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <details className="rounded-xl border border-gray-200 bg-gray-50/70" open>
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          生成設定
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <div className="grid gap-2 md:grid-cols-2">
            {MODEL_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  imageModel === preset.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
                onClick={() => onModelChange(preset.value)}
              >
                <div className="text-sm font-semibold text-gray-900">{preset.label}</div>
                <div className="mt-1 text-[11px] leading-4 text-gray-500">{preset.description}</div>
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">出力解像度</label>
              <div className="flex flex-wrap gap-2">
                {RESOLUTION_PRESETS.map((preset) => {
                  const disabled = isGemini25 && preset.value !== '1K';
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={disabled}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        outputResolution === preset.value
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                      } disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400`}
                      onClick={() => onResolutionChange(preset.value)}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {isGemini25 && <p className="text-[11px] text-gray-500">Nano Banana は 1K 固定です。</p>}
              {isDalle && <p className="text-[11px] text-gray-500">DALL-E 3 では既存サイズ制約が優先されます。</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">参照画像</label>
              <button
                type="button"
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  useReferenceImages
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
                onClick={() => onReferenceModeChange(!useReferenceImages)}
              >
                <div className="text-sm font-semibold text-gray-900">{useReferenceImages ? '有効' : '無効'}</div>
                <div className="mt-1 text-[11px] leading-4 text-gray-500">
                  キー画像と前コマを参照して連続性を保ちます。
                </div>
              </button>
            </div>
          </div>
        </div>
      </details>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">サンプル</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample}
              type="button"
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
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
