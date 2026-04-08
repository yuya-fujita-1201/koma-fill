process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.DALLE_RATE_LIMIT_PER_MINUTE = '600';

import fs from 'fs/promises';
import path from 'path';
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

jest.setTimeout(60000);

describe('ImageGenerationService', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    jest.restoreAllMocks();
  });

  it('DALL-E 3 でローカル保存された GeneratedPanel を返す', async () => {
    mockGenerate.mockResolvedValue({
      data: [{ url: 'https://example.com/image.png', revised_prompt: 'revised prompt' }],
    });

    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      if (String(input) === 'https://example.com/image.png') {
        return {
          ok: true,
          arrayBuffer: async () => new TextEncoder().encode('binary').buffer,
        } as Response;
      }
      throw new Error(`unexpected url: ${String(input)}`);
    });

    const service = new ImageGenerationService();
    const result = await service.generatePanel('A panel prompt', 0, 'project-1', {
      imageStyle: 'manga',
      aspectRatio: 'square',
      qualityLevel: 'standard',
      imageModel: 'dall-e-3',
      outputResolution: '2K',
      useReferenceImages: true,
    });

    expect(result.panelIndex).toBe(0);
    expect(result.imageUrl).toBe('/uploads/project-1/panel_0.png');
    expect(result.costUsd).toBe(API_COSTS.DALLE3_STANDARD);
    expect(result.model).toBe('dall-e-3');
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'dall-e-3',
        quality: 'standard',
      })
    );
    fetchSpy.mockRestore();
  });

  it('Gemini 3.1 で参照画像付き生成ができる', async () => {
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);
    jest.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
      const name = String(filePath);
      return Buffer.from(name.includes('panel_0') ? 'prev-panel' : 'reference-image');
    });

    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.includes('generativelanguage.googleapis.com')) {
        throw new Error(`unexpected url: ${url}`);
      }

      const body = JSON.parse(String(init?.body)) as {
        contents: Array<{ parts: Array<{ text?: string; inlineData?: { data?: string } }> }>;
        generationConfig?: { imageConfig?: { imageSize?: string } };
      };

      expect(body.contents[0].parts).toHaveLength(3);
      expect(body.generationConfig?.imageConfig?.imageSize).toBe('2K');

      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'kept reference fidelity' },
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: Buffer.from('gemini-image').toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    });

    const service = new ImageGenerationService();
    const result = await service.generatePanel(
      'Hero leaps across the rooftop',
      1,
      'project-1',
      {
        imageStyle: 'manga style, black and white ink drawing',
        aspectRatio: 'wide',
        qualityLevel: 'standard',
        imageModel: 'gemini-3.1-flash-image-preview',
        outputResolution: '2K',
        useReferenceImages: true,
      },
      {
        keyImagePaths: ['/tmp/start.png'],
        existingPanelImages: [{ panelIndex: 0, imageFilePath: '/tmp/panel_0.png' }],
      }
    );

    expect(result.imageUrl).toBe('/uploads/project-1/panel_1.png');
    expect(result.costUsd).toBe(0);
    expect(result.revisedPrompt).toBe('kept reference fidelity');
    fetchSpy.mockRestore();
  });

  it('Gemini sequential では直前の生成パネルも参照に使う', async () => {
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);
    jest.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
      return Buffer.from(String(filePath));
    });

    const seenBodies: string[] = [];
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.includes('generativelanguage.googleapis.com')) {
        throw new Error(`unexpected url: ${url}`);
      }

      const rawBody = String(init?.body);
      seenBodies.push(rawBody);

      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: Buffer.from(`img-${seenBodies.length}`).toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    });

    const service = new ImageGenerationService();
    const results = await service.generateBatch(
      [
        { panelIndex: 0, dallePrompt: 'first prompt', storyBeat: 'A', visualFocus: 'hero', transitionType: 'cut' },
        { panelIndex: 1, dallePrompt: 'second prompt', storyBeat: 'B', visualFocus: 'city', transitionType: 'action' },
      ],
      'project-1',
      'sequential',
      {
        imageStyle: 'manga',
        aspectRatio: 'square',
        qualityLevel: 'standard',
        imageModel: 'gemini-3.1-flash-image-preview',
        outputResolution: '2K',
        useReferenceImages: true,
      },
      undefined,
      {
        keyImagePaths: ['/tmp/start.png'],
        existingPanelImages: [],
      }
    );

    expect(results).toHaveLength(2);
    expect(seenBodies).toHaveLength(2);
    expect(seenBodies[1]).toContain(Buffer.from('/tmp/start.png').toString('base64'));
    expect(seenBodies[1]).toContain(
      Buffer.from(path.resolve('./uploads/project-1/panel_0.png')).toString('base64')
    );
    fetchSpy.mockRestore();
  });

  it('API エラー時はリトライ後に空配列を返す', async () => {
    let called = 0;
    mockGenerate.mockImplementation(() => {
      called += 1;
      return Promise.reject(new Error('503 service error'));
    });
    const service = new ImageGenerationService();

    const results = await service.generateBatch(
      [{ panelIndex: 0, dallePrompt: 'first', storyBeat: 'A', visualFocus: 'v', transitionType: 'cut' }],
      'project-1',
      'sequential',
      {
        imageStyle: 'manga',
        aspectRatio: 'square',
        qualityLevel: 'standard',
        imageModel: 'dall-e-3',
        outputResolution: '2K',
        useReferenceImages: false,
      }
    );

    expect(results).toHaveLength(0);
    expect(called).toBeGreaterThan(1);
  });
});
