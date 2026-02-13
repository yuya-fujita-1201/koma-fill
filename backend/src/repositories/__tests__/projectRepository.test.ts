process.env.OPENAI_API_KEY = 'test-openai-key';

import { initDatabase } from '../../database/connection';
import { projectRepository } from '../projectRepository';

describe('ProjectRepository', () => {
  beforeEach(async () => {
    await initDatabase(':memory:');
  });

  it('createProject / getProject が正常に動作する', async () => {
    const created = await projectRepository.createProject({
      projectName: 'Sample',
      storyPrompt: 'Test story',
      layoutConfig: { totalPanels: 4, format: 'vertical', readingOrder: 'japanese', gutterSize: 10, borderWidth: 2, borderColor: '#000', backgroundColor: '#fff', pageWidth: 800, pageHeight: 1200 },
      generationSettings: { imageStyle: 'manga', aspectRatio: 'square', qualityLevel: 'standard' },
    });
    const found = await projectRepository.getProject(created.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Sample');
    expect(found?.layoutConfig.totalPanels).toBe(4);
  });

  it('updateProject が更新を反映する', async () => {
    const created = await projectRepository.createProject({
      projectName: 'Sample',
      storyPrompt: 'Test story',
    });
    const updated = await projectRepository.updateProject(created.id, { status: 'analyzing' });
    expect(updated.status).toBe('analyzing');
    const found = await projectRepository.getProject(created.id);
    expect(found?.status).toBe('analyzing');
  });

  it('listProjects が上限・件数を満たす', async () => {
    await projectRepository.createProject({ projectName: 'A', storyPrompt: 'x' });
    await projectRepository.createProject({ projectName: 'B', storyPrompt: 'y' });
    const all = await projectRepository.listProjects(10, 0);
    expect(all).toHaveLength(2);
  });

  it('countProjects が件数を返す', async () => {
    await projectRepository.createProject({ projectName: 'A', storyPrompt: 'x' });
    await projectRepository.createProject({ projectName: 'B', storyPrompt: 'y' });
    const count = await projectRepository.countProjects();
    expect(count).toBe(2);
  });
});
