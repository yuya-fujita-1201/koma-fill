process.env.OPENAI_API_KEY = 'test-openai-key';

import { LayoutConfig } from '../../models/types';
import { ValidationError } from '../../middleware/errorHandler';
import { LayoutEngine } from '../layoutEngine';

const mockSharpInstance = {
  metadata: jest.fn().mockResolvedValue({ width: 1024, height: 1024 }),
  resize: jest.fn().mockReturnThis(),
  composite: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-layout')),
};

jest.mock('sharp', () => {
  const fn = jest.fn(() => mockSharpInstance);
  return {
    __esModule: true,
    default: fn,
    raw: fn,
  };
});

jest.mock('fs/promises', () => ({
  access: jest.fn(() => Promise.resolve()),
}));

describe('LayoutEngine', () => {
  let engine: LayoutEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new LayoutEngine();
  });

  it('composePanels が ComposedLayout を返す', async () => {
    const layout = await engine.composePanels(
      ['a.png', 'b.png'],
      defaultConfig({ format: 'vertical', totalPanels: 2 })
    );

    expect(layout.format).toBe('png');
    expect(layout.readingOrder).toBe('japanese');
    expect(layout.panelPositions).toHaveLength(2);
  });

  it('panelPositions がパネル数と一致する', async () => {
    const layout = await engine.composePanels(
      ['a.png', 'b.png', 'c.png', 'd.png'],
      defaultConfig({ totalPanels: 4, layoutTemplate: 'hero_focus_5', format: 'horizontal' })
    );

    expect(layout.panelPositions).toHaveLength(4);
  });

  it('readingOrder japanese で右から左に配置される', async () => {
    const layout = await engine.composePanels(
      ['a.png', 'b.png', 'c.png', 'd.png'],
      defaultConfig({
        totalPanels: 4,
        layoutTemplate: 'hero_focus_5',
        format: 'horizontal',
        readingOrder: 'japanese',
        pageWidth: 400,
        pageHeight: 100,
        gutterSize: 0,
        borderWidth: 0,
      })
    );

    const first = layout.panelPositions[0];
    const last = layout.panelPositions[3];
    expect(first.x).toBe(300);
    expect(last.x).toBe(0);
  });

  it('readingOrder western で左から右に配置される', async () => {
    const layout = await engine.composePanels(
      ['a.png', 'b.png', 'c.png', 'd.png'],
      defaultConfig({
        totalPanels: 4,
        layoutTemplate: 'hero_focus_5',
        format: 'horizontal',
        readingOrder: 'western',
        pageWidth: 400,
        pageHeight: 100,
        gutterSize: 0,
        borderWidth: 0,
      })
    );

    const first = layout.panelPositions[0];
    const last = layout.panelPositions[3];
    expect(first.x).toBe(0);
    expect(last.x).toBe(300);
  });

  it('addSpeechBubbles が SVG を合成する', async () => {
    const layout = await engine.composePanels(
      ['a.png'],
      defaultConfig({ totalPanels: 1, pageWidth: 400, pageHeight: 400, gutterSize: 0, borderWidth: 0 })
    );
    mockSharpInstance.composite.mockClear();
    const next = await engine.addSpeechBubbles(layout, [
      {
        panelIndex: 0,
        text: 'hello',
        position: 'top',
        style: 'rounded',
      },
    ]);

    expect(next).toHaveProperty('buffer');
    expect(next.panelPositions).toEqual(layout.panelPositions);
    const bubbleComposites = mockSharpInstance.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    expect(bubbleComposites[0].input.toString()).toContain('<rect x="160" y="16" width="224"');
  });

  it('同一パネルの2つ目の吹き出しは反対側に逃がす', async () => {
    const layout = await engine.composePanels(
      ['a.png'],
      defaultConfig({ totalPanels: 1, pageWidth: 400, pageHeight: 400, gutterSize: 0, borderWidth: 0 })
    );
    mockSharpInstance.composite.mockClear();

    await engine.addSpeechBubbles(layout, [
      { panelIndex: 0, text: 'first', position: 'top', style: 'rounded' },
      { panelIndex: 0, text: 'second', position: 'top', style: 'rounded' },
    ]);

    const bubbleComposites = mockSharpInstance.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    expect(bubbleComposites[0].input.toString()).toContain('<rect x="160" y="16" width="224"');
    expect(bubbleComposites[1].input.toString()).toContain('<rect x="16" y="16" width="224"');
  });

  it('rectangular 吹き出しは上部の横長ボックスにする', async () => {
    const layout = await engine.composePanels(
      ['a.png'],
      defaultConfig({ totalPanels: 1, pageWidth: 400, pageHeight: 400, gutterSize: 0, borderWidth: 0 })
    );
    mockSharpInstance.composite.mockClear();

    await engine.addSpeechBubbles(layout, [
      { panelIndex: 0, text: 'ナレーション: これは長い説明文です。', position: 'middle', style: 'rectangular' },
    ]);

    const bubbleComposites = mockSharpInstance.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    expect(bubbleComposites[0].input.toString()).toContain('<rect x="16" y="16" width="360"');
  });

  it('先頭ナレーションがあっても最初の会話は右側から始める', async () => {
    const layout = await engine.composePanels(
      ['a.png'],
      defaultConfig({ totalPanels: 1, pageWidth: 400, pageHeight: 400, gutterSize: 0, borderWidth: 0 })
    );
    mockSharpInstance.composite.mockClear();

    await engine.addSpeechBubbles(layout, [
      { panelIndex: 0, text: 'ナレーション: 放課後の屋上', position: 'top', style: 'rectangular' },
      { panelIndex: 0, text: '急ごう', position: 'middle', style: 'rounded' },
      { panelIndex: 0, text: 'まだ間に合う', position: 'bottom', style: 'rounded' },
    ]);

    const bubbleComposites = mockSharpInstance.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    expect(bubbleComposites[0].input.toString()).toContain('<rect x="16" y="16" width="360"');
    expect(bubbleComposites[1].input.toString()).toContain('<rect x="160" y="136" width="224"');
    expect(bubbleComposites[2].input.toString()).toContain('<rect x="16" y="334" width="224"');
  });

  it('bottom 吹き出しを短いコマ内に収める', async () => {
    const layout = await engine.composePanels(
      ['a.png'],
      defaultConfig({ totalPanels: 1, pageWidth: 240, pageHeight: 120, gutterSize: 0, borderWidth: 0 })
    );
    mockSharpInstance.composite.mockClear();

    await engine.addSpeechBubbles(layout, [
      {
        panelIndex: 0,
        text: '下側に置きたい説明文なので複数行になるように十分長くしておく',
        position: 'bottom',
        style: 'rounded',
      },
    ]);

    const bubbleComposites = mockSharpInstance.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    expect(bubbleComposites[0].input.toString()).toContain('<rect x="90" y="24" width="134" height="80"');
  });

  it('狭いコマでは吹き出し幅をパネル内に縮める', async () => {
    const layout = await engine.composePanels(
      ['a.png'],
      defaultConfig({ totalPanels: 1, pageWidth: 140, pageHeight: 240, gutterSize: 0, borderWidth: 0 })
    );
    mockSharpInstance.composite.mockClear();

    await engine.addSpeechBubbles(layout, [
      {
        panelIndex: 0,
        text: 'ナレーション: 狭いコマでも内側に収めたい',
        position: 'top',
        style: 'rectangular',
      },
    ]);

    const bubbleComposites = mockSharpInstance.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    expect(bubbleComposites[0].input.toString()).toContain('<rect x="16" y="16" width="108"');
  });

  it('空のパネル配列で ValidationError を投げる', async () => {
    await expect(
      engine.composePanels([], defaultConfig({ totalPanels: 0 }))
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

function defaultConfig(overrides: Partial<LayoutConfig> = {}): LayoutConfig {
    return {
      totalPanels: 2,
      layoutTemplate: 'conversation_grid_4',
      format: 'vertical',
    readingOrder: 'japanese',
    gutterSize: 10,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    pageWidth: 800,
    pageHeight: 1200,
  ...overrides,
  };
}
