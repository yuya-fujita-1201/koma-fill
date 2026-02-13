process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.DALLE_RATE_LIMIT_PER_MINUTE = '600'; // テスト用: spacing を100msに短縮

import fs from 'fs/promises';
import { ImageGenerationService } from '../imageGenerationService';
import { API_COSTS } from '../../models/types';

const mockGenerate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    images: {
      generate: mockGenerate,
    },
  })),
}));

// DALLE_RATE_LIMIT_PER_MINUTE のデフォルト5 → spacing=12sのため長めのタイムアウトを設定
jest.setTimeout(60000);

describe('ImageGenerationService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('generatePanel が GeneratedPanel を返す', async () => {
    mockGenerate.mockResolvedValue({
      data: [{ url: 'https://example.com/image.png', revised_prompt: 'revised prompt' }],
    });
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('binary').buffer,
    } as unknown as Response);

    const service = new ImageGenerationService();
    const result = await service.generatePanel('A panel prompt', 0, 'project-1', {
      imageStyle: 'manga',
      aspectRatio: 'square',
      qualityLevel: 'standard',
    });

    expect(result.panelIndex).toBe(0);
    expect(result.imageUrl).toBe('https://example.com/image.png');
    expect(result.costUsd).toBe(API_COSTS.DALLE3_STANDARD);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 'standard', prompt: 'A panel prompt' })
    );
    writeSpy.mockRestore();
    mkdirSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it('generatePanel で HD 指定が API に反映される', async () => {
    mockGenerate.mockResolvedValue({
      data: [{ url: 'https://example.com/image.png' }],
    });
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('binary').buffer,
    } as unknown as Response);

    const service = new ImageGenerationService();
    await service.generatePanel('A panel prompt', 0, 'project-1', {
      imageStyle: 'manga',
      aspectRatio: 'square',
      qualityLevel: 'hd',
    });

    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ quality: 'hd' }));
  });

  it('generateBatch sequential で順番どおり生成される', async () => {
    mockGenerate
      .mockResolvedValue({ data: [{ url: 'https://example.com/a.png' }] })
      .mockResolvedValue({ data: [{ url: 'https://example.com/b.png' }] });
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('binary').buffer,
    } as unknown as Response);

    const service = new ImageGenerationService();
    const results = await service.generateBatch(
      [
        { panelIndex: 0, dallePrompt: 'first', storyBeat: 'A', visualFocus: 'v', transitionType: 'cut' },
        { panelIndex: 1, dallePrompt: 'second', storyBeat: 'B', visualFocus: 'v', transitionType: 'cut' },
      ],
      'project-1',
      'sequential'
    );

    expect(results).toHaveLength(2);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(results[0].panelIndex).toBe(0);
    expect(results[1].panelIndex).toBe(1);
  });

  it('onProgress がパネル毎に呼ばれる', async () => {
    mockGenerate.mockResolvedValue({ data: [{ url: 'https://example.com/a.png' }] });
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('binary').buffer,
    } as unknown as Response);

    const events: string[] = [];
    const service = new ImageGenerationService();
    const progress = (event: { type: 'progress' | 'error' | 'complete'; panelIndex?: number }) => {
      events.push(event.type);
    };

    await service.generateBatch(
      [
        { panelIndex: 0, dallePrompt: 'first', storyBeat: 'A', visualFocus: 'v', transitionType: 'cut' },
      ],
      'project-1',
      'sequential'
    );

    await service.generateBatch(
      [
        { panelIndex: 1, dallePrompt: 'second', storyBeat: 'B', visualFocus: 'v', transitionType: 'cut' },
      ],
      'project-1',
      'sequential',
      undefined,
      progress
    );

    expect(events).toEqual(['progress']);
  });

  it('API エラー時はリトライし、全失敗時は空配列を返す', async () => {
    let called = 0;
    mockGenerate.mockImplementation(() => {
      called += 1;
      return Promise.reject(new Error('503 service error'));
    });
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const service = new ImageGenerationService();

    const results = await service.generateBatch(
      [{ panelIndex: 0, dallePrompt: 'first', storyBeat: 'A', visualFocus: 'v', transitionType: 'cut' }],
      'project-1',
      'sequential'
    );

    // generateBatch はエラーを飲み込んで空配列を返す設計
    expect(results).toHaveLength(0);
    expect(called).toBeGreaterThan(1);
  });

  it('コスト計算が STANDARD / HD で正しい', async () => {
    mockGenerate.mockResolvedValue({ data: [{ url: 'https://example.com/a.png' }] });
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('binary').buffer,
    } as unknown as Response);

    const service = new ImageGenerationService();
    const standard = await service.generatePanel('prompt', 0, 'project-1', {
      imageStyle: 'manga',
      aspectRatio: 'square',
      qualityLevel: 'standard',
    });
    const hd = await service.generatePanel('prompt', 1, 'project-1', {
      imageStyle: 'manga',
      aspectRatio: 'square',
      qualityLevel: 'hd',
    });

    expect(standard.costUsd).toBe(API_COSTS.DALLE3_STANDARD);
    expect(hd.costUsd).toBe(API_COSTS.DALLE3_HD);
  });
});
