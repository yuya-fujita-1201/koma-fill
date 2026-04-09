/**
 * LayoutEngine
 * 生成されたパネル画像を漫画レイアウトに合成する
 *
 * 担当: Agent D
 * 依存: sharp パッケージ, LayoutConfig, SpeechBubble
 * 出力: 合成されたレイアウト画像 (Buffer)
 */

import {
  LayoutConfig,
  LayoutTemplateId,
  SpeechBubble,
  DEFAULT_LAYOUT_CONFIG,
  ReadingOrder,
} from '../models/types';
import sharp from 'sharp';
import fs from 'fs/promises';
import { ValidationError } from '../middleware/errorHandler';

export interface ComposedLayout {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'png';
  readingOrder: ReadingOrder;
  panelPositions: PanelPosition[];
}

export interface PanelPosition {
  panelIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TemplateRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TEMPLATE_RECTS: Record<LayoutTemplateId, TemplateRect[]> = {
  conversation_grid_4: [
    { x: 0.05, y: 0.05, w: 0.42, h: 0.42 },
    { x: 0.53, y: 0.05, w: 0.42, h: 0.42 },
    { x: 0.05, y: 0.53, w: 0.42, h: 0.42 },
    { x: 0.53, y: 0.53, w: 0.42, h: 0.42 },
  ],
  intro_top_wide_4: [
    { x: 0.05, y: 0.05, w: 0.90, h: 0.24 },
    { x: 0.05, y: 0.35, w: 0.42, h: 0.60 },
    { x: 0.53, y: 0.35, w: 0.42, h: 0.26 },
    { x: 0.53, y: 0.69, w: 0.42, h: 0.26 },
  ],
  hero_focus_5: [
    { x: 0.05, y: 0.05, w: 0.58, h: 0.56 },
    { x: 0.69, y: 0.05, w: 0.26, h: 0.26 },
    { x: 0.69, y: 0.35, w: 0.26, h: 0.26 },
    { x: 0.05, y: 0.67, w: 0.42, h: 0.28 },
    { x: 0.53, y: 0.67, w: 0.42, h: 0.28 },
  ],
  action_flow_5: [
    { x: 0.05, y: 0.05, w: 0.42, h: 0.26 },
    { x: 0.53, y: 0.05, w: 0.42, h: 0.26 },
    { x: 0.10, y: 0.37, w: 0.80, h: 0.22 },
    { x: 0.05, y: 0.67, w: 0.42, h: 0.28 },
    { x: 0.53, y: 0.67, w: 0.42, h: 0.28 },
  ],
  quiet_vertical_4: [
    { x: 0.08, y: 0.05, w: 0.84, h: 0.17 },
    { x: 0.08, y: 0.28, w: 0.84, h: 0.17 },
    { x: 0.08, y: 0.51, w: 0.84, h: 0.17 },
    { x: 0.08, y: 0.74, w: 0.84, h: 0.17 },
  ],
  montage_mosaic_6: [
    { x: 0.05, y: 0.05, w: 0.42, h: 0.24 },
    { x: 0.53, y: 0.05, w: 0.42, h: 0.24 },
    { x: 0.05, y: 0.34, w: 0.26, h: 0.24 },
    { x: 0.37, y: 0.34, w: 0.58, h: 0.24 },
    { x: 0.05, y: 0.63, w: 0.42, h: 0.24 },
    { x: 0.53, y: 0.63, w: 0.42, h: 0.24 },
  ],
};

export class LayoutEngine {
  getPanelPositions(
    panelCount: number,
    config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
  ): PanelPosition[] {
    return this.calculatePanelPositions(panelCount, config);
  }

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
    if (!Array.isArray(panelImagePaths) || panelImagePaths.length === 0) {
      throw new ValidationError('At least one panel image path is required');
    }

    const positions = this.calculatePanelPositions(panelImagePaths.length, config);

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
      const baseLayout = await result.png().toBuffer();
      const borderOverlay = await this.generateBorderOverlay(positions, config);
      result = sharp(baseLayout).composite([{
        input: borderOverlay,
        top: 0,
        left: 0
      }]);
    }

    const buffer = await result.png().toBuffer();

    return {
      buffer,
      width: config.pageWidth,
      height: config.pageHeight,
      format: 'png',
      readingOrder: config.readingOrder,
      panelPositions: positions,
    };
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

    const panelBubbleCounts = new Map<number, number>();
    const panelDialogueBubbleCounts = new Map<number, number>();

    const bubbleSvgs = bubbles.map((bubble) => {
      const panelPos = panelPositionMap.get(bubble.panelIndex);
      if (!panelPos) {
        throw new Error(`Panel ${bubble.panelIndex} not found in layout`);
      }

      const panelBubbleCount = panelBubbleCounts.get(bubble.panelIndex) ?? 0;
      panelBubbleCounts.set(bubble.panelIndex, panelBubbleCount + 1);

      const dialogueSlotIndex = panelDialogueBubbleCounts.get(bubble.panelIndex) ?? 0;
      const slotIndex = bubble.style === 'rectangular' ? panelBubbleCount : dialogueSlotIndex;
      if (bubble.style !== 'rectangular') {
        panelDialogueBubbleCounts.set(bubble.panelIndex, dialogueSlotIndex + 1);
      }

      const bubbleSvg = this.generateSpeechBubbleSvg(
        bubble,
        panelPos,
        slotIndex,
        layout.readingOrder,
        layout.width,
        layout.height
      );
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
    panelCount: number,
    config: LayoutConfig
  ): PanelPosition[] {
    const template = TEMPLATE_RECTS[config.layoutTemplate];
    if (template && template.length === panelCount) {
      return this.calculateTemplatePositions(template, config);
    }

    const grid = this.calculateGrid(panelCount, config);
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

  private calculateTemplatePositions(
    rects: TemplateRect[],
    config: LayoutConfig
  ): PanelPosition[] {
    const safeWidth = config.pageWidth - config.gutterSize * 2;
    const safeHeight = config.pageHeight - config.gutterSize * 2;

    return rects.map((rect, panelIndex) => {
      const normalizedX = config.readingOrder === 'japanese' ? 1 - rect.x - rect.w : rect.x;
      return {
        panelIndex,
        x: Math.round(config.gutterSize + normalizedX * safeWidth),
        y: Math.round(config.gutterSize + rect.y * safeHeight),
        width: Math.round(rect.w * safeWidth),
        height: Math.round(rect.h * safeHeight),
      };
    });
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
  private async generateBorderOverlay(
    positions: PanelPosition[],
    config: LayoutConfig
  ): Promise<Buffer> {
    const rects = positions.map(pos =>
      `<rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" ` +
      `fill="none" stroke="${config.borderColor}" stroke-width="${config.borderWidth}" />`
    ).join('\n');

    const svg = `<svg width="${config.pageWidth}" height="${config.pageHeight}" xmlns="http://www.w3.org/2000/svg">
${rects}
</svg>`;

    // Packaged Electron builds on macOS can flatten direct SVG composites to white.
    // Rasterize the border overlay first so the final composite is stable.
    return sharp(Buffer.from(svg, 'utf-8')).png().toBuffer();
  }

  /**
   * 吹き出しSVGを生成
   */
  private generateSpeechBubbleSvg(
    bubble: SpeechBubble,
    panelPos: PanelPosition,
    slotIndex: number,
    readingOrder: ReadingOrder,
    layoutWidth: number,
    layoutHeight: number
  ): Buffer {
    const frame = this.resolveBubbleFrame(bubble, panelPos, slotIndex, readingOrder);
    const maxCharsPerLine = Math.max(
      bubble.style === 'rectangular' ? 10 : 7,
      Math.floor((frame.width - 28) / (bubble.style === 'rectangular' ? 12 : 10))
    );
    const lines = this.wrapBubbleText(bubble.text, maxCharsPerLine);
    const lineHeight = bubble.style === 'rectangular' ? 18 : 20;
    const verticalPadding = 20;
    const bubbleHeight = Math.max(50, lines.length * lineHeight + verticalPadding);
    const placement = this.resolveBubblePlacement(frame, panelPos, bubbleHeight);
    const bubbleWidth = placement.width;
    const bubbleX = placement.x;
    const targetY = placement.y;

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
          `${this.generateTailPolygon(bubbleX, targetY, bubbleWidth, bubbleHeight, placement.anchor)}`;
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

  private wrapBubbleText(text: string, maxCharsPerLine: number): string[] {
    const segments = text
      .split(/\r?\n/g)
      .map((segment) => segment.trim())
      .filter(Boolean);
    const lines: string[] = [];
    const normalizedSegments = segments.length > 0 ? segments : [text];

    for (const segment of normalizedSegments) {
      const hasSpaces = segment.includes(' ');

      if (hasSpaces) {
        const words = segment.split(' ');
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + word).length > maxCharsPerLine) {
            if (currentLine) {
              lines.push(currentLine.trim());
            }
            currentLine = `${word} `;
          } else {
            currentLine += `${word} `;
          }
        }
        if (currentLine) {
          lines.push(currentLine.trim());
        }
        continue;
      }

      for (let i = 0; i < segment.length; i += maxCharsPerLine) {
        lines.push(segment.slice(i, i + maxCharsPerLine));
      }
    }

    return lines;
  }

  private resolveBubbleFrame(
    bubble: SpeechBubble,
    panelPos: PanelPosition,
    slotIndex: number,
    readingOrder: ReadingOrder
  ): { x: number; width: number; anchor: 'left' | 'right' | 'center'; verticalPreference: 'top' | 'middle' | 'bottom' } {
    const innerPadding = 16;
    const availableWidth = Math.max(80, panelPos.width - innerPadding * 2);
    const nonRectWidth = Math.max(
      Math.min(120, availableWidth),
      Math.min(availableWidth, Math.round(panelPos.width * 0.56))
    );
    const rectWidth = Math.max(
      Math.min(160, availableWidth),
      Math.min(availableWidth, 360)
    );
    const bubbleWidth = bubble.style === 'rectangular' ? rectWidth : nonRectWidth;
    const leftX = panelPos.x + innerPadding;
    const centerX = panelPos.x + Math.max(innerPadding, (panelPos.width - bubbleWidth) / 2);
    const rightX = panelPos.x + panelPos.width - bubbleWidth - innerPadding;

    if (bubble.style === 'rectangular') {
      return {
        x: leftX,
        width: rectWidth,
        anchor: 'center',
        verticalPreference: 'top',
      };
    }

    const horizontalPriority = readingOrder === 'japanese'
      ? (['right', 'left', 'center'] as const)
      : (['left', 'right', 'center'] as const);

    const verticalPriority = (() => {
      switch (bubble.position) {
        case 'bottom':
          return ['bottom', 'middle', 'top'] as const;
        case 'middle':
          return ['middle', 'top', 'bottom'] as const;
        case 'top':
        default:
          return ['top', 'middle', 'bottom'] as const;
      }
    })();

    const horizontalChoice = horizontalPriority[Math.min(slotIndex % horizontalPriority.length, horizontalPriority.length - 1)];
    const rowOffset = Math.floor(slotIndex / horizontalPriority.length);
    const verticalChoice = verticalPriority[Math.min(rowOffset, verticalPriority.length - 1)];

    return {
      x: horizontalChoice === 'left' ? leftX : horizontalChoice === 'right' ? rightX : centerX,
      width: bubbleWidth,
      anchor: horizontalChoice,
      verticalPreference: verticalChoice,
    };
  }

  private resolveBubblePlacement(
    frame: { x: number; width: number; anchor: 'left' | 'right' | 'center'; verticalPreference: 'top' | 'middle' | 'bottom' },
    panelPos: PanelPosition,
    bubbleHeight: number
  ): { x: number; y: number; width: number; anchor: 'left' | 'right' | 'center' } {
    const innerPadding = 16;
    const topY = panelPos.y + innerPadding;
    const maxY = panelPos.y + Math.max(innerPadding, panelPos.height - bubbleHeight - innerPadding);
    const middleY = Math.min(
      maxY,
      panelPos.y + Math.max(innerPadding, Math.round(panelPos.height * 0.34))
    );
    const bottomY = maxY;

    return {
      x: frame.x,
      y: frame.verticalPreference === 'top' ? Math.min(topY, maxY) : frame.verticalPreference === 'middle' ? middleY : bottomY,
      width: frame.width,
      anchor: frame.anchor,
    };
  }

  private generateTailPolygon(
    bubbleX: number,
    bubbleY: number,
    bubbleWidth: number,
    bubbleHeight: number,
    anchor: 'left' | 'right' | 'center'
  ): string {
    const baseY = bubbleY + bubbleHeight;

    if (anchor === 'right') {
      return `<polygon points="${bubbleX + bubbleWidth - 44},${baseY} ${bubbleX + bubbleWidth - 24},${baseY + 16} ` +
        `${bubbleX + bubbleWidth - 18},${baseY}" fill="white" stroke="black" stroke-width="2" />`;
    }

    if (anchor === 'center') {
      return `<polygon points="${bubbleX + bubbleWidth / 2 - 10},${baseY} ${bubbleX + bubbleWidth / 2},${baseY + 16} ` +
        `${bubbleX + bubbleWidth / 2 + 12},${baseY}" fill="white" stroke="black" stroke-width="2" />`;
    }

    return `<polygon points="${bubbleX + 28},${baseY} ${bubbleX + 18},${baseY + 16} ` +
      `${bubbleX + 42},${baseY}" fill="white" stroke="black" stroke-width="2" />`;
  }
}

export default LayoutEngine;
