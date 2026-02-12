/**
 * ImageProcessor
 * 画像の前処理ユーティリティ
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export async function imageToBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

export async function base64ToImage(base64: string, outputPath: string): Promise<void> {
  const buffer = Buffer.from(base64, 'base64');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}

export async function resizeImage(
  inputPath: string,
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'fill' = 'cover'
): Promise<Buffer> {
  return sharp(inputPath)
    .resize(width, height, { fit })
    .toBuffer();
}

export async function getImageMetadata(filePath: string): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}> {
  const [metadata, stats] = await Promise.all([sharp(filePath).metadata(), fs.stat(filePath)]);

  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? 'unknown',
    size: stats.size,
  };
}

export async function addBorder(
  imageBuffer: Buffer,
  borderWidth: number,
  borderColor: string
): Promise<Buffer> {
  if (borderWidth <= 0) {
    return imageBuffer;
  }

  return sharp(imageBuffer)
    .extend({
      top: borderWidth,
      bottom: borderWidth,
      left: borderWidth,
      right: borderWidth,
      background: borderColor,
    })
    .toBuffer();
}

export async function downloadImage(url: string, outputPath: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  return outputPath;
}
