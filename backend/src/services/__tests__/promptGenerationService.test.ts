process.env.OPENAI_API_KEY = 'test-openai-key';

import { ValidationError } from '../../middleware/errorHandler';
import { PromptGenerationService } from '../promptGenerationService';

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

describe('PromptGenerationService', () => {
  const analyses = [
    {
      description: 'A detective stands at night street',
      characters: [{ name: 'Hero', appearance: 'coat', emotion: 'serious', position: 'center' }],
      objects: ['lamp', 'rain'],
      colors: ['blue', 'yellow'],
      composition: 'wide angle',
      mood: 'tense',
      artStyle: 'cyberpunk',
      suggestedTransitions: ['pan', 'cut'],
    },
  ];

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('panelCount=4 で4件の PanelPrompt を返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            panels: [
              {
                panelIndex: 0,
                dallePrompt: 'Panel 1 prompt',
                storyBeat: 'Start',
                visualFocus: 'hero',
                transitionType: 'cut',
              },
              {
                panelIndex: 1,
                dallePrompt: 'Panel 2 prompt',
                storyBeat: 'Build',
                visualFocus: 'street',
                transitionType: 'pan',
              },
              {
                panelIndex: 2,
                dallePrompt: 'Panel 3 prompt',
                storyBeat: 'Climax',
                visualFocus: 'villain',
                transitionType: 'zoom_in',
              },
              {
                panelIndex: 3,
                dallePrompt: 'Panel 4 prompt',
                storyBeat: 'Ending',
                visualFocus: 'hero',
                transitionType: 'fade',
              },
            ],
          }),
        },
      }],
    });

    const service = new PromptGenerationService();
    const prompts = await service.generatePanelPrompts('A hero chases a villain', analyses, 4);

    expect(prompts).toHaveLength(4);
    expect(prompts[0]).toMatchObject({
      panelIndex: 0,
      dallePrompt: 'Panel 1 prompt',
      storyBeat: 'Start',
    });
  });

  it('各 PanelPrompt に必要フィールドがある', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            panels: [{
              panelIndex: 0,
              dallePrompt: 'Panel prompt',
              storyBeat: 'Act',
              visualFocus: 'hero',
              transitionType: 'cut',
            }],
          }),
        },
      }],
    });

    const service = new PromptGenerationService();
    const prompts = await service.generatePanelPrompts('test', analyses, 1);

    expect(prompts[0]).toHaveProperty('dallePrompt');
    expect(prompts[0]).toHaveProperty('storyBeat');
    expect(prompts[0]).toHaveProperty('panelIndex');
  });

  it('characterConsistency=true で解析情報がシステムプロンプトへ反映される', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            panels: [{
              panelIndex: 0,
              dallePrompt: 'Panel with hero',
              storyBeat: 'Act',
              visualFocus: 'hero',
              transitionType: 'cut',
            }],
          }),
        },
      }],
    });

    const service = new PromptGenerationService();
    await service.generatePanelPrompts('hero story', analyses, 1, {
      imageStyle: 'manga',
      aspectRatio: 'square',
      qualityLevel: 'standard',
    });

    const callPayload = mockCreate.mock.calls[0]?.[0] as {
      messages?: Array<{ content: string; role?: string }>;
    };
    const systemPrompt = callPayload.messages?.[0]?.content ?? '';
    expect(systemPrompt).toContain('Hero');
  });

  it('imageStyle が出力プロンプトに反映される', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            panels: [{
              panelIndex: 0,
              dallePrompt: 'Generate a scene in vintage manga style',
              storyBeat: 'Act',
              visualFocus: 'hero',
              transitionType: 'cut',
            }],
          }),
        },
      }],
    });

    const service = new PromptGenerationService();
    const prompts = await service.generatePanelPrompts('test', analyses, 1, {
      imageStyle: 'vintage manga',
      aspectRatio: 'square',
      qualityLevel: 'standard',
    });

    expect(prompts[0].dallePrompt).toContain('vintage manga');
  });

  it('OpenAI API エラー時に OpenAIError を返す', async () => {
    mockCreate.mockRejectedValue(new Error('service down'));

    const service = new PromptGenerationService();
    await expect(service.generatePanelPrompts('test', analyses, 1)).rejects.toThrow('OpenAI API Error');
  });

  it('不正な JSON 応答時に ValidationError を返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: 'not-json' },
      }],
    });

    const service = new PromptGenerationService();
    await expect(service.generatePanelPrompts('test', analyses, 1)).rejects.toBeInstanceOf(ValidationError);
  });
});
