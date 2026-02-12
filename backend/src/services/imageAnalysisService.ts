/**
 * ImageAnalysisService
 * OpenAI Vision API を使ってキー画像を分析する
 *
 * 担当: Agent B
 * 依存: openai パッケージ, CONFIG
 * 出力: ImageAnalysis 型
 */

import { ImageAnalysis, CharacterInfo } from '../models/types';
import { CONFIG } from '../config/constants';
// import OpenAI from 'openai';

export class ImageAnalysisService {
  // TODO: OpenAI クライアント初期化
  // private openai: OpenAI;

  constructor() {
    // TODO: new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY })
  }

  /**
   * 単一画像を分析
   * Vision API に画像を送り、シーン・キャラクター・ムードを抽出
   *
   * @param imageBase64 Base64エンコードされた画像データ
   * @param depth 'quick' = 簡易分析, 'detailed' = 詳細分析
   * @returns ImageAnalysis
   *
   * 実装ガイド:
   * 1. openai.chat.completions.create() で gpt-4o を呼ぶ
   * 2. messages に image_url タイプで Base64 画像を含める
   * 3. system prompt でJSON形式の出力を指示
   * 4. レスポンスをパースして ImageAnalysis 型に変換
   */
  async analyzeImage(imageBase64: string, depth: 'quick' | 'detailed'): Promise<ImageAnalysis> {
    // TODO: 実装
    // const systemPrompt = depth === 'quick'
    //   ? QUICK_ANALYSIS_PROMPT
    //   : DETAILED_ANALYSIS_PROMPT;
    //
    // const response = await this.openai.chat.completions.create({
    //   model: CONFIG.VISION_MODEL,
    //   messages: [
    //     { role: 'system', content: systemPrompt },
    //     { role: 'user', content: [
    //       { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
    //     ]}
    //   ],
    //   response_format: { type: 'json_object' },
    //   max_tokens: depth === 'quick' ? 500 : 2000,
    // });
    //
    // return parseAnalysisResponse(response);

    throw new Error('Not implemented');
  }

  /**
   * 複数画像を一括分析
   */
  async analyzeMultiple(
    images: { base64: string; position: string }[],
    depth: 'quick' | 'detailed'
  ): Promise<ImageAnalysis[]> {
    // TODO: Promise.all で並列分析（レートリミット考慮）
    throw new Error('Not implemented');
  }

  /**
   * 分析結果からキャラクター情報を抽出
   */
  async extractCharacters(analysis: ImageAnalysis): Promise<CharacterInfo[]> {
    // TODO: 既存の分析からキャラ情報を深掘り
    throw new Error('Not implemented');
  }
}

// ============================================
// System Prompts (Vision API用)
// ============================================

export const QUICK_ANALYSIS_PROMPT = `
You are an expert manga/comic analyst. Analyze the provided image and return a JSON object with:
{
  "description": "Brief scene description (1-2 sentences)",
  "characters": [{"appearance": "...", "emotion": "..."}],
  "mood": "overall mood",
  "artStyle": "detected art style",
  "colors": ["dominant colors"],
  "objects": ["notable objects"],
  "composition": "camera angle / framing"
}
Keep responses concise.
`;

export const DETAILED_ANALYSIS_PROMPT = `
You are an expert manga/comic analyst specializing in sequential art.
Analyze the provided image thoroughly and return a JSON object with:
{
  "description": "Detailed scene description (3-5 sentences)",
  "characters": [
    {
      "name": null,
      "appearance": "detailed physical description, clothing, distinguishing features",
      "emotion": "emotional state with nuance",
      "position": "where in the frame (e.g., 'center-left', 'foreground')"
    }
  ],
  "objects": ["all notable objects and props"],
  "colors": ["color palette with hex codes if possible"],
  "composition": "detailed camera angle, framing technique, perspective",
  "mood": "overall atmosphere and emotional tone",
  "artStyle": "specific art style (e.g., 'shounen manga ink', 'watercolor illustration')",
  "suggestedTransitions": [
    "How this scene could transition to the next panel (3 suggestions)"
  ]
}
Be thorough and specific - this analysis will be used to generate consistent intermediate panels.
`;

export default ImageAnalysisService;
