/**
 * LayoutEngine
 * 生成されたパネル画像を漫画レイアウトに合成する
 *
 * 担当: Agent D
 * 依存: sharp パッケージ, LayoutConfig, SpeechBubble
 * 出力: 合成されたレイアウト画像 (Buffer)
 */

import { LayoutConfig, SpeechBubble, DEFAULT_LAYOUT_CONFIG } from '../models/types';
// import sharp from 'sharp';
// import path from 'path';

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
    // TODO: 実装
    // const grid = this.calculateGrid(panelImagePaths.length, config);
    // const positions = this.calculatePanelPositions(grid, config);
    //
    // // 背景キャンバス作成
    // let canvas = sharp({
    //   create: {
    //     width: config.pageWidth,
    //     height: config.pageHeight,
    //     channels: 4,
    //     background: config.backgroundColor,
    //   }
    // });
    //
    // // パネルを配置
    // const composites = await Promise.all(
    //   panelImagePaths.map(async (imgPath, i) => {
    //     const resized = await sharp(imgPath)
    //       .resize(positions[i].width, positions[i].height, { fit: 'cover' })
    //       .toBuffer();
    //     return { input: resized, left: positions[i].x, top: positions[i].y };
    //   })
    // );
    //
    // const buffer = await canvas.composite(composites).png().toBuffer();
    //
    // return { buffer, width: config.pageWidth, height: config.pageHeight, format: 'png', panelPositions: positions };

    throw new Error('Not implemented');
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
    // TODO: 実装
    // 各バブルについて:
    // 1. panelIndex からパネルの位置を取得
    // 2. position (top/middle/bottom) からバブルの座標を計算
    // 3. style に応じたSVGシェイプを生成
    // 4. テキストを含むSVGを作成
    // 5. composite で重ね合わせ

    throw new Error('Not implemented');
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
    // TODO: sharp(layout.buffer).resize(size.width, size.height).toBuffer()
    throw new Error('Not implemented');
  }
}

export default LayoutEngine;
