import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: '/api' },
  };
  return { default: mockAxios };
});

// Import after mock
const api = axios.create() as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createProject sends POST to /manga/create', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 'proj-1', name: 'Test' } });

    const { createProject } = await import('../apiClient');
    const result = await createProject({
      projectName: 'Test',
      storyPrompt: 'A story',
    });

    expect(api.post).toHaveBeenCalledWith('/manga/create', {
      projectName: 'Test',
      storyPrompt: 'A story',
    });
    expect(result).toEqual({ id: 'proj-1', name: 'Test' });
  });

  it('getProject sends GET to /manga/:projectId', async () => {
    api.get.mockResolvedValueOnce({ data: { id: 'proj-1', name: 'Test' } });

    const { getProject } = await import('../apiClient');
    const result = await getProject('proj-1');

    expect(api.get).toHaveBeenCalledWith('/manga/proj-1');
    expect(result).toEqual({ id: 'proj-1', name: 'Test' });
  });

  it('listProjects sends GET to /manga', async () => {
    api.get.mockResolvedValueOnce({ data: [{ id: 'proj-1' }] });

    const { listProjects } = await import('../apiClient');
    const result = await listProjects();

    expect(api.get).toHaveBeenCalledWith('/manga');
    expect(result).toEqual([{ id: 'proj-1' }]);
  });

  it('listProjects with params sends query string', async () => {
    api.get.mockResolvedValueOnce({ data: [] });

    const { listProjects } = await import('../apiClient');
    await listProjects(10, 5);

    expect(api.get).toHaveBeenCalledWith('/manga?limit=10&offset=5');
  });

  it('deletePanel sends DELETE to correct endpoint', async () => {
    api.delete.mockResolvedValueOnce({ data: { message: 'Panel deleted', remainingPanels: 3 } });

    const { deletePanel } = await import('../apiClient');
    const result = await deletePanel('proj-1', 2);

    expect(api.delete).toHaveBeenCalledWith('/manga/proj-1/panels/2');
    expect(result.message).toBe('Panel deleted');
  });

  it('deleteProject sends DELETE to correct endpoint', async () => {
    api.delete.mockResolvedValueOnce({ data: { message: 'Project deleted' } });

    const { deleteProject } = await import('../apiClient');
    const result = await deleteProject('proj-1');

    expect(api.delete).toHaveBeenCalledWith('/manga/proj-1');
    expect(result.message).toBe('Project deleted');
  });
});
