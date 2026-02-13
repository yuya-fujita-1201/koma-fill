import { useCallback, useState } from 'react';
import { createProject, getProject, listProjects } from '../services/apiClient';
import { MangaProject } from '../types';

interface UseProjectReturn {
  project: MangaProject | null;
  projects: MangaProject[];
  loading: boolean;
  error: string | null;
  createProject: (data: {
    projectName: string;
    storyPrompt: string;
    layoutConfig?: object;
    generationSettings?: object;
  }) => Promise<MangaProject>;
  fetchProject: (projectId: string) => Promise<void>;
  fetchProjects: (limit?: number, offset?: number) => Promise<void>;
  clearError: () => void;
}

export function useProject(): UseProjectReturn {
  const [project, setProject] = useState<MangaProject | null>(null);
  const [projects, setProjects] = useState<MangaProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProjectAction = useCallback(async (data: Parameters<UseProjectReturn['createProject']>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const created = await createProject(data);
      setProject(created);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProject = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await getProject(projectId);
      setProject(fetched);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch project';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async (limit?: number, offset?: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await listProjects(limit, offset);
      setProjects(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    project,
    projects,
    loading,
    error,
    createProject: createProjectAction,
    fetchProject,
    fetchProjects,
    clearError,
  };
}
