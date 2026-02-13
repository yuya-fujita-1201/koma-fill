/**
 * ImageAnalysisService
 * OpenAI Vision API を使ってキー画像を分析する
 */

import OpenAI from 'openai';
import { CharacterInfo, ImageAnalysis } from '../models/types';
import { CONFIG } from '../config/constants';
import { OpenAIError, ValidationError } from '../middleware/errorHandler';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAnalysis(input: unknown): ImageAnalysis {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Invalid analysis response format');
  }

  const obj = input as Record<string, unknown>;
  const charactersRaw = Array.isArray(obj.characters) ? obj.characters : [];
  const characters = charactersRaw.map((character) => {
    const c = (character ?? {}) as Record<string, unknown>;
    return {
      name: typeof c.name === 'string' ? c.name : undefined,
      appearance: typeof c.appearance === 'string' ? c.appearance : 'unspecified appearance',
      emotion: typeof c.emotion === 'string' ? c.emotion : 'neutral',
      position: typeof c.position === 'string' ? c.position : 'unspecified',
    };
  });

  return {
    description: typeof obj.description === 'string' ? obj.description : '',
    characters,
    objects: Array.isArray(obj.objects) ? obj.objects.map(String) : [],
    colors: Array.isArray(obj.colors) ? obj.colors.map(String) : [],
    composition: typeof obj.composition === 'string' ? obj.composition : '',
    mood: typeof obj.mood === 'string' ? obj.mood : '',
    artStyle: typeof obj.artStyle === 'string' ? obj.artStyle : '',
    suggestedTransitions: Array.isArray(obj.suggestedTransitions)
      ? obj.suggestedTransitions.map(String)
      : [],
  };
}

export class ImageAnalysisService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
      organization: CONFIG.OPENAI_ORG_ID,
    });
  }

  async analyzeImage(imageBase64: string, depth: 'quick' | 'detailed'): Promise<ImageAnalysis> {
    const systemPrompt = depth === 'quick' ? QUICK_ANALYSIS_PROMPT : DETAILED_ANALYSIS_PROMPT;

    try {
      const response = await this.openai.chat.completions.create({
        model: CONFIG.VISION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: depth === 'quick' ? 500 : 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new OpenAIError('Vision response content is empty');
      }

      const parsed = JSON.parse(content);
      return normalizeAnalysis(parsed);
    } catch (err) {
      if (err instanceof ValidationError || err instanceof OpenAIError) {
        throw err;
      }

      if (err instanceof SyntaxError) {
        throw new ValidationError('Invalid JSON response from Vision API');
      }

      const message = err instanceof Error ? err.message : 'Unknown Vision API error';
      throw new OpenAIError(message);
    }
  }

  async analyzeMultiple(
    images: { base64: string; position: string }[],
    depth: 'quick' | 'detailed'
  ): Promise<ImageAnalysis[]> {
    if (images.length === 0) {
      return [];
    }

    const intervalMs = Math.ceil(60000 / Math.max(CONFIG.VISION_RATE_LIMIT_PER_MINUTE, 1));
    const maxConcurrency = Math.max(1, Math.min(4, Math.floor(CONFIG.VISION_RATE_LIMIT_PER_MINUTE / 10) || 1));

    const results: ImageAnalysis[] = new Array(images.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const current = cursor;
        cursor += 1;

        if (current >= images.length) {
          return;
        }

        const item = images[current];
        let attempt = 0;

        while (attempt < 3) {
          try {
            results[current] = await this.analyzeImage(item.base64, depth);
            break;
          } catch (err) {
            const message = err instanceof Error ? err.message.toLowerCase() : '';
            const shouldRetry = message.includes('rate') || message.includes('429') || message.includes('timeout');

            if (!shouldRetry || attempt >= 2) {
              throw err;
            }

            const backoff = Math.min(5000, 1000 * 2 ** attempt);
            await sleep(backoff + Math.floor(Math.random() * 300));
            attempt += 1;
          }
        }

        await sleep(intervalMs);
      }
    };

    await Promise.all(Array.from({ length: Math.min(maxConcurrency, images.length) }, () => worker()));

    return results;
  }

  async extractCharacters(analysis: ImageAnalysis): Promise<CharacterInfo[]> {
    return analysis.characters;
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
