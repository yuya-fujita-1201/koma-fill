/**
 * LayoutEngine
 * 生成されたパネル画像を漫画レイアウトに合成する
 *
 * 担当: Agent D
 * 依存: sharp パッケージ, LayoutConfig, SpeechBubble
 * 出力: 合成されたレイアウト画像 (Buffer)
 */

import { LayoutConfig, SpeechBubble, DEFAULT_LAYOUT_CONFIG } from '../models/types';
import sharp from 'sharp';
import fs from 'fs/promises';

export interface ComposedLayout {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'png';
  panelPositions: PanelPosition[];
}

export interface PanelPosition {
  panelIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class LayoutEngine {
  /**
   * メイン：パネル画像群 → 漫画レイアウトに合成
   *
   * @param panelImagePaths 各パネルの画像ファイルパス（順番通り）
   * @param config レイアウト設定
   * @returns ComposedLayout
   *
   * 実装ガイド:
   * 1. panelCount と format からグリッドレイアウトを計算
   *    - vertical 4パネル: 1列4行 or 2列2行
   *    - horizontal 4パネル: 4列1行 or 2列2行
   *    - square 4パネル: 2列2行
   * 2. 各パネルのサイズと位置を計算（ガターを含む）
   * 3. sharp で背景画像を作成（backgroundColor）
   * 4. 各パネルをリサイズしてcomposite
   * 5. ボーダーを描画
   */
  async composePanels(
    panelImagePaths: string[],
    config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
  ): Promise<ComposedLayout> {
    const grid = this.calculateGrid(panelImagePaths.length, config);
    const positions = this.calculatePanelPositions(grid, config);

    // 背景キャンバス作成
    const canvas = sharp({
      create: {
        width: config.pageWidth,
        height: config.pageHeight,
        channels: 4,
        background: config.backgroundColor,
      }
    });

    // パネルを配置
    const composites = await Promise.all(
      panelImagePaths.map(async (imgPath, i) => {
        // ファイルの存在確認
        try {
          await fs.access(imgPath);
        } catch {
          throw new Error(`Panel image not found: ${imgPath}`);
        }

        const resized = await sharp(imgPath)
          .resize(positions[i].width, positions[i].height, { fit: 'cover', withoutEnlargement: false })
          .toBuffer();
        return { input: resized, left: positions[i].x, top: positions[i].y };
      })
    );

    // ボーダーSVGを生成
    let result = canvas.composite(composites);

    if (config.borderWidth > 0) {
      const borderSvg = this.generateBorderSvg(positions, config);
      result = result.composite([{
        input: borderSvg,
        top: 0,
        left: 0
      }]);
    }

    const buffer = await result.png().toBuffer();

    return { buffer, width: config.pageWidth, height: config.pageHeight, format: 'png', panelPositions: positions };
  }

  /**
   * 吹き出しを追加
   *
   * @param layout 既存のレイアウト
   * @param bubbles 吹き出し情報
   * @returns 吹き出し付きレイアウト
   *
   * 実装ガイド:
   * 1. SVGで吹き出しシェイプを生成
   * 2. テキストをSVG内に配置
   * 3. sharp.composite() で重ね合わせ
   */
  async addSpeechBubbles(
    layout: ComposedLayout,
    bubbles: SpeechBubble[]
  ): Promise<ComposedLayout> {
    if (!bubbles || bubbles.length === 0) {
      return layout;
    }

    let result = sharp(layout.buffer);
    const panelPositionMap = new Map(layout.panelPositions.map(p => [p.panelIndex, p]));

    const bubbleSvgs = bubbles.map((bubble) => {
      const panelPos = panelPositionMap.get(bubble.panelIndex);
      if (!panelPos) {
        throw new Error(`Panel ${bubble.panelIndex} not found in layout`);
      }

      let targetY: number;
      switch (bubble.position) {
        case 'top':
          targetY = panelPos.y + 30;
          break;
        case 'bottom':
          targetY = panelPos.y + panelPos.height - 60;
          break;
        case 'middle':
        default:
          targetY = panelPos.y + panelPos.height / 2 - 30;
          break;
      }

      const bubbleSvg = this.generateSpeechBubbleSvg(bubble, panelPos, targetY, layout.width, layout.height);
      return {
        input: bubbleSvg,
        top: 0,
        left: 0
      };
    });

    result = result.composite(bubbleSvgs);
    const buffer = await result.toBuffer();

    return {
      ...layout,
      buffer
    };
  }

  /**
   * グリッドレイアウトを計算
   */
  private calculateGrid(
    panelCount: number,
    config: LayoutConfig
  ): { cols: number; rows: number } {
    // TODO: format と panelCount からグリッドを決定
    // vertical:   cols=1~2, rows=panelCount/cols
    // horizontal: cols=panelCount/rows, rows=1~2
    // square:     最も正方形に近い分割

    const sqrt = Math.sqrt(panelCount);
    let cols: number, rows: number;

    switch (config.format) {
      case 'vertical':
        cols = panelCount <= 4 ? 1 : 2;
        rows = Math.ceil(panelCount / cols);
        break;
      case 'horizontal':
        rows = panelCount <= 4 ? 1 : 2;
        cols = Math.ceil(panelCount / rows);
        break;
      case 'square':
      default:
        cols = Math.ceil(sqrt);
        rows = Math.ceil(panelCount / cols);
        break;
    }

    return { cols, rows };
  }

  /**
   * 各パネルの位置とサイズを計算
   */
  private calculatePanelPositions(
    grid: { cols: number; rows: number },
    config: LayoutConfig
  ): PanelPosition[] {
    const { cols, rows } = grid;
    const totalGutterX = config.gutterSize * (cols + 1);
    const totalGutterY = config.gutterSize * (rows + 1);
    const panelWidth = Math.floor((config.pageWidth - totalGutterX) / cols);
    const panelHeight = Math.floor((config.pageHeight - totalGutterY) / rows);

    const positions: PanelPosition[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const panelIndex = config.readingOrder === 'japanese'
          ? row * cols + (cols - 1 - col)  // 右から左
          : row * cols + col;               // 左から右

        positions.push({
          panelIndex,
          x: config.gutterSize + col * (panelWidth + config.gutterSize),
          y: config.gutterSize + row * (panelHeight + config.gutterSize),
          width: panelWidth,
          height: panelHeight,
        });
      }
    }

    return positions.sort((a, b) => a.panelIndex - b.panelIndex);
  }

  /**
   * サムネイル生成
   */
  async generateThumbnail(
    layout: ComposedLayout,
    size: { width: number; height: number } = { width: 200, height: 300 }
  ): Promise<Buffer> {
    return await sharp(layout.buffer)
      .resize(size.width, size.height, { fit: 'inside' })
      .toBuffer();
  }

  /**
   * ボーダーSVGを生成
   */
  private generateBorderSvg(
    positions: PanelPosition[],
    config: LayoutConfig
  ): Buffer {
    const rects = positions.map(pos =>
      `<rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" ` +
      `fill="none" stroke="${config.borderColor}" stroke-width="${config.borderWidth}" />`
    ).join('\n');

    const svg = `<svg width="${config.pageWidth}" height="${config.pageHeight}" xmlns="http://www.w3.org/2000/svg">
${rects}
</svg>`;

    return Buffer.from(svg, 'utf-8');
  }

  /**
   * 吹き出しSVGを生成
   */
  private generateSpeechBubbleSvg(
    bubble: SpeechBubble,
    panelPos: PanelPosition,
    targetY: number,
    layoutWidth: number,
    layoutHeight: number
  ): Buffer {
    const bubbleWidth = Math.min(panelPos.width - 40, 300);
    const bubbleX = panelPos.x + (panelPos.width - bubbleWidth) / 2;

    // テキストを複数行に分割（日本語対応: 文字数ベース折り返し）
    const maxCharsPerLine = 15;
    const lines: string[] = [];
    const hasSpaces = bubble.text.includes(' ');

    if (hasSpaces) {
      // 英語テキスト: スペース区切り
      const words = bubble.text.split(' ');
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + word).length > maxCharsPerLine) {
          if (currentLine) lines.push(currentLine.trim());
          currentLine = word + ' ';
        } else {
          currentLine += word + ' ';
        }
      }
      if (currentLine) lines.push(currentLine.trim());
    } else {
      // 日本語テキスト: 文字数で折り返し
      const text = bubble.text;
      for (let i = 0; i < text.length; i += maxCharsPerLine) {
        lines.push(text.slice(i, i + maxCharsPerLine));
      }
    }

    // 行数に応じて吹き出し高さを動的に計算
    const lineHeight = 20;
    const verticalPadding = 20;
    const bubbleHeight = Math.max(50, lines.length * lineHeight + verticalPadding);

    let shapePath: string;
    switch (bubble.style) {
      case 'cloud':
        // 雲型（簡易版）
        shapePath = `<ellipse cx="${bubbleX + bubbleWidth / 2}" cy="${targetY + bubbleHeight / 2}" ` +
          `rx="${bubbleWidth / 2}" ry="${bubbleHeight / 2}" fill="white" stroke="black" stroke-width="2" />`;
        break;
      case 'spiked':
        // トゲ型（思考吹き出し）
        shapePath = `<polygon points="${bubbleX},${targetY + 20} ${bubbleX + 20},${targetY} ` +
          `${bubbleX + bubbleWidth - 20},${targetY} ${bubbleX + bubbleWidth},${targetY + 20} ` +
          `${bubbleX + bubbleWidth},${targetY + bubbleHeight - 20} ${bubbleX + bubbleWidth - 20},${targetY + bubbleHeight} ` +
          `${bubbleX + 20},${targetY + bubbleHeight} ${bubbleX},${targetY + bubbleHeight - 20}" ` +
          `fill="white" stroke="black" stroke-width="2" />`;
        break;
      case 'rectangular':
        // 長方形
        shapePath = `<rect x="${bubbleX}" y="${targetY}" width="${bubbleWidth}" height="${bubbleHeight}" ` +
          `fill="white" stroke="black" stroke-width="2" />`;
        break;
      case 'rounded':
      default:
        // 丸み吹き出し（デフォルト）
        shapePath = `<rect x="${bubbleX}" y="${targetY}" width="${bubbleWidth}" height="${bubbleHeight}" ` +
          `rx="10" ry="10" fill="white" stroke="black" stroke-width="2" />` +
          `<polygon points="${bubbleX + 30},${targetY + bubbleHeight} ${bubbleX + 20},${targetY + bubbleHeight + 15} ` +
          `${bubbleX + 40},${targetY + bubbleHeight}" fill="white" stroke="black" stroke-width="2" />`;
        break;
    }

    const textElements = lines.map((line, i) =>
      `<text x="${bubbleX + bubbleWidth / 2}" y="${targetY + 25 + i * lineHeight}" ` +
      `font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="black">${this.escapeXml(line)}</text>`
    ).join('\n');

    const svg = `<svg width="${layoutWidth}" height="${layoutHeight}" xmlns="http://www.w3.org/2000/svg">
${shapePath}
${textElements}
</svg>`;

    return Buffer.from(svg, 'utf-8');
  }

  /**
   * XML特殊文字をエスケープ
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export default LayoutEngine;
