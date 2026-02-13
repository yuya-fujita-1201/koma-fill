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
  LayoutConfig,
  GenerationSettings,
  UploadedImage,
} from '../types';
import { useProject } from './useProject';
import { useMangaStore } from '../store/mangaStore';

export function useMangaGeneration() {
  const {
    uploadedImages,
    storyPrompt,
    layoutConfig,
    generationSettings,
    progress,
    error,
    setStoryPrompt,
    addUploadedImage,
    removeUploadedImage,
    updateLayoutConfig,
    updateGenerationSettings: updateGenSettings,
    setProgress,
    setError,
    setProject,
  } = useMangaStore();

  const isGenerating = progress.stage !== 'idle';
  const { createProject: createProjectAction } = useProject();

  const addImage = (image: UploadedImage) => {
    if (uploadedImages.length >= 2) {
      return;
    }
    addUploadedImage(image);
  };

  const removeImage = (index: number) => {
    removeUploadedImage(index);
  };

  const setUploadedImages = (images: UploadedImage[]) => {
    useMangaStore.setState({ uploadedImages: images });
  };

  const updateLayout = (config: Partial<LayoutConfig>) => {
    updateLayoutConfig(config);
  };

  const updateGenerationSettings = (settings: Partial<GenerationSettings>) => {
    updateGenSettings(settings);
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
    const currentState = useMangaStore.getState();
    if (!projectName.trim()) {
      throw new Error('プロジェクト名を入力してください');
    }
    if (!currentState.storyPrompt.trim()) {
      throw new Error('ストーリーを入力してください');
    }
    if (currentState.uploadedImages.length < 1 || currentState.uploadedImages.length > 2) {
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
          storyPrompt: currentState.storyPrompt,
          layoutConfig: currentState.layoutConfig,
          generationSettings: currentState.generationSettings,
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
        currentState.uploadedImages.map((img) => img.file),
        currentState.uploadedImages.map((img) => String(img.position))
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
      await generatePrompts(createdProjectId, currentState.storyPrompt, currentState.layoutConfig.totalPanels);

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
    project: useMangaStore.getState().project,
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
