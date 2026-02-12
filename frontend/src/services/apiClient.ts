/**
 * API Client - バックエンドとの通信レイヤー
 *
 * 担当: Agent E
 *
 * 全エンドポイントのラッパー関数を提供
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 画像生成は時間がかかるため長め
});

// ============================================
// プロジェクト
// ============================================

export async function createProject(data: {
  projectName: string;
  storyPrompt: string;
  layoutConfig?: object;
  generationSettings?: object;
}) {
  // TODO: POST /api/manga/create
  const res = await api.post('/manga/create', data);
  return res.data;
}

export async function getProject(projectId: string) {
  // TODO: GET /api/manga/:projectId
  const res = await api.get(`/manga/${projectId}`);
  return res.data;
}

// ============================================
// 画像アップロード
// ============================================

export async function uploadImages(
  projectId: string,
  files: File[],
  positions: string[]
) {
  // TODO: POST /api/manga/:projectId/upload (multipart/form-data)
  const formData = new FormData();
  files.forEach((file, i) => {
    formData.append('images', file);
    formData.append(`position_${i}`, positions[i]);
  });
  const res = await api.post(`/manga/${projectId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// ============================================
// 画像分析
// ============================================

export async function analyzeImages(
  projectId: string,
  depth: 'quick' | 'detailed' = 'detailed'
) {
  // TODO: POST /api/manga/:projectId/analyze
  const res = await api.post(`/manga/${projectId}/analyze`, { analysisDepth: depth });
  return res.data;
}

// ============================================
// プロンプト生成
// ============================================

export async function generatePrompts(
  projectId: string,
  storyPrompt: string,
  panelCount: number
) {
  // TODO: POST /api/manga/:projectId/generate-prompts
  const res = await api.post(`/manga/${projectId}/generate-prompts`, {
    storyPrompt,
    panelCount,
    characterConsistency: true,
  });
  return res.data;
}

// ============================================
// 画像生成 (SSE対応)
// ============================================

export function generateImages(
  projectId: string,
  onProgress: (event: { percentage: number; message: string; panelIndex?: number }) => void
): Promise<void> {
  // TODO: SSE (Server-Sent Events) で進捗を受信
  // const eventSource = new EventSource(`${API_BASE}/manga/${projectId}/generate-images-stream`);
  // eventSource.onmessage = (event) => {
  //   const data = JSON.parse(event.data);
  //   onProgress(data);
  //   if (data.type === 'complete') eventSource.close();
  // };
  // eventSource.onerror = () => { eventSource.close(); reject(...); };

  // 暫定: 通常のPOST
  return api.post(`/manga/${projectId}/generate-images`, {
    batchMode: 'sequential',
  }).then(() => {});
}

// ============================================
// パネル操作
// ============================================

export async function regeneratePanel(
  projectId: string,
  panelIndex: number,
  newPrompt?: string
) {
  const res = await api.post(`/manga/${projectId}/regenerate/${panelIndex}`, { newPrompt });
  return res.data;
}

export async function reorderPanels(projectId: string, panelOrder: number[]) {
  const res = await api.put(`/manga/${projectId}/reorder`, { panelOrder });
  return res.data;
}

// ============================================
// レイアウト & エクスポート
// ============================================

export async function generateLayout(projectId: string, speechBubbles?: object[]) {
  const res = await api.post(`/manga/${projectId}/layout`, { speechBubbles });
  return res.data;
}

export async function exportManga(projectId: string, options: {
  format: 'png' | 'jpg' | 'pdf';
  compression: 'low' | 'medium' | 'high';
  resolution: 'web' | 'print';
}) {
  const res = await api.post(`/manga/${projectId}/export`, options, {
    responseType: 'blob',
  });
  return res.data;
}
