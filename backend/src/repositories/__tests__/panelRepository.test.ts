process.env.OPENAI_API_KEY = 'test-openai-key';

import { initDatabase } from '../../database/connection';
import { panelRepository } from '../panelRepository';
import { projectRepository } from '../projectRepository';
import { PanelStatus } from '../../models/types';

describe('PanelRepository', () => {
  let projectId: string;

  beforeEach(async () => {
    const db = await initDatabase(':memory:');
    const project = await projectRepository.createProject({
      projectName: 'Panel Test',
      storyPrompt: 'Test',
    });
    projectId = project.id;
  });

  it('createPanel と getPanelsByProject が取得できる', async () => {
    const created = await panelRepository.createPanel(projectId, {
      id: 'p1',
      projectId,
      panelIndex: 0,
      status: 'pending' as PanelStatus,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    const panels = await panelRepository.getPanelsByProject(projectId);
    expect(panels).toHaveLength(1);
    expect(panels[0].id).toBe(created.id);
  });

  it('updatePanel が更新される', async () => {
    const created = await panelRepository.createPanel(projectId, {
      id: 'p2',
      projectId,
      panelIndex: 1,
      status: 'pending' as PanelStatus,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    const updated = await panelRepository.updatePanel(created.id, { status: 'generated', prompt: 'Prompt text' });
    expect(updated.status).toBe('generated');
    expect(updated.prompt).toBe('Prompt text');
  });
});
