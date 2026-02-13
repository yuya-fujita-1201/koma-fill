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
    expect(layout.panelPositions).toHaveLength(2);
  });

  it('panelPositions がパネル数と一致する', async () => {
    const layout = await engine.composePanels(
      ['a.png', 'b.png', 'c.png', 'd.png'],
      defaultConfig({ totalPanels: 4, format: 'horizontal' })
    );

    expect(layout.panelPositions).toHaveLength(4);
  });

  it('readingOrder japanese で右から左に配置される', async () => {
    const layout = await engine.composePanels(
      ['a.png', 'b.png', 'c.png', 'd.png'],
      defaultConfig({
        totalPanels: 4,
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
      defaultConfig({ totalPanels: 1 })
    );
    const next = await engine.addSpeechBubbles(layout, [
      {
        panelIndex: 0,
        text: 'hello',
        position: 'middle',
        style: 'rounded',
      },
    ]);

    expect(next).toHaveProperty('buffer');
    expect(next.panelPositions).toEqual(layout.panelPositions);
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
