import { create } from 'zustand';
import { MangaStore, DEFAULT_LAYOUT_CONFIG, DEFAULT_GENERATION_SETTINGS } from '../types';

export const useMangaStore = create<MangaStore>((set) => ({
  project: null,
  uploadedImages: [],
  storyPrompt: '',
  layoutConfig: { ...DEFAULT_LAYOUT_CONFIG },
  generationSettings: { ...DEFAULT_GENERATION_SETTINGS },
  progress: {
    stage: 'idle',
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    message: '',
  },
  error: null,

  setStoryPrompt: (prompt) => set({ storyPrompt: prompt }),
  addUploadedImage: (image) => set((state) => ({
    uploadedImages: [...state.uploadedImages, image],
  })),
  removeUploadedImage: (index) => set((state) => ({
    uploadedImages: state.uploadedImages.filter((_, i) => i !== index),
  })),
  updateLayoutConfig: (config) => set((state) => ({
    layoutConfig: { ...state.layoutConfig, ...config },
  })),
  updateGenerationSettings: (settings) => set((state) => ({
    generationSettings: { ...state.generationSettings, ...settings },
  })),
  setProgress: (progress) => set((state) => ({
    progress: { ...state.progress, ...progress },
  })),
  setError: (error) => set({ error }),
  setProject: (project) => set({ project }),
  reset: () => set({
    project: null,
    uploadedImages: [],
    storyPrompt: '',
    layoutConfig: { ...DEFAULT_LAYOUT_CONFIG },
    generationSettings: { ...DEFAULT_GENERATION_SETTINGS },
    progress: { stage: 'idle', currentStep: 0, totalSteps: 0, percentage: 0, message: '' },
    error: null,
  }),
}));
