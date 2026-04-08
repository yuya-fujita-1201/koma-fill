/**
 * ImageGenerationService
 * Gemini Native Image / DALL-E 3 を使ってパネル画像を生成する。
 */

import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { APIError } from 'openai/error';
import {
  API_COSTS,
  DEFAULT_GENERATION_SETTINGS,
  GenerationSettings,
  ImageModel,
  PanelPrompt,
  ProgressEvent,
} from '../models/types';
import { CONFIG } from '../config/constants';

export interface GeneratedPanel {
  panelIndex: number;
  imageUrl: string;
  localFilePath: string;
  prompt: string;
  revisedPrompt?: string;
  costUsd: number;
  model: ImageModel;
}

export interface PanelLayoutHint {
  panelIndex: number;
  width: number;
  height: number;
  aspectRatio: GenerationSettings['aspectRatio'];
  framingHint: string;
}

export interface ImageGenerationContext {
  keyImagePaths?: string[];
  existingPanelImages?: Array<{ panelIndex: number; imageFilePath?: string }>;
  panelLayoutHints?: PanelLayoutHint[];
}

interface SavedImage {
  imageUrl: string;
  localFilePath: string;
}

interface ReferenceImage {
  filePath: string;
  label: string;
}

const BASE_RETRY_DELAY_MS = 1000;

export class ImageGenerationService {
  private openai: OpenAI;
  private uploadDir: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
      organization: CONFIG.OPENAI_ORG_ID,
    });
    this.uploadDir = path.resolve(CONFIG.STORAGE_PATH);
  }

  async generatePanel(
    prompt: string,
    panelIndex: number,
    projectId: string,
    settings?: GenerationSettings,
    context?: ImageGenerationContext
  ): Promise<GeneratedPanel> {
    const mergedSettings = {
      ...DEFAULT_GENERATION_SETTINGS,
      ...(settings ?? {}),
    };
    const panelLayoutHint = context?.panelLayoutHints?.find((hint) => hint.panelIndex === panelIndex);
    const preparedPrompt = this.preparePrompt(prompt, panelIndex, mergedSettings, panelLayoutHint);
    const panelSettings = panelLayoutHint
      ? {
          ...mergedSettings,
          aspectRatio: panelLayoutHint.aspectRatio,
        }
      : mergedSettings;

    if (this.isGeminiModel(panelSettings.imageModel)) {
      return this.generateWithGemini(prompt, preparedPrompt, panelIndex, projectId, panelSettings, context);
    }

    return this.generateWithOpenAI(prompt, preparedPrompt, panelIndex, projectId, panelSettings);
  }

  async generateBatch(
    panelPrompts: PanelPrompt[],
    projectId: string,
    batchMode: 'sequential' | 'parallel',
    settings?: GenerationSettings,
    onProgress?: (event: ProgressEvent) => void,
    context?: ImageGenerationContext
  ): Promise<GeneratedPanel[]> {
    if (!Array.isArray(panelPrompts) || panelPrompts.length === 0) {
      throw new Error('panelPrompts is required and must not be empty');
    }

    if (batchMode === 'parallel') {
      return this.generateParallel(panelPrompts, projectId, settings, onProgress, context);
    }

    return this.generateSequential(panelPrompts, projectId, settings, onProgress, context);
  }

  private async generateWithOpenAI(
    originalPrompt: string,
    preparedPrompt: string,
    panelIndex: number,
    projectId: string,
    settings: GenerationSettings
  ): Promise<GeneratedPanel> {
    if (!CONFIG.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const size = this.getOpenAIImageSize(settings.aspectRatio);
    const quality = settings.qualityLevel === 'hd' ? 'hd' : 'standard';

    const response = await this.openai.images.generate({
      model: settings.imageModel,
      prompt: preparedPrompt,
      n: 1,
      size,
      quality,
      style: 'natural',
    });

    const first = response.data?.[0];
    const imageUrl = first?.url;
    if (!imageUrl) {
      throw new Error(`DALL-E response did not include image URL for panel ${panelIndex}`);
    }

    const saved = await this.downloadAndSave(imageUrl, projectId, panelIndex);

    return {
      panelIndex,
      imageUrl: saved.imageUrl,
      localFilePath: saved.localFilePath,
      prompt: originalPrompt,
      revisedPrompt: first?.revised_prompt,
      costUsd: quality === 'hd' ? API_COSTS.DALLE3_HD : API_COSTS.DALLE3_STANDARD,
      model: settings.imageModel,
    };
  }

  private async generateWithGemini(
    originalPrompt: string,
    preparedPrompt: string,
    panelIndex: number,
    projectId: string,
    settings: GenerationSettings,
    context?: ImageGenerationContext
  ): Promise<GeneratedPanel> {
    if (!CONFIG.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required for Gemini image generation');
    }

    const referenceImages = await this.collectReferenceImages(settings, context);
    const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = await Promise.all(
      referenceImages.map(async (image) => {
        const buffer = await fs.readFile(image.filePath);
        return {
          inlineData: {
            mimeType: this.detectMimeType(image.filePath),
            data: buffer.toString('base64'),
          },
        };
      })
    );
    parts.push({ text: preparedPrompt });

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: this.buildGeminiGenerationConfig(settings),
    };

    const response = await fetch(
      `${CONFIG.GEMINI_API_BASE_URL}/models/${settings.imageModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': CONFIG.GEMINI_API_KEY,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini image generation failed (${response.status}): ${errorBody.slice(0, 400)}`);
    }

    const payload = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: {
              mimeType?: string;
              data?: string;
            };
          }>;
        };
      }>;
    };

    const partsFromResponse = payload.candidates?.[0]?.content?.parts ?? [];
    const inlinePart = partsFromResponse.find((part) => part.inlineData?.data);
    if (!inlinePart?.inlineData?.data) {
      throw new Error(`Gemini response did not include image data for panel ${panelIndex}`);
    }

    const imageBuffer = Buffer.from(inlinePart.inlineData.data, 'base64');
    const saved = await this.saveGeneratedImage(
      imageBuffer,
      inlinePart.inlineData.mimeType ?? 'image/png',
      projectId,
      panelIndex
    );
    const modelNotes = partsFromResponse
      .map((part) => part.text?.trim())
      .filter((part): part is string => Boolean(part))
      .join('\n')
      .trim();

    return {
      panelIndex,
      imageUrl: saved.imageUrl,
      localFilePath: saved.localFilePath,
      prompt: originalPrompt,
      revisedPrompt: modelNotes || undefined,
      costUsd: 0,
      model: settings.imageModel,
    };
  }

  private async generateSequential(
    panelPrompts: PanelPrompt[],
    projectId: string,
    settings?: GenerationSettings,
    onProgress?: (event: ProgressEvent) => void,
    context?: ImageGenerationContext
  ): Promise<GeneratedPanel[]> {
    const total = panelPrompts.length;
    const results: GeneratedPanel[] = [];

    for (let i = 0; i < total; i += 1) {
      const panelPrompt = panelPrompts[i];
      try {
        const generated = await this.generatePanelWithRetry(
          panelPrompt,
          projectId,
          settings,
          this.buildContextForPanel(panelPrompt.panelIndex, context, results),
          0
        );
        results.push(generated);

        onProgress?.({
          type: 'progress',
          stage: 'generating_images',
          currentStep: i + 1,
          totalSteps: total,
          percentage: Math.round(((i + 1) / total) * 100),
          message: `Generated panel ${panelPrompt.panelIndex + 1}`,
          panelIndex: panelPrompt.panelIndex,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        onProgress?.({
          type: 'error',
          stage: 'generating_images',
          currentStep: i + 1,
          totalSteps: total,
          percentage: Math.round(((i + 1) / total) * 100),
          message: `Failed panel ${panelPrompt.panelIndex + 1}`,
          panelIndex: panelPrompt.panelIndex,
          error: errorMessage,
        });
      }

      if (i < total - 1) {
        await this.sleep(this.getRequestSpacingMs(settings));
      }
    }

    return results;
  }

  private async generateParallel(
    panelPrompts: PanelPrompt[],
    projectId: string,
    settings?: GenerationSettings,
    onProgress?: (event: ProgressEvent) => void,
    context?: ImageGenerationContext
  ): Promise<GeneratedPanel[]> {
    const total = panelPrompts.length;
    const maxConcurrent = Math.max(1, Math.floor(CONFIG.DALLE_RATE_LIMIT_PER_MINUTE / 2));
    const results: GeneratedPanel[] = [];
    const failed: PanelPrompt[] = [];
    let completed = 0;

    for (let start = 0; start < total; start += maxConcurrent) {
      const batch = panelPrompts.slice(start, start + maxConcurrent);
      const settled = await Promise.allSettled(
        batch.map((panelPrompt) =>
          this.generatePanelWithRetry(
            panelPrompt,
            projectId,
            settings,
            this.buildContextForPanel(panelPrompt.panelIndex, context, results),
            0
          )
        )
      );

      settled.forEach((item, idx) => {
        const panelPrompt = batch[idx];
        completed += 1;

        if (item.status === 'fulfilled') {
          results.push(item.value);
          onProgress?.({
            type: 'progress',
            stage: 'generating_images',
            currentStep: completed,
            totalSteps: total,
            percentage: Math.round((completed / total) * 100),
            message: `Generated panel ${panelPrompt.panelIndex + 1}`,
            panelIndex: panelPrompt.panelIndex,
          });
        } else {
          failed.push(panelPrompt);
          const errorMessage = item.reason instanceof Error ? item.reason.message : 'Unknown error';
          onProgress?.({
            type: 'error',
            stage: 'generating_images',
            currentStep: completed,
            totalSteps: total,
            percentage: Math.round((completed / total) * 100),
            message: `Failed panel ${panelPrompt.panelIndex + 1}`,
            panelIndex: panelPrompt.panelIndex,
            error: errorMessage,
          });
        }
      });

      if (start + maxConcurrent < total) {
        await this.sleep(this.getRequestSpacingMs(settings) * batch.length);
      }
    }

    for (const panelPrompt of failed) {
      try {
        const regenerated = await this.generatePanelWithRetry(
          panelPrompt,
          projectId,
          settings,
          this.buildContextForPanel(panelPrompt.panelIndex, context, results),
          0
        );
        results.push(regenerated);
      } catch {
        // Progress イベントは既に通知済み
      }
    }

    return results.sort((a, b) => a.panelIndex - b.panelIndex);
  }

  private async generatePanelWithRetry(
    panelPrompt: PanelPrompt,
    projectId: string,
    settings?: GenerationSettings,
    context?: ImageGenerationContext,
    retryCount = 0
  ): Promise<GeneratedPanel> {
    try {
      return await this.generatePanel(panelPrompt.dallePrompt, panelPrompt.panelIndex, projectId, settings, context);
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      if (!isRetryable || retryCount >= CONFIG.MAX_RETRIES_PER_PANEL) {
        const message = error instanceof Error ? error.message : 'Unknown generation error';
        throw new Error(`Panel ${panelPrompt.panelIndex + 1} failed after retries: ${message}`);
      }

      const backoff = this.calculateBackoffMs(retryCount);
      await this.sleep(backoff);
      return this.generatePanelWithRetry(panelPrompt, projectId, settings, context, retryCount + 1);
    }
  }

  private preparePrompt(
    originalPrompt: string,
    panelIndex: number,
    settings: GenerationSettings,
    panelLayoutHint?: PanelLayoutHint
  ): string {
    const guidance: string[] = [
      'Create exactly one manga panel image.',
      `Panel number: ${panelIndex + 1}.`,
      `Art direction: ${settings.imageStyle}.`,
      `Target panel aspect: ${settings.aspectRatio}.`,
      'Prioritize strong composition, readable silhouettes, expressive faces, clean linework, and consistent anatomy.',
      'Maintain continuity of character design, wardrobe, props, environment, and camera logic across the sequence.',
      'Do not render text directly inside the artwork. Dialogue and speech balloons will be composed later by the layout engine, so the raw artwork must not contain text-bearing speech balloons, captions, subtitles, UI windows, dialogue boxes, labels, or signage text.',
      'Make the artwork full-bleed inside the panel. Do not draw an inner frame, white margin, print border, or extra empty gutter inside the image itself.',
      'Let important subjects slightly overscan the frame when helpful, so the final crop feels intentional rather than padded.',
      'Render the panel as a polished final comic image, not a storyboard sketch.',
      originalPrompt.trim(),
    ];

    if (settings.useReferenceImages) {
      guidance.splice(
        4,
        0,
        'Use the provided reference images to preserve character identity, scene continuity, and prop consistency.'
      );
    }

    if (settings.imageStyle.includes('black and white')) {
      guidance.push('Use high-quality monochrome manga finishing with rich inks, screentone control, and crisp blacks.');
    } else {
      guidance.push('Use deliberate cinematic lighting, controlled color harmony, and print-ready detail.');
    }

    if (panelLayoutHint) {
      guidance.push(
        `Panel slot size: ${panelLayoutHint.width}x${panelLayoutHint.height}px.`,
        panelLayoutHint.framingHint
      );
    }

    if (settings.negativePrompt?.trim()) {
      guidance.push(`Avoid: ${settings.negativePrompt.trim()}`);
    }

    return guidance.join('\n');
  }

  private buildGeminiGenerationConfig(settings: GenerationSettings): Record<string, unknown> {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: this.getGeminiAspectRatio(settings.aspectRatio),
      },
    };

    if (typeof settings.seed === 'number') {
      generationConfig.seed = settings.seed;
    }

    if (settings.imageModel !== 'gemini-2.5-flash-image') {
      generationConfig.imageConfig = {
        ...generationConfig.imageConfig as Record<string, unknown>,
        imageSize: settings.outputResolution,
      };
    }

    return generationConfig;
  }

  private async collectReferenceImages(
    settings: GenerationSettings,
    context?: ImageGenerationContext
  ): Promise<ReferenceImage[]> {
    if (!settings.useReferenceImages) {
      return [];
    }

    const limit = this.getReferenceImageLimit(settings.imageModel);
    const references: ReferenceImage[] = [];
    const seen = new Set<string>();

    const addReference = async (filePath: string | undefined, label: string) => {
      if (!filePath || seen.has(filePath)) {
        return;
      }
      try {
        await fs.access(filePath);
      } catch {
        return;
      }
      seen.add(filePath);
      references.push({ filePath, label });
    };

    for (const keyImagePath of context?.keyImagePaths ?? []) {
      if (references.length >= limit) {
        break;
      }
      await addReference(keyImagePath, 'key image');
    }

    const previousPanel = [...(context?.existingPanelImages ?? [])]
      .filter((panel) => typeof panel.imageFilePath === 'string')
      .sort((a, b) => b.panelIndex - a.panelIndex)[0];
    if (references.length < limit) {
      await addReference(previousPanel?.imageFilePath, 'previous panel');
    }

    return references.slice(0, limit);
  }

  private buildContextForPanel(
    panelIndex: number,
    baseContext: ImageGenerationContext | undefined,
    generatedPanels: GeneratedPanel[]
  ): ImageGenerationContext {
    const existingPanelImages = [
      ...(baseContext?.existingPanelImages ?? []).filter((panel) => panel.panelIndex < panelIndex),
      ...generatedPanels
        .filter((panel) => panel.panelIndex < panelIndex)
        .map((panel) => ({
          panelIndex: panel.panelIndex,
          imageFilePath: panel.localFilePath,
        })),
    ];

    return {
      keyImagePaths: baseContext?.keyImagePaths ?? [],
      existingPanelImages,
      panelLayoutHints: baseContext?.panelLayoutHints ?? [],
    };
  }

  private async downloadAndSave(
    imageUrl: string,
    projectId: string,
    panelIndex: number
  ): Promise<SavedImage> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Image download failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return this.saveGeneratedImage(Buffer.from(arrayBuffer), 'image/png', projectId, panelIndex);
  }

  private async saveGeneratedImage(
    buffer: Buffer,
    mimeType: string,
    projectId: string,
    panelIndex: number
  ): Promise<SavedImage> {
    const projectDir = path.join(this.uploadDir, projectId);
    await fs.mkdir(projectDir, { recursive: true });

    const extension = this.mimeTypeToExtension(mimeType);
    const filePath = path.join(projectDir, `panel_${panelIndex}.${extension}`);
    await fs.writeFile(filePath, buffer);

    return {
      imageUrl: `/uploads/${projectId}/panel_${panelIndex}.${extension}`,
      localFilePath: filePath,
    };
  }

  private getOpenAIImageSize(aspectRatio: string): '1024x1024' | '1792x1024' | '1024x1792' {
    switch (aspectRatio) {
      case 'wide':
        return '1792x1024';
      case 'tall':
        return '1024x1792';
      default:
        return '1024x1024';
    }
  }

  private getGeminiAspectRatio(aspectRatio: string): '1:1' | '16:9' | '9:16' {
    switch (aspectRatio) {
      case 'wide':
        return '16:9';
      case 'tall':
        return '9:16';
      default:
        return '1:1';
    }
  }

  private getRequestSpacingMs(settings?: GenerationSettings): number {
    if (settings && this.isGeminiModel(settings.imageModel)) {
      return 1000;
    }
    return Math.max(1000, Math.ceil(60000 / Math.max(1, CONFIG.DALLE_RATE_LIMIT_PER_MINUTE)));
  }

  private getReferenceImageLimit(model: ImageModel): number {
    switch (model) {
      case 'gemini-3-pro-image-preview':
        return 5;
      case 'gemini-3.1-flash-image-preview':
        return 4;
      case 'gemini-2.5-flash-image':
        return 3;
      default:
        return 0;
    }
  }

  private calculateBackoffMs(attempt: number): number {
    const jitter = Math.floor(Math.random() * 500);
    return BASE_RETRY_DELAY_MS * (2 ** attempt) + jitter;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof APIError) {
      return error.status === 429 || (error.status !== undefined && error.status >= 500);
    }

    if (error instanceof Error) {
      return /timeout|network|rate limit|429|5\d\d|temporarily unavailable|deadline/i.test(error.message);
    }

    return false;
  }

  private isGeminiModel(model: ImageModel): boolean {
    return model.startsWith('gemini-');
  }

  private detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/png';
    }
  }

  private mimeTypeToExtension(mimeType: string): string {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return 'jpg';
    }
    if (mimeType.includes('webp')) {
      return 'webp';
    }
    return 'png';
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ImageGenerationService;
