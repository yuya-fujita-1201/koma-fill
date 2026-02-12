/**
 * CreateMangaPage - メインワークフローページ
 *
 * 担当: Agent E
 *
 * ワークフロー:
 * 1. キー画像アップロード (ImageUploader)
 * 2. ストーリープロンプト入力 (StoryPromptEditor)
 * 3. レイアウト選択 (LayoutSelector)
 * 4. 生成実行 → プレビューページへ遷移
 *
 * 状態管理: useMangaGeneration フックで一元管理
 */

// TODO: [Agent E] 以下のコンポーネントを組み合わせてページを構築
// import ImageUploader from '../components/ImageUploader';
// import StoryPromptEditor from '../components/StoryPromptEditor';
// import LayoutSelector from '../components/LayoutSelector';
// import { useMangaGeneration } from '../hooks/useMangaGeneration';

export default function CreateMangaPage() {
  // TODO: [Agent E] useMangaGeneration フックからstate/actionsを取得
  // const {
  //   uploadedImages, storyPrompt, layoutConfig, progress, error,
  //   addImage, removeImage, setStoryPrompt, updateLayout,
  //   startGeneration, isGenerating,
  // } = useMangaGeneration();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-4">1. キー画像をアップロード</h2>
        <p className="text-gray-600 mb-4">
          最初のコマ、最後のコマ、または途中のコマの画像を1〜2枚アップロードしてください。
        </p>
        {/* TODO: <ImageUploader /> */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-400">
          ImageUploader コンポーネント（未実装）
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">2. ストーリーを入力</h2>
        {/* TODO: <StoryPromptEditor /> */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
          StoryPromptEditor コンポーネント（未実装）
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">3. レイアウトを選択</h2>
        {/* TODO: <LayoutSelector /> */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
          LayoutSelector コンポーネント（未実装）
        </div>
      </section>

      <section className="flex justify-center">
        <button
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold
                     hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
          disabled={true} // TODO: バリデーション条件
        >
          漫画を生成する
        </button>
      </section>
    </div>
  );
}
