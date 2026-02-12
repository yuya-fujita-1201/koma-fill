/**
 * koma-fill フロントエンド型定義
 * バックエンドの types.ts と対応
 */

// ============================================
// Core Types (バックエンドと共有)
// ============================================

export type ProjectStatus = 'draft' | 'analyzing' | 'generating' | 'complete' | 'exported';
export type PanelStatus = 'pending' | 'generated' | 'failed' | 'placeholder';
export type LayoutFormat = 'vertical' | 'horizontal' | 'square';
export type ReadingOrder = 'japanese' | 'western';
export type ExportFormat = 'png' | 'jpg' | 'pdf';
export type ImagePosition = 'start' | 'end' | number;

export interface MangaProject {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  layoutConfig: LayoutConfig;
  generationSettings: GenerationSettings;
  panels: Panel[];
  keyImages: KeyImage[];
  totalCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface Panel {
  id: string;
  projectId: string;
  panelIndex: number;
  imageUrl?: string;
  prompt?: string;
  storyBeat?: string;
  speechBubbleText?: string;
  status: PanelStatus;
  retryCount: number;
  generatedAt?: string;
}

export interface KeyImage {
  id: string;
  position: ImagePosition;
  previewUrl: string; // フロントエンド用プレビューURL
  analysis?: ImageAnalysis;
}

export interface ImageAnalysis {
  description: string;
  characters: { name?: string; appearance: string; emotion: string }[];
  mood: string;
  artStyle: string;
}

export interface LayoutConfig {
  totalPanels: number;
  format: LayoutFormat;
  readingOrder: ReadingOrder;
  gutterSize: number;
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  pageWidth: number;
  pageHeight: number;
}

export interface GenerationSettings {
  imageStyle: string;
  aspectRatio: 'square' | 'wide' | 'tall';
  qualityLevel: 'standard' | 'hd';
  negativePrompt?: string;
}

export interface SpeechBubble {
  panelIndex: number;
  text: string;
  position: 'top' | 'middle' | 'bottom';
  style: 'rounded' | 'cloud' | 'spiked' | 'rectangular';
}

// ============================================
// UI State Types
// ============================================

export interface UploadedImage {
  file: File;
  previewUrl: string;
  position: ImagePosition;
}

export interface GenerationProgress {
  stage: 'idle' | 'uploading' | 'analyzing' | 'generating_prompts' | 'generating_images' | 'composing_layout' | 'exporting';
  currentStep: number;
  totalSteps: number;
  percentage: number;
  message: string;
  currentPanelIndex?: number;
}

export interface MangaStore {
  // State
  project: MangaProject | null;
  uploadedImages: UploadedImage[];
  storyPrompt: string;
  layoutConfig: LayoutConfig;
  generationSettings: GenerationSettings;
  progress: GenerationProgress;
  error: string | null;

  // Actions
  setStoryPrompt: (prompt: string) => void;
  addUploadedImage: (image: UploadedImage) => void;
  removeUploadedImage: (index: number) => void;
  updateLayoutConfig: (config: Partial<LayoutConfig>) => void;
  updateGenerationSettings: (settings: Partial<GenerationSettings>) => void;
  setProgress: (progress: Partial<GenerationProgress>) => void;
  setError: (error: string | null) => void;
  setProject: (project: MangaProject | null) => void;
  reset: () => void;
}
