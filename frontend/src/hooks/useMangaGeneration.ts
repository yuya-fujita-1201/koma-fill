import { useCallback } from 'react';
import {
  analyzeImages,
  generateImages,
  generateLayout,
  generatePrompts,
  getProject,
  updatePanel,
  updateProject,
  type GenerationProgressEvent,
  uploadImages,
} from '../services/apiClient';
import {
  LayoutConfig,
  GenerationSettings,
  MangaProject,
  Panel,
  UploadedImage,
} from '../types';
import { useProject } from './useProject';
import { useMangaStore } from '../store/mangaStore';

function buildProjectName(input: string, storyPrompt: string): string {
  const trimmedInput = input.trim();
  if (trimmedInput) {
    return trimmedInput;
  }

  const storySeed = storyPrompt
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

  if (storySeed) {
    return `${storySeed} ${new Date().toLocaleString('ja-JP')}`;
  }

  return `Koma Fill Project ${new Date().toLocaleString('ja-JP')}`;
}

export function useMangaGeneration() {
  // ============================================
  // Individual selectors: 各スライスの変更時のみ再レンダリング
  // useMangaStore() をセレクターなしで呼ぶと全 state 変更で再レンダリングされるため、
  // 個別セレクターを使用する
  // ============================================
  const uploadedImages = useMangaStore((s) => s.uploadedImages);
  const storyPrompt = useMangaStore((s) => s.storyPrompt);
  const layoutConfig = useMangaStore((s) => s.layoutConfig);
  const generationSettings = useMangaStore((s) => s.generationSettings);
  const project = useMangaStore((s) => s.project);
  const progress = useMangaStore((s) => s.progress);
  const error = useMangaStore((s) => s.error);

  // ============================================
  // Actions: Zustand のアクションは安定した参照を持つ
  // ============================================
  const setStoryPrompt = useMangaStore((s) => s.setStoryPrompt);
  const storeAddUploadedImage = useMangaStore((s) => s.addUploadedImage);
  const storeRemoveUploadedImage = useMangaStore((s) => s.removeUploadedImage);
  const storeUpdateLayoutConfig = useMangaStore((s) => s.updateLayoutConfig);
  const storeUpdateGenSettings = useMangaStore((s) => s.updateGenerationSettings);
  const storeSetProgress = useMangaStore((s) => s.setProgress);
  const storeSetError = useMangaStore((s) => s.setError);
  const storeSetProject = useMangaStore((s) => s.setProject);

  const isGenerating = progress.stage !== 'idle';
  const { createProject: createProjectAction } = useProject();

  // ============================================
  // メモ化されたコールバック
  // ============================================
  const addImage = useCallback((image: UploadedImage) => {
    const current = useMangaStore.getState().uploadedImages;
    if (current.length >= 2) {
      return;
    }
    storeAddUploadedImage(image);
  }, [storeAddUploadedImage]);

  const removeImage = useCallback((index: number) => {
    storeRemoveUploadedImage(index);
  }, [storeRemoveUploadedImage]);

  const setUploadedImages = useCallback((images: UploadedImage[]) => {
    useMangaStore.setState({ uploadedImages: images });
  }, []);

  const updateLayout = useCallback((config: Partial<LayoutConfig>) => {
    storeUpdateLayoutConfig(config);
  }, [storeUpdateLayoutConfig]);

  const updateGenerationSettings = useCallback((settings: Partial<GenerationSettings>) => {
    storeUpdateGenSettings(settings);
  }, [storeUpdateGenSettings]);

  const resetProgress = useCallback(() => {
    storeSetProgress({
      stage: 'idle',
      currentStep: 0,
      totalSteps: 0,
      percentage: 0,
      message: '',
    });
  }, [storeSetProgress]);

  const prepareManualDraft = useCallback(async (
    projectName: string,
    existingProjectId?: string
  ): Promise<MangaProject> => {
    const currentState = useMangaStore.getState();
    const resolvedProjectName = buildProjectName(projectName, currentState.storyPrompt);

    if (!currentState.storyPrompt.trim()) {
      throw new Error('ストーリーを入力してください');
    }

    if (existingProjectId) {
      const latest = await updateProject(existingProjectId, {
        projectName: resolvedProjectName,
        storyPrompt: currentState.storyPrompt,
        layoutConfig: currentState.layoutConfig,
        generationSettings: currentState.generationSettings,
      });
      storeSetProject(latest);
      return latest;
    }

    const created = await createProjectAction({
      projectName: resolvedProjectName,
      storyPrompt: currentState.storyPrompt,
      layoutConfig: currentState.layoutConfig,
      generationSettings: currentState.generationSettings,
    });
    storeSetProject(created);
    return created;
  }, [createProjectAction, storeSetProject]);

  const prepareNameDraft = useCallback(async (
    projectName: string,
    existingProjectId?: string
  ): Promise<MangaProject> => {
    const currentState = useMangaStore.getState();
    const resolvedProjectName = buildProjectName(projectName, currentState.storyPrompt);
    const hasKeyImages = currentState.uploadedImages.length > 0;
    const totalSteps = hasKeyImages ? 4 : 2;

    if (!currentState.storyPrompt.trim()) {
      throw new Error('ストーリーを入力してください');
    }

    try {
      storeSetError(null);
      let createdProjectId = existingProjectId;

      if (!createdProjectId) {
        storeSetProgress({
          stage: 'uploading',
          currentStep: 1,
          totalSteps,
          percentage: 15,
          message: 'プロジェクトを作成中...',
        });

        const created = await createProjectAction({
          projectName: resolvedProjectName,
          storyPrompt: currentState.storyPrompt,
          layoutConfig: currentState.layoutConfig,
          generationSettings: currentState.generationSettings,
        });
        createdProjectId = created.id;
      }

      if (createdProjectId) {
        const synced = await updateProject(createdProjectId, {
          projectName: resolvedProjectName,
          storyPrompt: currentState.storyPrompt,
          layoutConfig: currentState.layoutConfig,
          generationSettings: currentState.generationSettings,
        });
        storeSetProject(synced);
      }

      const existingProject = createdProjectId ? await getProject(createdProjectId) : null;
      const hasUploadedKeyImages = (existingProject?.keyImages.length ?? 0) > 0;

      if (hasKeyImages && !hasUploadedKeyImages) {
        storeSetProgress({
          stage: 'uploading',
          currentStep: 2,
          totalSteps,
          percentage: 35,
          message: 'キー画像をアップロード中...',
        });

        await uploadImages(
          createdProjectId,
          currentState.uploadedImages.map((img) => img.file),
          currentState.uploadedImages.map((img) => String(img.position))
        );

        storeSetProgress({
          stage: 'analyzing',
          currentStep: 3,
          totalSteps,
          percentage: 55,
          message: 'キー画像を分析中...',
        });
        await analyzeImages(createdProjectId, 'detailed');
      }

      storeSetProgress({
        stage: 'generating_prompts',
        currentStep: hasKeyImages ? 4 : 2,
        totalSteps,
        percentage: 82,
        message: 'ネーム案を生成中...',
      });
      await generatePrompts(createdProjectId, currentState.storyPrompt, currentState.layoutConfig.totalPanels);

      const latest = await getProject(createdProjectId);
      storeSetProject(latest);
      storeSetProgress({
        stage: 'idle',
        currentStep: totalSteps,
        totalSteps,
        percentage: 100,
        message: 'ネーム案を作成しました',
      });
      return latest;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ネーム案の作成に失敗しました';
      storeSetError(message);
      resetProgress();
      throw err;
    }
  }, [createProjectAction, resetProgress, storeSetError, storeSetProgress, storeSetProject]);

  const savePanelDraft = useCallback(async (
    projectId: string,
    panelIndex: number,
    updates: Partial<Pick<Panel, 'prompt' | 'storyBeat' | 'speechBubbleText'>>
  ) => {
    const updated = await updatePanel(projectId, panelIndex, updates);
    const currentProject = useMangaStore.getState().project;
    if (!currentProject || currentProject.id !== projectId) {
      return updated;
    }

    storeSetProject({
      ...currentProject,
      panels: currentProject.panels.map((panel) =>
        panel.panelIndex === panelIndex ? { ...panel, ...updated } : panel
      ),
    });
    return updated;
  }, [storeSetProject]);

  const startGeneration = useCallback(async (
    projectName: string,
    options?: {
      existingProjectId?: string;
      regeneratePrompts?: boolean;
    }
  ): Promise<string> => {
    const currentState = useMangaStore.getState();
    const resolvedProjectName = buildProjectName(projectName, currentState.storyPrompt);
    const hasKeyImages = currentState.uploadedImages.length > 0;
    const totalSteps = hasKeyImages ? 6 : 4;
    const existingProjectId = options?.existingProjectId;
    const regeneratePrompts = options?.regeneratePrompts ?? true;
    if (!currentState.storyPrompt.trim()) {
      throw new Error('ストーリーを入力してください');
    }
    if (currentState.uploadedImages.length > 2) {
      throw new Error('キー画像は最大2枚までです');
    }

    try {
      storeSetError(null);
      storeSetProgress({
        stage: 'uploading',
        currentStep: 1,
        totalSteps,
        percentage: hasKeyImages ? 10 : 20,
        message: 'プロジェクトを作成中...',
      });

      let createdProjectId = existingProjectId;

      const hasManualDraft = project?.panels.some((panel) => panel.storyBeat || panel.speechBubbleText || panel.prompt);
      const shouldPrepareDraft = !createdProjectId || regeneratePrompts || (!hasManualDraft && !project?.panels.some((panel) => panel.prompt));

      if (shouldPrepareDraft) {
        const latest = await prepareNameDraft(projectName, createdProjectId);
        createdProjectId = latest.id;
      }

      if (!createdProjectId) {
        const created = await createProjectAction({
          projectName: resolvedProjectName,
          storyPrompt: currentState.storyPrompt,
          layoutConfig: currentState.layoutConfig,
          generationSettings: currentState.generationSettings,
        });
        createdProjectId = created.id;
      }

      storeSetProgress({
        stage: 'generating_images',
        currentStep: hasKeyImages ? 5 : 3,
        totalSteps,
        percentage: hasKeyImages ? 65 : 65,
        message: '画像を生成中...',
      });

      await generateImages(
        createdProjectId,
        'sequential',
        (event: GenerationProgressEvent) => {
          if (event.type !== 'progress') {
            return;
          }

          storeSetProgress({
            stage: 'generating_images',
            currentStep: hasKeyImages ? 5 : 3,
            totalSteps,
            percentage: 65 + event.percentage * 0.25,
            message: event.message,
            currentPanelIndex: event.panelIndex,
          });
        }
      );

      storeSetProgress({
        stage: 'composing_layout',
        currentStep: hasKeyImages ? 6 : 4,
        totalSteps,
        percentage: 92,
        message: 'レイアウトを合成中...',
      });
      await generateLayout(createdProjectId);

      const latest = await getProject(createdProjectId);
      storeSetProject(latest);
      storeSetProgress({
        stage: 'idle',
        currentStep: totalSteps,
        totalSteps,
        percentage: 100,
        message: '漫画の生成が完了しました',
      });

      return createdProjectId;
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成中にエラーが発生しました';
      storeSetError(message);
      resetProgress();
      throw err;
    }
  }, [createProjectAction, prepareNameDraft, project?.panels, resetProgress, storeSetError, storeSetProgress, storeSetProject]);

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
    prepareManualDraft,
    prepareNameDraft,
    savePanelDraft,
    startGeneration,
    setError: storeSetError,
  };
}
