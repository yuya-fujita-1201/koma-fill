/**
 * ExportService
 * 合成済みレイアウトをPNG/JPG/PDF形式でエクスポート
 *
 * 担当: Agent D
 * 依存: sharp, pdfkit パッケージ
 * 出力: ファイルバッファ
 */

import { ExportFormat } from '../models/types';
import { ComposedLayout } from './layoutEngine';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path from 'path';
import { ValidationError } from '../middleware/errorHandler';

export interface ExportOptions {
  format: ExportFormat;
  compression: 'low' | 'medium' | 'high';
  resolution: 'web' | 'print';
  title?: string;
  author?: string;
}

export interface ExportResult {
  buffer: Buffer;
  format: ExportFormat;
  fileSize: number;
  width: number;
  height: number;
  dpi: number;
  filePath: string;
}

export class ExportService {
  /**
   * PNG形式でエクスポート
   *
   * 実装ガイド:
   * 1. resolution に基づいてDPIを決定 (web=72, print=300)
   * 2. sharp で圧縮レベルを設定
   * 3. Buffer を返す
   */
  async exportPNG(
    layout: ComposedLayout,
    options: ExportOptions
  ): Promise<ExportResult> {
    const compressionLevel = options.compression === 'high' ? 9 : options.compression === 'medium' ? 6 : 1;
    const dpi = options.resolution === 'print' ? 300 : 72;

    const buffer = await sharp(layout.buffer)
      .png({ compressionLevel })
      .withMetadata({ density: dpi })
      .toBuffer();

    return {
      buffer,
      format: 'png',
      fileSize: buffer.length,
      width: layout.width,
      height: layout.height,
      dpi,
      filePath: '', // Set by saveToFile
    };
  }

  /**
   * JPG形式でエクスポート
   */
  async exportJPG(
    layout: ComposedLayout,
    options: ExportOptions
  ): Promise<ExportResult> {
    const quality = options.compression === 'low' ? 60 : options.compression === 'medium' ? 80 : 95;
    const dpi = options.resolution === 'print' ? 300 : 72;

    const buffer = await sharp(layout.buffer)
      .jpeg({ quality, mozjpeg: true })
      .withMetadata({ density: dpi })
      .toBuffer();

    return {
      buffer,
      format: 'jpg',
      fileSize: buffer.length,
      width: layout.width,
      height: layout.height,
      dpi,
      filePath: '', // Set by saveToFile
    };
  }

  /**
   * PDF形式でエクスポート
   *
   * 実装ガイド:
   * 1. PDFDocument を作成
   * 2. ページサイズをレイアウトに合わせる
   * 3. 画像を埋め込む
   * 4. メタデータ（タイトル、著者）を設定
   */
  async exportPDF(
    layout: ComposedLayout,
    options: ExportOptions
  ): Promise<ExportResult> {
    const dpi = options.resolution === 'print' ? 300 : 72;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: [layout.width, layout.height],
        info: {
          Title: options.title || 'Manga',
          Author: options.author || 'koma-fill',
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          format: 'pdf',
          fileSize: buffer.length,
          width: layout.width,
          height: layout.height,
          dpi,
          filePath: '', // Set by saveToFile
        });
      });
      doc.on('error', reject);

      // 画像を埋め込む
      doc.image(layout.buffer, 0, 0, {
        width: layout.width,
        height: layout.height,
      });

      doc.end();
    });
  }

  /**
   * 形式に応じたエクスポートを実行
   */
  async export(
    layout: ComposedLayout,
    options: ExportOptions
  ): Promise<ExportResult> {
    switch (options.format) {
      case 'png': return this.exportPNG(layout, options);
      case 'jpg': return this.exportJPG(layout, options);
      case 'pdf': return this.exportPDF(layout, options);
      default:
        throw new ValidationError(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * エクスポート結果をファイルに保存
   */
  async saveToFile(
    result: ExportResult,
    outputDir: string,
    filename: string
  ): Promise<string> {
    // ディレクトリを作成（存在しない場合）
    await fs.mkdir(outputDir, { recursive: true });

    // ファイル名に拡張子を追加
    const fullFilename = filename.endsWith(`.${result.format}`)
      ? filename
      : `${filename}.${result.format}`;

    const filePath = path.join(outputDir, fullFilename);

    // ファイルを保存
    await fs.writeFile(filePath, result.buffer);

    return filePath;
  }
}

export default ExportService;
