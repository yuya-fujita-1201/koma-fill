import { useState } from 'react';
import {
  analyzeImages,
  generateImages,
  generateLayout,
  generatePrompts,
  getProject,
  type GenerationProgressEvent,
  uploadImages,
} from '../services/apiClient';
import {
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_LAYOUT_CONFIG,
  GenerationProgress,
  GenerationSettings,
  LayoutConfig,
  MangaProject,
  UploadedImage,
} from '../types';
import { useProject } from './useProject';

export function useMangaGeneration() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [storyPrompt, setStoryPrompt] = useState('');
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(
    DEFAULT_GENERATION_SETTINGS
  );
  const [project, setProject] = useState<MangaProject | null>(null);
  const [progress, setProgress] = useState<GenerationProgress>({
    stage: 'idle',
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    message: '',
  });
  const [error, setError] = useState<string | null>(null);

  const isGenerating = progress.stage !== 'idle';
  const { createProject: createProjectAction } = useProject();

  const addImage = (image: UploadedImage) => {
    setUploadedImages((prev) => {
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, image];
    });
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLayout = (config: Partial<LayoutConfig>) => {
    setLayoutConfig((prev) => ({ ...prev, ...config }));
  };

  const updateGenerationSettings = (settings: Partial<GenerationSettings>) => {
    setGenerationSettings((prev) => ({ ...prev, ...settings }));
  };

  const resetProgress = () => {
    setProgress({
      stage: 'idle',
      currentStep: 0,
      totalSteps: 0,
      percentage: 0,
      message: '',
    });
  };

  const startGeneration = async (
    projectName: string,
    existingProjectId?: string
  ): Promise<string> => {
    if (!projectName.trim()) {
      throw new Error('プロジェクト名を入力してください');
    }
    if (!storyPrompt.trim()) {
      throw new Error('ストーリーを入力してください');
    }
    if (uploadedImages.length < 1 || uploadedImages.length > 2) {
      throw new Error('キー画像は1〜2枚必要です');
    }

    try {
      setError(null);
      setProgress({
        stage: 'uploading',
        currentStep: 1,
        totalSteps: 6,
        percentage: 10,
        message: 'プロジェクトを作成中...',
      });

      let createdProjectId = existingProjectId;

      if (!createdProjectId) {
        const created = await createProjectAction({
          projectName,
          storyPrompt,
          layoutConfig,
          generationSettings,
        });
        createdProjectId = created.id;
      }

      const createdProject = { id: createdProjectId };
      setProgress({
        stage: 'uploading',
        currentStep: 2,
        totalSteps: 6,
        percentage: 25,
        message: 'キー画像をアップロード中...',
      });

      await uploadImages(
        createdProjectId,
        uploadedImages.map((img) => img.file),
        uploadedImages.map((img) => String(img.position))
      );

      setProgress({
        stage: 'analyzing',
        currentStep: 3,
        totalSteps: 6,
        percentage: 40,
        message: 'キー画像を分析中...',
      });
      await analyzeImages(createdProjectId, 'detailed');

      setProgress({
        stage: 'generating_prompts',
        currentStep: 4,
        totalSteps: 6,
        percentage: 55,
        message: 'パネルプロンプトを生成中...',
      });
      await generatePrompts(createdProjectId, storyPrompt, layoutConfig.totalPanels);

      setProgress({
        stage: 'generating_images',
        currentStep: 5,
        totalSteps: 6,
        percentage: 65,
        message: '画像を生成中...',
      });

      await generateImages(
        createdProjectId,
        'sequential',
        (event: GenerationProgressEvent) => {
          if (event.type !== 'progress') {
            return;
          }

          setProgress({
            stage: 'generating_images',
            currentStep: 5,
            totalSteps: 6,
            percentage: 65 + event.percentage * 0.25,
            message: event.message,
            currentPanelIndex: event.panelIndex,
          });
        }
      );

      setProgress({
        stage: 'composing_layout',
        currentStep: 6,
        totalSteps: 6,
        percentage: 92,
        message: 'レイアウトを合成中...',
      });
      await generateLayout(createdProjectId);

      const latest = await getProject(createdProject.id);
      setProject(latest);
      setProgress({
        stage: 'idle',
        currentStep: 6,
        totalSteps: 6,
        percentage: 100,
        message: '漫画の生成が完了しました',
      });

      return createdProjectId;
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成中にエラーが発生しました';
      setError(message);
      resetProgress();
      throw err;
    }
  };

  return {
    uploadedImages,
    storyPrompt,
    layoutConfig,
    generationSettings,
    project,
    progress,
    error,
    isGenerating,
    addImage,
    removeImage,
    setUploadedImages,
    setStoryPrompt,
    updateLayout,
    updateGenerationSettings,
    startGeneration,
    setError,
  };
}
