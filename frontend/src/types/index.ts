/**
 * koma-fill フロントエンド型定義
 * バックエンドの types.ts と対応
 */

export type ProjectStatus = 'draft' | 'analyzing' | 'generating' | 'complete' | 'exported';
export type PanelStatus = 'pending' | 'generated' | 'failed' | 'placeholder';
export type LayoutFormat = 'vertical' | 'horizontal' | 'square';
export type ReadingOrder = 'japanese' | 'western';
export type LayoutTemplateId =
  | 'conversation_grid_4'
  | 'intro_top_wide_4'
  | 'hero_focus_5'
  | 'action_flow_5'
  | 'quiet_vertical_4'
  | 'montage_mosaic_6';
export type ExportFormat = 'png' | 'jpg' | 'pdf';
export type ImagePosition = 'start' | 'end' | number;
export type ImageModel =
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3-pro-image-preview'
  | 'gemini-2.5-flash-image'
  | 'dall-e-3';
export type OutputResolution = '1K' | '2K' | '4K';

export interface LayoutTemplatePreviewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutTemplateDefinition {
  id: LayoutTemplateId;
  label: string;
  shortLabel: string;
  description: string;
  totalPanels: number;
  preview: LayoutTemplatePreviewRect[];
}

export const LAYOUT_TEMPLATES: LayoutTemplateDefinition[] = [
  {
    id: 'conversation_grid_4',
    label: '標準会話',
    shortLabel: '会話',
    description: '読みやすい2x2。会話や状況説明の基本形。',
    totalPanels: 4,
    preview: [
      { x: 0.05, y: 0.05, w: 0.42, h: 0.42 },
      { x: 0.53, y: 0.05, w: 0.42, h: 0.42 },
      { x: 0.05, y: 0.53, w: 0.42, h: 0.42 },
      { x: 0.53, y: 0.53, w: 0.42, h: 0.42 },
    ],
  },
  {
    id: 'intro_top_wide_4',
    label: '導入ワイド',
    shortLabel: '導入',
    description: '1コマ目を横長で大きく見せる導入向け。',
    totalPanels: 4,
    preview: [
      { x: 0.05, y: 0.05, w: 0.90, h: 0.24 },
      { x: 0.05, y: 0.35, w: 0.42, h: 0.60 },
      { x: 0.53, y: 0.35, w: 0.42, h: 0.26 },
      { x: 0.53, y: 0.69, w: 0.42, h: 0.26 },
    ],
  },
  {
    id: 'hero_focus_5',
    label: '見せゴマ強調',
    shortLabel: '見せ場',
    description: '大きい主役コマを中心に据える見せ場構成。',
    totalPanels: 5,
    preview: [
      { x: 0.05, y: 0.05, w: 0.58, h: 0.56 },
      { x: 0.69, y: 0.05, w: 0.26, h: 0.26 },
      { x: 0.69, y: 0.35, w: 0.26, h: 0.26 },
      { x: 0.05, y: 0.67, w: 0.42, h: 0.28 },
      { x: 0.53, y: 0.67, w: 0.42, h: 0.28 },
    ],
  },
  {
    id: 'action_flow_5',
    label: 'アクション流し',
    shortLabel: 'アクション',
    description: '中央ワイドで動線を作る勢い重視の構成。',
    totalPanels: 5,
    preview: [
      { x: 0.05, y: 0.05, w: 0.42, h: 0.26 },
      { x: 0.53, y: 0.05, w: 0.42, h: 0.26 },
      { x: 0.10, y: 0.37, w: 0.80, h: 0.22 },
      { x: 0.05, y: 0.67, w: 0.42, h: 0.28 },
      { x: 0.53, y: 0.67, w: 0.42, h: 0.28 },
    ],
  },
  {
    id: 'quiet_vertical_4',
    label: '静かな間',
    shortLabel: '静寂',
    description: '縦のリズムで余韻を作る静かなページ向け。',
    totalPanels: 4,
    preview: [
      { x: 0.08, y: 0.05, w: 0.84, h: 0.17 },
      { x: 0.08, y: 0.28, w: 0.84, h: 0.17 },
      { x: 0.08, y: 0.51, w: 0.84, h: 0.17 },
      { x: 0.08, y: 0.74, w: 0.84, h: 0.17 },
    ],
  },
  {
    id: 'montage_mosaic_6',
    label: '回想モンタージュ',
    shortLabel: '回想',
    description: 'サイズ差のある断片コマで情報量を出す構成。',
    totalPanels: 6,
    preview: [
      { x: 0.05, y: 0.05, w: 0.42, h: 0.24 },
      { x: 0.53, y: 0.05, w: 0.42, h: 0.24 },
      { x: 0.05, y: 0.34, w: 0.26, h: 0.24 },
      { x: 0.37, y: 0.34, w: 0.58, h: 0.24 },
      { x: 0.05, y: 0.63, w: 0.42, h: 0.24 },
      { x: 0.53, y: 0.63, w: 0.42, h: 0.24 },
    ],
  },
];

export function getLayoutTemplate(id: LayoutTemplateId): LayoutTemplateDefinition {
  return LAYOUT_TEMPLATES.find((template) => template.id === id) ?? LAYOUT_TEMPLATES[0];
}

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
  imageFilePath?: string;
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
  imageFilePath?: string;
  previewUrl?: string;
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
  layoutTemplate: LayoutTemplateId;
  format: LayoutFormat;
  readingOrder: ReadingOrder;
  gutterSize: number;
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  pageWidth: number;
  pageHeight: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  totalPanels: 4,
  layoutTemplate: 'conversation_grid_4',
  format: 'vertical',
  readingOrder: 'japanese',
  gutterSize: 10,
  borderWidth: 2,
  borderColor: '#000000',
  backgroundColor: '#FFFFFF',
  pageWidth: 840,
  pageHeight: 1188,
};

export interface GenerationSettings {
  imageStyle: string;
  aspectRatio: 'square' | 'wide' | 'tall';
  qualityLevel: 'standard' | 'hd';
  imageModel: ImageModel;
  outputResolution: OutputResolution;
  useReferenceImages: boolean;
  negativePrompt?: string;
}

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  imageStyle: 'manga style, black and white ink drawing',
  aspectRatio: 'square',
  qualityLevel: 'standard',
  imageModel: 'gemini-3.1-flash-image-preview',
  outputResolution: '2K',
  useReferenceImages: true,
};

export interface SpeechBubble {
  panelIndex: number;
  text: string;
  position: 'top' | 'middle' | 'bottom';
  style: 'rounded' | 'cloud' | 'spiked' | 'rectangular';
}

export interface UploadedImage {
  file: File;
  previewUrl: string;
  position: ImagePosition;
}

export interface GenerationProgress {
  stage:
    | 'idle'
    | 'uploading'
    | 'analyzing'
    | 'generating_prompts'
    | 'generating_images'
    | 'composing_layout'
    | 'exporting';
  currentStep: number;
  totalSteps: number;
  percentage: number;
  message: string;
  currentPanelIndex?: number;
}

export interface MangaStore {
  project: MangaProject | null;
  uploadedImages: UploadedImage[];
  storyPrompt: string;
  layoutConfig: LayoutConfig;
  generationSettings: GenerationSettings;
  progress: GenerationProgress;
  error: string | null;

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
