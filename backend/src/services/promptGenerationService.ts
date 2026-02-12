/**
 * PromptGenerationService
 * ストーリープロンプト＋画像分析 → 各コマ用DALL-E 3プロンプトを生成
 *
 * 担当: Agent B
 * 依存: openai パッケージ, ImageAnalysis, PanelPrompt
 * 出力: PanelPrompt[] 型
 */

import { ImageAnalysis, PanelPrompt, TransitionType, GenerationSettings } from '../models/types';
import { CONFIG } from '../config/constants';
// import OpenAI from 'openai';

export class PromptGenerationService {
  // TODO: OpenAI クライアント初期化
  // private openai: OpenAI;

  constructor() {
    // TODO: new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY })
  }

  /**
   * メイン：ストーリー＋分析結果 → パネルプロンプト配列を生成
   *
   * @param storyPrompt ユーザーが入力したストーリー/シーン説明
   * @param keyImageAnalyses キー画像の分析結果（1-2件）
   * @param panelCount 生成するパネル数（4, 6, 8）
   * @param settings 画像生成設定（スタイル等）
   * @returns PanelPrompt[]
   *
   * 実装ガイド:
   * 1. GPT-4o を使ってストーリーを「ストーリービート」に分割
   * 2. 各ビートに対して、キー画像の分析結果を参考にDALL-E 3プロンプトを作成
   * 3. キャラクターの一貫性を保つための記述を各プロンプトに含める
   * 4. トランジション情報（カット、パン、ズーム等）も含める
   */
  async generatePanelPrompts(
    storyPrompt: string,
    keyImageAnalyses: ImageAnalysis[],
    panelCount: number,
    settings?: GenerationSettings
  ): Promise<PanelPrompt[]> {
    // TODO: 実装
    // const systemPrompt = buildSystemPrompt(keyImageAnalyses, panelCount, settings);
    //
    // const response = await this.openai.chat.completions.create({
    //   model: CONFIG.PROMPT_MODEL,
    //   messages: [
    //     { role: 'system', content: systemPrompt },
    //     { role: 'user', content: storyPrompt }
    //   ],
    //   response_format: { type: 'json_object' },
    //   max_tokens: 4000,
    // });
    //
    // return parsePanelPrompts(response);

    throw new Error('Not implemented');
  }

  /**
   * 2つのパネル間のトランジションプロンプトを生成
   * （コマとコマの間を補間する場合に使用）
   */
  async generateTransitionPrompt(
    fromAnalysis: ImageAnalysis,
    toAnalysis: ImageAnalysis,
    storyContext: string
  ): Promise<string> {
    // TODO: 前後のパネル情報から中間コマのプロンプトを生成
    throw new Error('Not implemented');
  }

  /**
   * プロンプトの連続性を検証
   * キャラクターの外見、背景、ムードが一貫しているか確認
   */
  async validatePromptContinuity(prompts: PanelPrompt[]): Promise<{
    isConsistent: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    // TODO: 全プロンプトを分析して一貫性をチェック
    throw new Error('Not implemented');
  }
}

// ============================================
// System Prompt テンプレート
// ============================================

/**
 * パネルプロンプト生成用のシステムプロンプトを構築
 */
function buildSystemPrompt(
  keyImageAnalyses: ImageAnalysis[],
  panelCount: number,
  settings?: GenerationSettings
): string {
  const style = settings?.imageStyle || 'manga style, black and white ink drawing';

  const keyImageDescriptions = keyImageAnalyses
    .map((a, i) => `Key Image ${i + 1}: ${a.description}\nCharacters: ${JSON.stringify(a.characters)}\nMood: ${a.mood}\nStyle: ${a.artStyle}`)
    .join('\n\n');

  return `
You are an expert manga storyboard artist. Your job is to create ${panelCount} panel descriptions
for a manga sequence based on the user's story prompt and key image analysis.

## Key Image Analysis:
${keyImageDescriptions}

## Art Style:
${style}

## Output Format:
Return a JSON object with a "panels" array. Each panel should have:
{
  "panels": [
    {
      "panelIndex": 0,
      "dallePrompt": "A detailed visual description for DALL-E 3 (include art style, composition, character details, lighting). Be very specific about visual elements. Always include: '${style}'",
      "storyBeat": "What happens in this panel (1-2 sentences)",
      "visualFocus": "Where the viewer's eye should be drawn",
      "transitionType": "cut|pan|zoom_in|zoom_out|fade|action",
      "suggestedDialogue": "Optional dialogue for speech bubble (null if none)"
    }
  ]
}

## Rules:
1. DALL-E prompts must be self-contained (no references to "previous panel")
2. Include consistent character descriptions in every panel
3. Specify art style in every prompt: "${style}"
4. Panel 0 = opening, last panel = climax/resolution
5. Vary composition (close-up, wide shot, etc.) for visual interest
6. Include mood/atmosphere descriptions
7. Each prompt should be 50-100 words
`;
}

export default PromptGenerationService;
