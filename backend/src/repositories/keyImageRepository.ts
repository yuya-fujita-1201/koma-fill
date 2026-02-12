import { getDatabase } from '../database/connection';
import { ImageAnalysis, ImagePosition, KeyImage } from '../models/types';

type KeyImageRow = {
  id: string;
  projectId: string;
  imageFilePath: string;
  position: string;
  analysis: string | null;
  createdAt: string;
};

function parsePosition(value: unknown): ImagePosition {
  const raw = String(value);
  const maybeNumber = Number(raw);
  if (Number.isFinite(maybeNumber) && raw.trim() !== '') {
    return maybeNumber;
  }
  if (raw === 'start' || raw === 'end') {
    return raw;
  }
  return 'start';
}

function mapKeyImageRow(row: KeyImageRow): KeyImage {
  return {
    id: row.id,
    projectId: row.projectId,
    imageFilePath: row.imageFilePath,
    position: parsePosition(row.position),
    analysis: row.analysis ? JSON.parse(row.analysis) : undefined,
    createdAt: row.createdAt,
  };
}

export class KeyImageRepository {
  async createKeyImage(projectId: string, data: KeyImage): Promise<KeyImage> {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO keyImages (id, projectId, imageFilePath, position, analysis, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      projectId,
      data.imageFilePath,
      String(data.position),
      data.analysis ? JSON.stringify(data.analysis) : null,
      data.createdAt
    );
    return { ...data, projectId };
  }

  async getKeyImages(projectId: string): Promise<KeyImage[]> {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, projectId, imageFilePath, position, analysis, createdAt
      FROM keyImages
      WHERE projectId = ?
      ORDER BY createdAt ASC
    `).all(projectId) as KeyImageRow[];
    return rows.map(mapKeyImageRow);
  }

  async updateKeyImageAnalysis(imageId: string, analysis: ImageAnalysis): Promise<void> {
    const db = getDatabase();
    db.prepare('UPDATE keyImages SET analysis = ? WHERE id = ?').run(JSON.stringify(analysis), imageId);
  }
}

export const keyImageRepository = new KeyImageRepository();
