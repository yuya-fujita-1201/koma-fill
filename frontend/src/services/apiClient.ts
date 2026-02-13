import axios from 'axios';

export interface GenerationProgressEvent {
  type: 'progress' | 'complete' | 'error';
  stage: string;
  currentStep: number;
  totalSteps: number;
  percentage: number;
  message: string;
  panelIndex?: number;
  error?: string;
  totalCost?: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

export async function createProject(data: {
  projectName: string;
  storyPrompt: string;
  layoutConfig?: object;
  generationSettings?: object;
}) {
  const res = await api.post('/manga/create', data);
  return res.data;
}

export async function getProject(projectId: string) {
  const res = await api.get(`/manga/${projectId}`);
  return res.data;
}

export async function listProjects(limit?: number, offset?: number) {
  const params = new URLSearchParams();
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }
  if (offset !== undefined) {
    params.set('offset', String(offset));
  }
  const query = params.toString();
  const endpoint = query ? `/manga?${query}` : '/manga';
  const res = await api.get(endpoint);
  return res.data;
}

export async function uploadImages(projectId: string, files: File[], positions: string[]) {
  const formData = new FormData();
  files.forEach((file, i) => {
    formData.append('images', file);
    formData.append('positions', positions[i] ?? 'start');
  });

  const res = await api.post(`/manga/${projectId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function analyzeImages(
  projectId: string,
  depth: 'quick' | 'detailed' = 'detailed'
) {
  const res = await api.post(`/manga/${projectId}/analyze`, { analysisDepth: depth });
  return res.data;
}

export async function generatePrompts(projectId: string, storyPrompt: string, panelCount: number) {
  const res = await api.post(`/manga/${projectId}/generate-prompts`, {
    storyPrompt,
    panelCount,
    characterConsistency: true,
  });
  return res.data;
}

export function generateImages(
  projectId: string,
  batchMode: 'sequential' | 'parallel',
  onProgress: (event: GenerationProgressEvent) => void
): Promise<void> {
  const eventSource = new EventSource(
    `${API_BASE}/manga/${projectId}/generate-images?batchMode=${batchMode}`
  );

  return new Promise<void>((resolve, reject) => {
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as GenerationProgressEvent;
        onProgress(data);

        if (data.type === 'complete') {
          eventSource.close();
          resolve();
        } else if (data.type === 'error') {
          eventSource.close();
          reject(new Error(data.error || data.message || 'Image generation failed'));
        }
      } catch (_error) {
        eventSource.close();
        reject(new Error('Failed to parse image generation progress event'));
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      reject(new Error('Image generation stream disconnected'));
    };
  });
}

export async function regeneratePanel(projectId: string, panelIndex: number, newPrompt?: string) {
  const res = await api.post(`/manga/${projectId}/regenerate/${panelIndex}`, { newPrompt });
  return res.data;
}

export async function reorderPanels(projectId: string, panelOrder: number[]) {
  const res = await api.put(`/manga/${projectId}/reorder`, { panelOrder });
  return res.data;
}

export async function composeLayout(projectId: string, speechBubbles?: object[]) {
  const res = await api.post(`/manga/${projectId}/layout`, { speechBubbles });
  return res.data;
}

export async function generateLayout(projectId: string, speechBubbles?: object[]) {
  return composeLayout(projectId, speechBubbles);
}

export async function exportManga(
  projectId: string,
  options?: {
    format: 'png' | 'jpg' | 'pdf';
    compression: 'low' | 'medium' | 'high';
    resolution: 'web' | 'print';
  }
) {
  const payload = {
    format: options?.format ?? 'png',
    compression: options?.compression ?? 'medium',
    resolution: options?.resolution ?? 'web',
  } as {
    format: 'png' | 'jpg' | 'pdf';
    compression: 'low' | 'medium' | 'high';
    resolution: 'web' | 'print';
  };

  const res = await api.post(`/manga/${projectId}/export`, payload);
  return res.data as {
    message: string;
    projectId: string;
    format: 'png' | 'jpg' | 'pdf';
    downloadUrl: string;
    filePath: string;
    fileSize: number;
  };
}
