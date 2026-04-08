/**
 * koma-fill 共有型定義
 * バックエンド全サービスで使用するインターフェース
 */

// ============================================
// プロジェクト関連
// ============================================

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

export interface LayoutTemplateDefinition {
  id: LayoutTemplateId;
  label: string;
  description: string;
  totalPanels: number;
}

export const LAYOUT_TEMPLATES: LayoutTemplateDefinition[] = [
  {
    id: 'conversation_grid_4',
    label: '標準会話',
    description: '読みやすい2x2。会話や状況説明の基本形。',
    totalPanels: 4,
  },
  {
    id: 'intro_top_wide_4',
    label: '導入ワイド',
    description: '1コマ目を横長で大きく見せる導入向け。',
    totalPanels: 4,
  },
  {
    id: 'hero_focus_5',
    label: '見せゴマ強調',
    description: '大きい主役コマを中心に据える見せ場構成。',
    totalPanels: 5,
  },
  {
    id: 'action_flow_5',
    label: 'アクション流し',
    description: '中央ワイドで動線を作る勢い重視の構成。',
    totalPanels: 5,
  },
  {
    id: 'quiet_vertical_4',
    label: '静かな間',
    description: '縦のリズムで余韻を作る静かなページ向け。',
    totalPanels: 4,
  },
  {
    id: 'montage_mosaic_6',
    label: '回想モンタージュ',
    description: 'サイズ差のある断片コマで情報量を出す構成。',
    totalPanels: 6,
  },
];

export const LAYOUT_TEMPLATE_IDS = LAYOUT_TEMPLATES.map((template) => template.id) as LayoutTemplateId[];

export function getLayoutTemplateDefinition(id?: LayoutTemplateId): LayoutTemplateDefinition {
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
  createdAt: string;
}

export interface KeyImage {
  id: string;
  projectId: string;
  imageFilePath: string;
  position: ImagePosition;
  analysis?: ImageAnalysis;
  createdAt: string;
}

// ============================================
// 画像分析 (Vision API)
// ============================================

export interface ImageAnalysis {
  description: string;
  characters: CharacterInfo[];
  objects: string[];
  colors: string[];
  composition: string;
  mood: string;
  artStyle: string;
  suggestedTransitions: string[];
}

export interface CharacterInfo {
  name?: string;
  appearance: string;
  emotion: string;
  position: string; // 画面上の位置（左上、中央、等）
}

// ============================================
// プロンプト生成
// ============================================

export interface PanelPrompt {
  panelIndex: number;
  dallePrompt: string;     // DALL-E 3 に送るフルプロンプト
  storyBeat: string;       // このコマで何が起きるか
  visualFocus: string;     // 視覚的焦点
  transitionType: TransitionType;
  suggestedDialogue?: string;
}

export type TransitionType = 'cut' | 'pan' | 'zoom_in' | 'zoom_out' | 'fade' | 'action';

// ============================================
// レイアウト設定
// ============================================

export interface LayoutConfig {
  totalPanels: number;     // 4, 6, 8, etc.
  layoutTemplate: LayoutTemplateId;
  format: LayoutFormat;
  readingOrder: ReadingOrder;
  gutterSize: number;      // px
  borderWidth: number;     // px
  borderColor: string;     // hex
  backgroundColor: string; // hex
  pageWidth: number;       // px
  pageHeight: number;      // px
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

// ============================================
// 画像生成設定
// ============================================

export interface GenerationSettings {
  imageStyle: string;      // "manga", "comic", "watercolor", etc.
  aspectRatio: 'square' | 'wide' | 'tall';
  qualityLevel: 'standard' | 'hd';
  imageModel: ImageModel;
  outputResolution: OutputResolution;
  useReferenceImages: boolean;
  negativePrompt?: string;
  seed?: number;
}

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  imageStyle: 'manga style, black and white ink drawing',
  aspectRatio: 'square',
  qualityLevel: 'standard',
  imageModel: 'gemini-3.1-flash-image-preview',
  outputResolution: '2K',
  useReferenceImages: true,
};

// ============================================
// API リクエスト/レスポンス
// ============================================

// POST /api/manga/create
export interface CreateMangaRequest {
  projectName: string;
  storyPrompt: string;
  layoutConfig?: Partial<LayoutConfig>;
  generationSettings?: Partial<GenerationSettings>;
}

// POST /api/manga/:projectId/analyze
export interface AnalyzeImagesRequest {
  analysisDepth: 'quick' | 'detailed';
}

// POST /api/manga/:projectId/generate-prompts
export interface GeneratePromptsRequest {
  storyPrompt: string;
  panelCount: number;
  characterConsistency: boolean;
}

// POST /api/manga/:projectId/generate-images
export interface GenerateImagesRequest {
  panelIndices?: number[];  // 未指定なら全パネル
  batchMode: 'sequential' | 'parallel';
}

// POST /api/manga/:projectId/regenerate/:panelIndex
export interface RegeneratePanelRequest {
  newPrompt?: string;
}

// PUT /api/manga/:projectId/reorder
export interface ReorderPanelsRequest {
  panelOrder: number[];
}

// PUT /api/manga/:projectId/panels/:panelIndex
export interface UpdatePanelRequest {
  prompt?: string;
  storyBeat?: string;
  speechBubbleText?: string;
}

export interface UpdateProjectRequest {
  projectName?: string;
  storyPrompt?: string;
  layoutConfig?: Partial<LayoutConfig>;
  generationSettings?: Partial<GenerationSettings>;
}

// POST /api/manga/:projectId/layout
export interface GenerateLayoutRequest {
  speechBubbles?: SpeechBubble[];
}

// POST /api/manga/:projectId/export
export interface ExportRequest {
  format: ExportFormat;
  compression: 'low' | 'medium' | 'high';
  resolution: 'web' | 'print';
  title?: string;
  author?: string;
}

export interface SpeechBubble {
  panelIndex: number;
  text: string;
  position: 'top' | 'middle' | 'bottom';
  style: 'rounded' | 'cloud' | 'spiked' | 'rectangular';
}

// ============================================
// 進捗トラッキング
// ============================================

export interface ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  stage: string;
  currentStep: number;
  totalSteps: number;
  percentage: number;
  message: string;
  panelId?: string;
  panelIndex?: number;
  error?: string;
}

// ============================================
// コスト管理
// ============================================

export interface CostEstimate {
  visionApiCalls: number;
  dalleApiCalls: number;
  estimatedCostUsd: number;
}

export const API_COSTS = {
  VISION_PER_CALL: 0.025,    // GPT-4V ~$0.025/image
  DALLE3_STANDARD: 0.040,    // DALL-E 3 standard
  DALLE3_HD: 0.080,          // DALL-E 3 HD
} as const;
