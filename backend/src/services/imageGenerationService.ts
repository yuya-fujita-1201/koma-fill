/**
 * ImageGenerationService
 * DALL-E 3 API を呼び出してパネル画像を生成する
 *
 * 担当: Agent C
 * 依存: openai パッケージ, CONFIG, ProgressEvent
 * 出力: 生成された画像ファイル
 */

import { PanelPrompt, ProgressEvent, GenerationSettings } from '../models/types';
import { CONFIG } from '../config/constants';
// import OpenAI from 'openai';
// import fs from 'fs/promises';
// import path from 'path';
// import { v4 as uuidv4 } from 'uuid';

export interface GeneratedPanel {
  panelIndex: number;
  imageUrl: string;       // DALL-E が返すURL
  localFilePath: string;  // ローカルに保存したパス
  prompt: string;
  revisedPrompt?: string; // DALL-E が修正したプロンプト
  costUsd: number;
}

export class ImageGenerationService {
  // TODO: OpenAI クライアント初期化
  // private openai: OpenAI;

  constructor() {
    // TODO: new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY })
  }

  /**
   * 単一パネルの画像を生成
   *
   * @param prompt DALL-E 3 に送るプロンプト
   * @param panelIndex パネルのインデックス
   * @param settings 生成設定
   * @returns GeneratedPanel
   *
   * 実装ガイド:
   * 1. openai.images.generate() を呼ぶ
   * 2. model: 'dall-e-3', size: settings に基づく
   * 3. レスポンスの url から画像をダウンロード
   * 4. ローカルストレージに保存
   * 5. revised_prompt も保存（DALL-E 3はプロンプトを修正することがある）
   */
  async generatePanel(
    prompt: string,
    panelIndex: number,
    projectId: string,
    settings?: GenerationSettings
  ): Promise<GeneratedPanel> {
    // TODO: 実装
    // const size = this.getImageSize(settings?.aspectRatio || 'square');
    //
    // const response = await this.openai.images.generate({
    //   model: CONFIG.DALLE_MODEL,
    //   prompt: prompt,
    //   n: 1,
    //   size: size,
    //   quality: settings?.qualityLevel || 'standard',
    // });
    //
    // const imageUrl = response.data[0].url!;
    // const revisedPrompt = response.data[0].revised_prompt;
    //
    // // 画像をダウンロードしてローカル保存
    // const localPath = await this.downloadAndSave(imageUrl, projectId, panelIndex);
    //
    // return {
    //   panelIndex,
    //   imageUrl,
    //   localFilePath: localPath,
    //   prompt,
    //   revisedPrompt,
    //   costUsd: settings?.qualityLevel === 'hd' ? 0.08 : 0.04,
    // };

    throw new Error('Not implemented');
  }

  /**
   * バッチ生成（複数パネル）
   * 進捗をコールバックで通知
   *
   * @param panelPrompts 各パネルのプロンプト
   * @param projectId プロジェクトID
   * @param batchMode 'sequential' = 順番に生成, 'parallel' = 同時生成
   * @param onProgress 進捗コールバック
   */
  async generateBatch(
    panelPrompts: PanelPrompt[],
    projectId: string,
    batchMode: 'sequential' | 'parallel',
    settings?: GenerationSettings,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<GeneratedPanel[]> {
    // TODO: 実装
    // if (batchMode === 'sequential') {
    //   return this.generateSequential(panelPrompts, projectId, settings, onProgress);
    // } else {
    //   return this.generateParallel(panelPrompts, projectId, settings, onProgress);
    // }

    throw new Error('Not implemented');
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
    // TODO: for ループで1つずつ生成
    // TODO: 各生成後に onProgress を呼ぶ
    // TODO: 失敗時はリトライ (MAX_RETRIES_PER_PANEL 回まで)
    // TODO: リトライ間に指数バックオフ待機
    throw new Error('Not implemented');
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
    // TODO: Promise.allSettled で同時生成
    // TODO: DALLE_RATE_LIMIT_PER_MINUTE を超えないようにバッチ分割
    // TODO: 失敗したものだけリトライ
    throw new Error('Not implemented');
  }

  /**
   * 画像をダウンロードしてローカルに保存
   */
  private async downloadAndSave(
    imageUrl: string,
    projectId: string,
    panelIndex: number
  ): Promise<string> {
    // TODO: axios.get(imageUrl, { responseType: 'arraybuffer' })
    // TODO: fs.writeFile() でローカル保存
    // TODO: パス: uploads/{projectId}/panel_{panelIndex}.png
    throw new Error('Not implemented');
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
}

export default ImageGenerationService;
