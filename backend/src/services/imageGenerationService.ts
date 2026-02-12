/**
 * ImageGenerationService
 * DALL-E 3 API を呼び出してパネル画像を生成する
 *
 * 担当: Agent C
 * 依存: openai パッケージ, CONFIG, ProgressEvent
 * 出力: 生成された画像ファイル
 */

import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { APIError } from 'openai/error';
import { API_COSTS, PanelPrompt, ProgressEvent, GenerationSettings } from '../models/types';
import { CONFIG } from '../config/constants';

export interface GeneratedPanel {
  panelIndex: number;
  imageUrl: string;       // DALL-E が返すURL
  localFilePath: string;  // ローカルに保存したパス
  prompt: string;
  revisedPrompt?: string; // DALL-E が修正したプロンプト
  costUsd: number;
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

  /**
   * 単一パネルの画像を生成
   */
  async generatePanel(
    prompt: string,
    panelIndex: number,
    projectId: string,
    settings?: GenerationSettings
  ): Promise<GeneratedPanel> {
    const size = this.getImageSize(settings?.aspectRatio ?? 'square');
    const quality = settings?.qualityLevel === 'hd' ? 'hd' : 'standard';

    const response = await this.openai.images.generate({
      model: CONFIG.DALLE_MODEL,
      prompt,
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

    const localPath = await this.downloadAndSave(imageUrl, projectId, panelIndex);

    return {
      panelIndex,
      imageUrl,
      localFilePath: localPath,
      prompt,
      revisedPrompt: first?.revised_prompt,
      costUsd: quality === 'hd' ? API_COSTS.DALLE3_HD : API_COSTS.DALLE3_STANDARD,
    };
  }

  /**
   * バッチ生成（複数パネル）
   */
  async generateBatch(
    panelPrompts: PanelPrompt[],
    projectId: string,
    batchMode: 'sequential' | 'parallel',
    settings?: GenerationSettings,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<GeneratedPanel[]> {
    if (!Array.isArray(panelPrompts) || panelPrompts.length === 0) {
      throw new Error('panelPrompts is required and must not be empty');
    }

    if (batchMode === 'parallel') {
      return this.generateParallel(panelPrompts, projectId, settings, onProgress);
    }

    return this.generateSequential(panelPrompts, projectId, settings, onProgress);
  }

  /**
   * 順次生成 (レートリミットに優しい)
   */
  private async generateSequential(
    panelPrompts: PanelPrompt[],
    projectId: string,
    settings?: GenerationSettings,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<GeneratedPanel[]> {
    const total = panelPrompts.length;
    const results: GeneratedPanel[] = [];

    for (let i = 0; i < total; i += 1) {
      const panelPrompt = panelPrompts[i];
      try {
        const generated = await this.generatePanelWithRetry(panelPrompt, projectId, settings, 0);
        results.push(generated);

        onProgress?.({
          type: 'progress',
          stage: 'generating_images',
          currentStep: i + 1,
          totalSteps: total,
          percentage: Math.round(((i + 1) / total) * 100),
          message: `Generated panel ${panelPrompt.panelIndex}`,
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
          message: `Failed panel ${panelPrompt.panelIndex}`,
          panelIndex: panelPrompt.panelIndex,
          error: errorMessage,
        });
      }

      if (i < total - 1) {
        await this.sleep(this.getRequestSpacingMs());
      }
    }

    return results;
  }

  /**
   * 並列生成 (高速だがレートリミット注意)
   */
  private async generateParallel(
    panelPrompts: PanelPrompt[],
    projectId: string,
    settings?: GenerationSettings,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<GeneratedPanel[]> {
    const total = panelPrompts.length;
    const maxConcurrent = Math.max(1, Math.floor(CONFIG.DALLE_RATE_LIMIT_PER_MINUTE / 2));
    const results: GeneratedPanel[] = [];
    const failed: PanelPrompt[] = [];
    let completed = 0;

    for (let start = 0; start < total; start += maxConcurrent) {
      const batch = panelPrompts.slice(start, start + maxConcurrent);
      const settled = await Promise.allSettled(
        batch.map((panelPrompt) => this.generatePanelWithRetry(panelPrompt, projectId, settings, 0))
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
            message: `Generated panel ${panelPrompt.panelIndex}`,
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
            message: `Failed panel ${panelPrompt.panelIndex}`,
            panelIndex: panelPrompt.panelIndex,
            error: errorMessage,
          });
        }
      });

      if (start + maxConcurrent < total) {
        await this.sleep(this.getRequestSpacingMs() * batch.length);
      }
    }

    for (const panelPrompt of failed) {
      try {
        const regenerated = await this.generatePanelWithRetry(panelPrompt, projectId, settings, 0);
        results.push(regenerated);
      } catch {
        // 既に進捗イベントで通知済みのためここでは握りつぶす
      }
    }

    return results.sort((a, b) => a.panelIndex - b.panelIndex);
  }

  private async generatePanelWithRetry(
    panelPrompt: PanelPrompt,
    projectId: string,
    settings?: GenerationSettings,
    retryCount = 0
  ): Promise<GeneratedPanel> {
    try {
      return await this.generatePanel(panelPrompt.dallePrompt, panelPrompt.panelIndex, projectId, settings);
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      if (!isRetryable || retryCount >= CONFIG.MAX_RETRIES_PER_PANEL) {
        const message = error instanceof Error ? error.message : 'Unknown generation error';
        throw new Error(`Panel ${panelPrompt.panelIndex} failed after retries: ${message}`);
      }

      const backoff = this.calculateBackoffMs(retryCount);
      await this.sleep(backoff);
      return this.generatePanelWithRetry(panelPrompt, projectId, settings, retryCount + 1);
    }
  }

  /**
   * 画像をダウンロードしてローカルに保存
   */
  private async downloadAndSave(
    imageUrl: string,
    projectId: string,
    panelIndex: number
  ): Promise<string> {
    const projectDir = path.join(this.uploadDir, projectId);
    await fs.mkdir(projectDir, { recursive: true });

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Image download failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filePath = path.join(projectDir, `panel_${panelIndex}.png`);
    await fs.writeFile(filePath, buffer);

    return filePath;
  }

  /**
   * aspectRatio から DALL-E 3 の size パラメータを取得
   */
  private getImageSize(aspectRatio: string): '1024x1024' | '1792x1024' | '1024x1792' {
    switch (aspectRatio) {
      case 'wide': return '1792x1024';
      case 'tall': return '1024x1792';
      default: return '1024x1024';
    }
  }

  private getRequestSpacingMs(): number {
    return Math.max(1000, Math.ceil(60000 / Math.max(1, CONFIG.DALLE_RATE_LIMIT_PER_MINUTE)));
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
      return /timeout|network|rate limit|429|5\d\d/i.test(error.message);
    }

    return false;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ImageGenerationService;
