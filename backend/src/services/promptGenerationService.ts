/**
 * PromptGenerationService
 * ストーリープロンプト＋画像分析 → 各コマ用DALL-E 3プロンプトを生成
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

  return {
    panelIndex: typeof raw.panelIndex === 'number' ? raw.panelIndex : index,
    dallePrompt: typeof raw.dallePrompt === 'string' ? raw.dallePrompt : '',
    storyBeat: typeof raw.storyBeat === 'string' ? raw.storyBeat : '',
    visualFocus: typeof raw.visualFocus === 'string' ? raw.visualFocus : 'main subject',
    transitionType: transition,
    suggestedDialogue: typeof raw.suggestedDialogue === 'string' ? raw.suggestedDialogue : undefined,
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
          storyBeat: `Panel ${idx + 1} continuation`,
          visualFocus: 'main subject',
          transitionType: inferTransition(idx, panelCount),
          dallePrompt: `Create a manga panel in ${mergedSettings.imageStyle}. Show clear character action and scene continuity.`,
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
You are an expert manga storyboard artist. Your job is to create exactly ${panelCount} panel descriptions
for a manga sequence based on the user's story prompt and key image analysis.

## Key Image Analysis:
${keyImageDescriptions || 'No key image analysis provided.'}

## Art Style:
${style}

## Output Format:
Return a JSON object with a "panels" array. Each panel should have:
{
  "panels": [
    {
      "panelIndex": 0,
      "dallePrompt": "A detailed visual description for DALL-E 3 (100-300 words). Include art style, composition, character details, lighting, and concrete visual actions.",
      "storyBeat": "What happens in this panel (1-2 sentences)",
      "visualFocus": "Where the viewer's eye should be drawn",
      "transitionType": "cut|pan|zoom_in|zoom_out|fade|action",
      "suggestedDialogue": "Optional dialogue for speech bubble (null if none)"
    }
  ]
}

## Rules:
1. Create exactly ${panelCount} panels.
2. DALL-E prompts must be self-contained.
3. Maintain character consistency and recurring traits.
4. Include style phrase in each prompt: "${style}".
5. Vary shot composition and framing across panels.
6. Respect safety and content policy constraints.
`;
}

export default PromptGenerationService;
