process.env.OPENAI_API_KEY = 'test-openai-key';

import { initDatabase } from '../../database/connection';
import { projectRepository } from '../projectRepository';
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_GENERATION_SETTINGS } from '../../models/types';

const testInput = {
  projectName: 'Sample',
  storyPrompt: 'Test story',
  layoutConfig: { ...DEFAULT_LAYOUT_CONFIG },
  generationSettings: { ...DEFAULT_GENERATION_SETTINGS },
};

describe('ProjectRepository', () => {
  beforeEach(async () => {
    await initDatabase(':memory:');
  });

  it('createProject / getProject が正常に動作する', async () => {
    const created = await projectRepository.createProject(testInput);
    const found = await projectRepository.getProject(created.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Sample');
    expect(found?.layoutConfig.totalPanels).toBe(4);
  });

  it('updateProject が更新を反映する', async () => {
    const created = await projectRepository.createProject(testInput);
    const updated = await projectRepository.updateProject(created.id, { status: 'analyzing' });
    expect(updated.status).toBe('analyzing');
    const found = await projectRepository.getProject(created.id);
    expect(found?.status).toBe('analyzing');
  });

  it('listProjects が上限・件数を満たす', async () => {
    await projectRepository.createProject({ ...testInput, projectName: 'A' });
    await projectRepository.createProject({ ...testInput, projectName: 'B' });
    const all = await projectRepository.listProjects(10, 0);
    expect(all).toHaveLength(2);
  });

  it('countProjects が件数を返す', async () => {
    await projectRepository.createProject({ ...testInput, projectName: 'A' });
    await projectRepository.createProject({ ...testInput, projectName: 'B' });
    const count = await projectRepository.countProjects();
    expect(count).toBe(2);
  });
});
