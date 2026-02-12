import { getDatabase } from '../database/connection';
import { Panel, PanelStatus } from '../models/types';

type PanelRow = {
  id: string;
  projectId: string;
  panelIndex: number;
  imageUrl: string | null;
  imageFilePath: string | null;
  prompt: string | null;
  storyBeat: string | null;
  speechBubbleText: string | null;
  status: PanelStatus;
  retryCount: number;
  generatedAt: string | null;
  createdAt: string;
};

function mapPanelRow(row: PanelRow): Panel {
  return {
    id: row.id,
    projectId: row.projectId,
    panelIndex: row.panelIndex,
    imageUrl: row.imageUrl ?? undefined,
    imageFilePath: row.imageFilePath ?? undefined,
    prompt: row.prompt ?? undefined,
    storyBeat: row.storyBeat ?? undefined,
    speechBubbleText: row.speechBubbleText ?? undefined,
    status: row.status,
    retryCount: row.retryCount,
    generatedAt: row.generatedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

export class PanelRepository {
  async createPanel(projectId: string, data: Panel): Promise<Panel> {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO panels (
        id, projectId, panelIndex, imageUrl, imageFilePath, prompt, storyBeat,
        speechBubbleText, status, retryCount, generatedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      projectId,
      data.panelIndex,
      data.imageUrl ?? null,
      data.imageFilePath ?? null,
      data.prompt ?? null,
      data.storyBeat ?? null,
      data.speechBubbleText ?? null,
      data.status,
      data.retryCount,
      data.generatedAt ?? null,
      data.createdAt
    );

    return { ...data, projectId };
  }

  async getPanelsByProject(projectId: string): Promise<Panel[]> {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, projectId, panelIndex, imageUrl, imageFilePath, prompt, storyBeat, speechBubbleText, status, retryCount, generatedAt, createdAt
      FROM panels
      WHERE projectId = ?
      ORDER BY panelIndex ASC
    `).all(projectId) as PanelRow[];
    return rows.map(mapPanelRow);
  }

  async getPanel(panelId: string): Promise<Panel | null> {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT id, projectId, panelIndex, imageUrl, imageFilePath, prompt, storyBeat, speechBubbleText, status, retryCount, generatedAt, createdAt
      FROM panels
      WHERE id = ?
    `).get(panelId) as PanelRow | undefined;
    return row ? mapPanelRow(row) : null;
  }

  async updatePanel(panelId: string, updates: Partial<Panel>): Promise<Panel> {
    const existing = await this.getPanel(panelId);
    if (!existing) {
      throw new Error(`Panel not found: ${panelId}`);
    }

    const next: Panel = {
      ...existing,
      ...updates,
    };

    const db = getDatabase();
    db.prepare(`
      UPDATE panels
      SET panelIndex = ?, imageUrl = ?, imageFilePath = ?, prompt = ?, storyBeat = ?, speechBubbleText = ?,
          status = ?, retryCount = ?, generatedAt = ?
      WHERE id = ?
    `).run(
      next.panelIndex,
      next.imageUrl ?? null,
      next.imageFilePath ?? null,
      next.prompt ?? null,
      next.storyBeat ?? null,
      next.speechBubbleText ?? null,
      next.status,
      next.retryCount,
      next.generatedAt ?? null,
      panelId
    );

    return next;
  }

  async updatePanelStatus(panelId: string, status: PanelStatus): Promise<void> {
    const db = getDatabase();
    db.prepare('UPDATE panels SET status = ? WHERE id = ?').run(status, panelId);
  }
}

export const panelRepository = new PanelRepository();
