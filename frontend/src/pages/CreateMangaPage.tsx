import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ImageUploader from '../components/ImageUploader';
import LayoutSelector from '../components/LayoutSelector';
import ProgressBar from '../components/ProgressBar';
import StoryPromptEditor from '../components/StoryPromptEditor';
import { useMangaGeneration } from '../hooks/useMangaGeneration';

export default function CreateMangaPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');

  const {
    uploadedImages,
    storyPrompt,
    layoutConfig,
    generationSettings,
    progress,
    error,
    isGenerating,
    setUploadedImages,
    setStoryPrompt,
    updateLayout,
    updateGenerationSettings,
    startGeneration,
  } = useMangaGeneration();

  const canSubmit = Boolean(projectName.trim() && storyPrompt.trim() && uploadedImages.length > 0);

  const handleGenerate = async () => {
    try {
      const id = await startGeneration(projectName);
      toast.success('生成が完了しました');
      navigate(`/preview/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成に失敗しました');
    }
  };

  return (
    <div className="space-y-8">
      <section className="bg-white p-6 rounded-xl border space-y-3">
        <h2 className="text-xl font-semibold">0. プロジェクト情報</h2>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="プロジェクト名を入力"
          className="w-full border border-gray-300 rounded-lg p-3"
        />
      </section>

      <section className="bg-white p-6 rounded-xl border space-y-3">
        <h2 className="text-xl font-semibold">1. キー画像をアップロード</h2>
        <p className="text-gray-600 text-sm">最初/最後/任意パネルの参照画像を1〜2枚指定します。</p>
        <ImageUploader onImagesChange={setUploadedImages} />
      </section>

      <section className="bg-white p-6 rounded-xl border space-y-3">
        <h2 className="text-xl font-semibold">2. ストーリーを入力</h2>
        <StoryPromptEditor
          value={storyPrompt}
          onChange={setStoryPrompt}
          imageStyle={generationSettings.imageStyle}
          onStyleChange={(imageStyle) => updateGenerationSettings({ imageStyle })}
        />
      </section>

      <section className="bg-white p-6 rounded-xl border space-y-3">
        <h2 className="text-xl font-semibold">3. レイアウトを選択</h2>
        <LayoutSelector config={layoutConfig} onChange={updateLayout} />
      </section>

      {isGenerating && (
        <section className="bg-white p-6 rounded-xl border">
          <ProgressBar progress={progress} />
        </section>
      )}

      {error && (
        <section className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </section>
      )}

      <section className="flex justify-center">
        <button
          type="button"
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold
                     hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
          disabled={!canSubmit || isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? '生成中...' : '漫画を生成する'}
        </button>
      </section>
    </div>
  );
}
