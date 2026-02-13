process.env.VISION_RATE_LIMIT_PER_MINUTE = '60000';
process.env.OPENAI_API_KEY = 'test-openai-key';

import { OpenAIError, ValidationError } from '../../middleware/errorHandler';
import { ImageAnalysisService } from '../imageAnalysisService';

const mockCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

const mockAnalysis = {
  description: 'A manga panel showing a character',
  characters: [{ name: 'Hero', appearance: 'spiky hair', emotion: 'determined', position: 'center' }],
  objects: ['sword', 'shield'],
  colors: ['red', 'blue'],
  composition: 'center-focused',
  mood: 'intense',
  artStyle: 'shonen manga',
  suggestedTransitions: ['zoom_in', 'cut'],
};

describe('ImageAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('analyzeImage が有効な base64 のレスポンスを ImageAnalysis で返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: JSON.stringify(mockAnalysis) },
      }],
    });

    const service = new ImageAnalysisService();
    const result = await service.analyzeImage('base64Image', 'quick');

    expect(result).toMatchObject({
      description: mockAnalysis.description,
      artStyle: mockAnalysis.artStyle,
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect((mockCreate.mock.calls[0]?.[0] as { model?: string }).model).toBe('gpt-4o');
  });

  it('analyzeImage の深さが detailed でより長いシステムプロンプトが使われる', async () => {
    mockCreate
      .mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockAnalysis) } }],
      })
      .mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockAnalysis) } }],
      });

    const service = new ImageAnalysisService();
    await service.analyzeImage('base64Image', 'quick');
    await service.analyzeImage('base64Image', 'detailed');

    const quickPrompt = (mockCreate.mock.calls[0]?.[0] as { messages?: Array<{ content: string }> }).messages?.[0]?.content ?? '';
    const detailedPrompt = (mockCreate.mock.calls[1]?.[0] as { messages?: Array<{ content: string }> }).messages?.[0]?.content ?? '';

    expect(detailedPrompt.length).toBeGreaterThan(quickPrompt.length);
  });

  it('analyzeMultiple が複数画像を順次処理し配列で返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAnalysis) } }],
    });

    const service = new ImageAnalysisService();
    const results = await service.analyzeMultiple(
      [
        { base64: 'img1', position: 'start' },
        { base64: 'img2', position: 'end' },
      ],
      'quick'
    );

    expect(results).toHaveLength(2);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(results[0].description).toBe(mockAnalysis.description);
    expect(results[1].description).toBe(mockAnalysis.description);
  });

  it('OpenAI API エラー時に OpenAIError を投げる', async () => {
    mockCreate.mockRejectedValue(new Error('service unavailable'));

    const service = new ImageAnalysisService();
    await expect(service.analyzeImage('base64Image', 'quick')).rejects.toBeInstanceOf(OpenAIError);
  });

  it('不正な JSON 応答時に ValidationError を投げる', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'invalid-json' } }],
    });

    const service = new ImageAnalysisService();
    await expect(service.analyzeImage('base64Image', 'quick')).rejects.toBeInstanceOf(ValidationError);
  });

  it('429 エラー時はリトライされる', async () => {
    let attempt = 0;
    mockCreate.mockImplementation(() => {
      attempt += 1;
      if (attempt === 1) {
        return Promise.reject(new Error('429 Too Many Requests'));
      }
      return Promise.resolve({
        choices: [{ message: { content: JSON.stringify(mockAnalysis) } }],
      });
    });

    const service = new ImageAnalysisService();
    const results = await service.analyzeMultiple([{ base64: 'base64', position: 'start' }], 'quick');

    expect(results).toHaveLength(1);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
