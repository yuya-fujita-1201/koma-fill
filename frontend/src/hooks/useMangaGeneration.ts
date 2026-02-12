/**
 * useMangaGeneration - 漫画生成ワークフローのメインフック
 *
 * 担当: Agent E
 *
 * 役割:
 * - 画像アップロード → 分析 → プロンプト生成 → 画像生成 → レイアウト
 * の全フローを管理
 *
 * 実装ガイド:
 * 1. Zustand store から状態を取得
 * 2. apiClient を使ってバックエンドAPIを呼び出し
 * 3. 各ステップの進捗を ProgressEvent として管理
 * 4. エラーハンドリング＆リトライ
 * 5. SSE (Server-Sent Events) で画像生成の進捗を受信
 */

import { useState } from 'react';
import { GenerationProgress, UploadedImage, LayoutConfig, GenerationSettings } from '../types';

const DEFAULT_LAYOUT: LayoutConfig = {
  totalPanels: 4,
  format: 'vertical',
  readingOrder: 'japanese',
  gutterSize: 10,
  borderWidth: 2,
  borderColor: '#000000',
  backgroundColor: '#FFFFFF',
  pageWidth: 800,
  pageHeight: 1200,
};

export function useMangaGeneration() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [storyPrompt, setStoryPrompt] = useState('');
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(DEFAULT_LAYOUT);
  const [progress, setProgress] = useState<GenerationProgress>({
    stage: 'idle',
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    message: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const isGenerating = progress.stage !== 'idle';

  /**
   * 画像を追加
   */
  const addImage = (image: UploadedImage) => {
    // TODO: [Agent E] 最大2枚チェック
    setUploadedImages((prev) => [...prev, image]);
  };

  /**
   * 画像を削除
   */
  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * レイアウト設定を更新
   */
  const updateLayout = (config: Partial<LayoutConfig>) => {
    setLayoutConfig((prev) => ({ ...prev, ...config }));
  };

  /**
   * 漫画生成フロー開始
   *
   * 実装ガイド:
   * 1. POST /api/manga/create でプロジェクト作成
   * 2. POST /api/manga/:id/upload で画像アップロード
   * 3. POST /api/manga/:id/analyze で画像分析
   * 4. POST /api/manga/:id/generate-prompts でプロンプト生成
   * 5. POST /api/manga/:id/generate-images で画像生成 (SSE)
   * 6. 完了後 /preview/:projectId へ遷移
   */
  const startGeneration = async () => {
    // TODO: [Agent E] 上記フローの実装
    // try {
    //   setError(null);
    //   setProgress({ stage: 'uploading', currentStep: 1, totalSteps: 5, percentage: 0, message: '画像をアップロード中...' });
    //
    //   // Step 1: Create project
    //   const { projectId } = await apiClient.createProject({ ... });
    //   setProjectId(projectId);
    //
    //   // Step 2: Upload images
    //   setProgress({ stage: 'uploading', ... });
    //   await apiClient.uploadImages(projectId, uploadedImages);
    //
    //   // Step 3: Analyze images
    //   setProgress({ stage: 'analyzing', ... });
    //   await apiClient.analyzeImages(projectId);
    //
    //   // Step 4: Generate prompts
    //   setProgress({ stage: 'generating_prompts', ... });
    //   await apiClient.generatePrompts(projectId, storyPrompt, layoutConfig.totalPanels);
    //
    //   // Step 5: Generate images (SSE)
    //   setProgress({ stage: 'generating_images', ... });
    //   await apiClient.generateImages(projectId, (event) => {
    //     setProgress({ ... event });
    //   });
    //
    //   setProgress({ stage: 'idle', ... });
    //   navigate(`/preview/${projectId}`);
    //
    // } catch (err) {
    //   setError(err.message);
    //   setProgress({ stage: 'idle', ... });
    // }
  };

  return {
    uploadedImages,
    storyPrompt,
    layoutConfig,
    progress,
    error,
    projectId,
    isGenerating,
    addImage,
    removeImage,
    setStoryPrompt,
    updateLayout,
    startGeneration,
    setError,
  };
}
