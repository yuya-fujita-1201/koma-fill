import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection';
import {
  CreateMangaRequest,
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_LAYOUT_CONFIG,
  GenerationSettings,
  ImagePosition,
  KeyImage,
  LayoutConfig,
  MangaProject,
  Panel,
  ProjectStatus,
} from '../models/types';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  layoutConfig: string;
  generationSettings: string;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateProjectInput extends CreateMangaRequest {
  id?: string;
  name?: string;
  status?: ProjectStatus;
  layoutConfig: LayoutConfig;
  generationSettings: GenerationSettings;
  createdAt?: string;
  updatedAt?: string;
  totalCost?: number;
}

function mapProjectRow(row: ProjectRow, panels: Panel[] = [], keyImages: KeyImage[] = []): MangaProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    layoutConfig: JSON.parse(row.layoutConfig) as LayoutConfig,
    generationSettings: JSON.parse(row.generationSettings) as GenerationSettings,
    panels,
    keyImages,
    totalCost: row.totalCost ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getPanels(projectId: string): Panel[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, projectId, panelIndex, imageUrl, imageFilePath, prompt, storyBeat, speechBubbleText, status, retryCount, generatedAt, createdAt
    FROM panels
    WHERE projectId = ?
    ORDER BY panelIndex ASC
  `).all(projectId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.projectId),
    panelIndex: Number(row.panelIndex),
    imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
    imageFilePath: row.imageFilePath ? String(row.imageFilePath) : undefined,
    prompt: row.prompt ? String(row.prompt) : undefined,
    storyBeat: row.storyBeat ? String(row.storyBeat) : undefined,
    speechBubbleText: row.speechBubbleText ? String(row.speechBubbleText) : undefined,
    status: row.status as Panel['status'],
    retryCount: Number(row.retryCount ?? 0),
    generatedAt: row.generatedAt ? String(row.generatedAt) : undefined,
    createdAt: String(row.createdAt),
  }));
}

function getKeyImages(projectId: string): KeyImage[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, projectId, imageFilePath, position, analysis, createdAt
    FROM keyImages
    WHERE projectId = ?
    ORDER BY createdAt ASC
  `).all(projectId) as Array<Record<string, unknown>>;

  const parsePosition = (value: unknown): ImagePosition => {
    const raw = String(value);
    const parsedNumber = Number(raw);
    if (Number.isFinite(parsedNumber) && raw.trim() !== '') {
      return parsedNumber;
    }
    if (raw === 'start' || raw === 'end') {
      return raw;
    }
    return 'start';
  };

  return rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.projectId),
    imageFilePath: String(row.imageFilePath),
    position: parsePosition(row.position),
    analysis: row.analysis ? JSON.parse(String(row.analysis)) : undefined,
    createdAt: String(row.createdAt),
  }));
}

export class ProjectRepository {
  async createProject(data: CreateProjectInput): Promise<MangaProject> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = data.id ?? uuidv4();
    const name = data.name ?? data.projectName;
    const description = data.storyPrompt;
    const status: ProjectStatus = data.status ?? 'draft';
    const layoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...data.layoutConfig };
    const generationSettings = { ...DEFAULT_GENERATION_SETTINGS, ...data.generationSettings };
    const createdAt = data.createdAt ?? now;
    const updatedAt = data.updatedAt ?? now;
    const totalCost = data.totalCost ?? 0;

    db.prepare(`
      INSERT INTO projects (id, name, description, status, layoutConfig, generationSettings, totalCost, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description,
      status,
      JSON.stringify(layoutConfig),
      JSON.stringify(generationSettings),
      totalCost,
      createdAt,
      updatedAt
    );

    return {
      id,
      name,
      description,
      status,
      layoutConfig,
      generationSettings,
      panels: [],
      keyImages: [],
      totalCost,
      createdAt,
      updatedAt,
    };
  }

  async getProject(id: string): Promise<MangaProject | null> {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT id, name, description, status, layoutConfig, generationSettings, totalCost, createdAt, updatedAt
      FROM projects
      WHERE id = ?
    `).get(id) as ProjectRow | undefined;

    if (!row) {
      return null;
    }

    return mapProjectRow(row, getPanels(id), getKeyImages(id));
  }

  async listProjects(limit: number, offset: number): Promise<MangaProject[]> {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, name, description, status, layoutConfig, generationSettings, totalCost, createdAt, updatedAt
      FROM projects
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as ProjectRow[];

    return rows.map((row) => mapProjectRow(row, getPanels(row.id), getKeyImages(row.id)));
  }

  async countProjects(): Promise<number> {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    return row.count;
  }

  async updateProject(id: string, updates: Partial<MangaProject>): Promise<MangaProject> {
    const existing = await this.getProject(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    const next: MangaProject = {
      ...existing,
      ...updates,
      layoutConfig: updates.layoutConfig ? { ...existing.layoutConfig, ...updates.layoutConfig } : existing.layoutConfig,
      generationSettings: updates.generationSettings
        ? { ...existing.generationSettings, ...updates.generationSettings }
        : existing.generationSettings,
      updatedAt: new Date().toISOString(),
    };

    const db = getDatabase();
    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, status = ?, layoutConfig = ?, generationSettings = ?, totalCost = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      next.name,
      next.description ?? null,
      next.status,
      JSON.stringify(next.layoutConfig),
      JSON.stringify(next.generationSettings),
      next.totalCost,
      next.updatedAt,
      id
    );

    return next;
  }

  async deleteProject(id: string): Promise<void> {
    const db = getDatabase();
    const tx = db.transaction((projectId: string) => {
      db.prepare('DELETE FROM panels WHERE projectId = ?').run(projectId);
      db.prepare('DELETE FROM keyImages WHERE projectId = ?').run(projectId);
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    });
    tx(id);
  }
}

export const projectRepository = new ProjectRepository();
