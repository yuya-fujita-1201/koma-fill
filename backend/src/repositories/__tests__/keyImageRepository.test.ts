process.env.OPENAI_API_KEY = 'test-openai-key';

import { initDatabase } from '../../database/connection';
import { keyImageRepository } from '../keyImageRepository';
import { projectRepository } from '../projectRepository';
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_GENERATION_SETTINGS } from '../../models/types';

describe('KeyImageRepository', () => {
  let projectId: string;

  beforeEach(async () => {
    await initDatabase(':memory:');
    const project = await projectRepository.createProject({
      projectName: 'KeyImage Test',
      storyPrompt: 'Test',
      layoutConfig: { ...DEFAULT_LAYOUT_CONFIG },
      generationSettings: { ...DEFAULT_GENERATION_SETTINGS },
    });
    projectId = project.id;
  });

  it('createKeyImage が保存できる', async () => {
    const created = await keyImageRepository.createKeyImage(projectId, {
      id: 'k1',
      projectId,
      imageFilePath: '/tmp/a.png',
      position: 'start',
      createdAt: new Date().toISOString(),
    });

    const list = await keyImageRepository.getKeyImages(projectId);
    expect(created.id).toBe('k1');
    expect(list[0].id).toBe('k1');
  });

  it('updateKeyImageAnalysis が更新できる', async () => {
    await keyImageRepository.createKeyImage(projectId, {
      id: 'k2',
      projectId,
      imageFilePath: '/tmp/b.png',
      position: 'end',
      createdAt: new Date().toISOString(),
    });
    const images = await keyImageRepository.getKeyImages(projectId);
    await keyImageRepository.updateKeyImageAnalysis(images[0].id, {
      description: 'desc',
      characters: [],
      objects: ['tree'],
      colors: ['green'],
      composition: 'center',
      mood: 'calm',
      artStyle: 'manga',
      suggestedTransitions: ['cut'],
    });
    const updated = await keyImageRepository.getKeyImages(projectId);
    expect(updated[0].analysis?.description).toBe('desc');
  });
});
