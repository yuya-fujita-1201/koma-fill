/**
 * PromptGenerationService
 * ストーリープロンプト＋画像分析 → 各コマ用画像生成プロンプトを生成
 */

import OpenAI from 'openai';
import {
  GenerationSettings,
  ImageAnalysis,
  PanelPrompt,
  TransitionType,
  DEFAULT_GENERATION_SETTINGS,
} from '../models/types';
import { CONFIG } from '../config/constants';
import { OpenAIError, ValidationError } from '../middleware/errorHandler';

const TRANSITIONS: TransitionType[] = ['cut', 'pan', 'zoom_in', 'zoom_out', 'fade', 'action'];

function inferTransition(index: number, panelCount: number): TransitionType {
  if (index === 0) return 'cut';
  if (index === panelCount - 1) return 'fade';
  if (index % 3 === 0) return 'zoom_in';
  if (index % 2 === 0) return 'pan';
  return 'action';
}

function toPanelPrompt(raw: Record<string, unknown>, index: number, panelCount: number): PanelPrompt {
  const transition = typeof raw.transitionType === 'string' && TRANSITIONS.includes(raw.transitionType as TransitionType)
    ? (raw.transitionType as TransitionType)
    : inferTransition(index, panelCount);
  const dialogue =
    typeof raw.suggestedDialogue === 'string' && raw.suggestedDialogue.trim() && raw.suggestedDialogue.trim().toLowerCase() !== 'null'
      ? raw.suggestedDialogue.trim()
      : undefined;

  return {
    panelIndex: typeof raw.panelIndex === 'number' ? raw.panelIndex : index,
    dallePrompt: typeof raw.dallePrompt === 'string' ? raw.dallePrompt : '',
    storyBeat: typeof raw.storyBeat === 'string' ? raw.storyBeat : '',
    visualFocus: typeof raw.visualFocus === 'string' ? raw.visualFocus : 'main subject',
    transitionType: transition,
    suggestedDialogue: dialogue,
  };
}

export class PromptGenerationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
      organization: CONFIG.OPENAI_ORG_ID,
    });
  }

  async generatePanelPrompts(
    storyPrompt: string,
    keyImageAnalyses: ImageAnalysis[],
    panelCount: number,
    settings?: GenerationSettings
  ): Promise<PanelPrompt[]> {
    if (!CONFIG.OPENAI_API_KEY) {
      throw new OpenAIError('OPENAI_API_KEY is not configured');
    }

    if (!storyPrompt.trim()) {
      throw new ValidationError('storyPrompt is required');
    }
    if (panelCount < 1) {
      throw new ValidationError('panelCount must be >= 1');
    }

    const mergedSettings = {
      ...DEFAULT_GENERATION_SETTINGS,
      ...(settings ?? {}),
    };

    const systemPrompt = buildSystemPrompt(keyImageAnalyses, panelCount, mergedSettings);

    try {
      const response = await this.openai.chat.completions.create({
        model: CONFIG.PROMPT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: storyPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new OpenAIError('Prompt generation response is empty');
      }

      const parsed = JSON.parse(content) as { panels?: Array<Record<string, unknown>> };
      const rawPanels = Array.isArray(parsed.panels) ? parsed.panels : [];

      if (rawPanels.length === 0) {
        throw new OpenAIError('Prompt generation returned empty panels');
      }

      const normalized = rawPanels
        .slice(0, panelCount)
        .map((raw, index) => toPanelPrompt(raw, index, panelCount));

      while (normalized.length < panelCount) {
        const idx = normalized.length;
        normalized.push({
          panelIndex: idx,
          storyBeat: `コマ${idx + 1}の出来事`,
          visualFocus: '主役',
          transitionType: inferTransition(idx, panelCount),
          dallePrompt: `${mergedSettings.imageStyle}。キャラクターの行動と場面の連続性が伝わる漫画コマを描く。`,
        });
      }

      return normalized;
    } catch (err) {
      if (err instanceof ValidationError || err instanceof OpenAIError) {
        throw err;
      }

      const message = err instanceof Error ? err.message : 'Unknown prompt generation error';
      throw new OpenAIError(message);
    }
  }

  async generateTransitionPrompt(
    fromAnalysis: ImageAnalysis,
    toAnalysis: ImageAnalysis,
    storyContext: string
  ): Promise<string> {
    const prompt = [
      'Create one intermediate manga panel prompt that transitions between two scenes.',
      `From scene: ${fromAnalysis.description}`,
      `To scene: ${toAnalysis.description}`,
      `Story context: ${storyContext}`,
      'Keep character appearance and art style consistent.',
    ].join('\n');

    return prompt;
  }

  async validatePromptContinuity(prompts: PanelPrompt[]): Promise<{
    isConsistent: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];

    prompts.forEach((panel, index) => {
      if (!panel.dallePrompt || panel.dallePrompt.trim().length < 20) {
        issues.push(`Panel ${index} prompt is too short`);
      }
      if (!panel.storyBeat || !panel.storyBeat.trim()) {
        issues.push(`Panel ${index} storyBeat is missing`);
      }
    });

    return {
      isConsistent: issues.length === 0,
      issues,
      suggestions: issues.length > 0
        ? ['Add more concrete visual details to short prompts', 'Ensure all panels include clear story beats']
        : ['Prompt sequence looks consistent'],
    };
  }
}

// ============================================
// System Prompt テンプレート
// ============================================

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
あなたは商業漫画のネーム構成を行う編集者兼ネーム作家です。ユーザーのストーリーから、ちょうど ${panelCount} コマ分のネーム案を作ってください。

【重要】
- storyBeat, visualFocus, suggestedDialogue は必ず日本語で書くこと
- dallePrompt も日本語で書くこと
- suggestedDialogue はセリフが不要なら null ではなく空文字 "" を返すこと
- 説明文や前置きは出さず、JSON だけを返すこと

【参照画像分析】
${keyImageDescriptions || '参照画像分析なし'}

【画風】
${style}

【生成条件】
- 対象モデル: ${settings?.imageModel || 'gemini-3.1-flash-image-preview'}
- 参照画像利用: ${settings?.useReferenceImages ? '有効' : '無効'}

【返却形式】
{
  "panels": [
    {
      "panelIndex": 0,
      "dallePrompt": "画像生成モデルに渡せる詳細な視覚プロンプト。画風、構図、人物、背景、光、感情、連続性を含める。",
      "storyBeat": "このコマで何が起きるかを1〜2文で日本語で書く",
      "visualFocus": "視線の中心を日本語で短く書く",
      "transitionType": "cut|pan|zoom_in|zoom_out|fade|action",
      "suggestedDialogue": "吹き出し用の短い日本語セリフ。不要なら空文字"
    }
  ]
}

【ルール】
1. 必ず ${panelCount} コマ返すこと
2. 各コマの出来事は連続した物語として自然につながること
3. キャラクターの見た目、服装、小物、舞台は安定させること
4. 各コマで構図や距離感に変化をつけること
5. 画像プロンプトには必ず画風 "${style}" を反映すること
6. 参照画像に既存の服装、顔、持ち物があるなら維持すること
7. 安全ポリシーに反しない内容にすること
8. セリフは後から吹き出しとして合成するので、画像の中に文字や擬似吹き出しを直接描かないこと
9. コマ画像はフルブリード前提にし、コマの内側に白い余白、額縁、内枠、擬似ガターを入れないこと
10. 必要なら被写体の端が少し切れてもよいので、構図を画面いっぱいに使うこと
`;
}

export default PromptGenerationService;
