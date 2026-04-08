import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { LayoutConfig, Panel, SpeechBubble } from '../models/types';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { projectRepository } from '../repositories/projectRepository';
import { LayoutEngine } from '../services/layoutEngine';
import { ExportService } from '../services/exportService';
import { CONFIG } from '../config/constants';

const layoutEngine = new LayoutEngine();
const exportService = new ExportService();

export function buildAutomaticSpeechBubbles(panels: Panel[]): SpeechBubble[] {
  return [...panels]
    .sort((a, b) => a.panelIndex - b.panelIndex)
    .flatMap((panel) => {
      const text = panel.speechBubbleText?.trim();
      if (!text) {
        return [];
      }

      return [{
        panelIndex: panel.panelIndex,
        text,
        position: inferBubblePosition(text),
        style: inferBubbleStyle(text),
      }];
    });
}

function inferBubbleStyle(text: string): SpeechBubble['style'] {
  if (/^(?:モノローグ|ナレーション|地の文)\s*[:：]/.test(text)) {
    return 'rectangular';
  }

  if (/^[（(].+[）)]$/.test(text.trim())) {
    return 'cloud';
  }

  if (/[!?？！]{2,}/.test(text) || /[!?？！]$/.test(text)) {
    return 'spiked';
  }

  if (text.length >= 40) {
    return 'rectangular';
  }

  return 'rounded';
}

function inferBubblePosition(text: string): SpeechBubble['position'] {
  if (/^(?:モノローグ|ナレーション|地の文)\s*[:：]/.test(text)) {
    return 'top';
  }

  if (text.length >= 28) {
    return 'middle';
  }

  return 'top';
}

function toSafeFileSegment(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || 'manga-project';
}

export async function composeLayout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params;
    const { speechBubbles } = req.body as { speechBubbles?: unknown[] };

    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const panelPaths = project.panels
      .sort((a, b) => a.panelIndex - b.panelIndex)
      .filter((p) => p.imageFilePath && p.status === 'generated')
      .map((p) => p.imageFilePath) as string[];

    if (panelPaths.length === 0) {
      throw new ValidationError('No generated panel images found');
    }

    let layout = await layoutEngine.composePanels(panelPaths, project.layoutConfig as LayoutConfig);
    const requestedBubbles = Array.isArray(speechBubbles) ? speechBubbles as SpeechBubble[] : [];
    const resolvedSpeechBubbles = requestedBubbles.length > 0
      ? requestedBubbles
      : buildAutomaticSpeechBubbles(project.panels);

    if (resolvedSpeechBubbles.length > 0) {
      layout = await layoutEngine.addSpeechBubbles(layout, resolvedSpeechBubbles);
    }

    const layoutPath = path.join(CONFIG.STORAGE_PATH, projectId, 'layout.png');
    await fs.promises.mkdir(path.dirname(layoutPath), { recursive: true });
    await fs.promises.writeFile(layoutPath, layout.buffer);

    await projectRepository.updateProject(projectId, { status: 'complete' });

    res.json({
      message: 'Layout composed successfully',
      projectId,
      layoutPath: `/uploads/${projectId}/layout.png`,
      panelPositions: layout.panelPositions,
      dimensions: { width: layout.width, height: layout.height },
    });
  } catch (err) {
    next(err);
  }
}

export async function exportManga(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params;
    const { format, compression, resolution, title, author } = req.body as {
      format?: string;
      compression?: string;
      resolution?: 'web' | 'print';
      title?: string;
      author?: string;
    };

    const exportFormat = format || 'png';
    const exportCompression = compression || 'medium';
    const exportResolution = resolution || 'web';

    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const layoutPath = path.join(CONFIG.STORAGE_PATH, projectId, 'layout.png');
    try {
      await fs.promises.access(layoutPath);
    } catch {
      throw new ValidationError('Layout not yet generated. Call /layout endpoint first.');
    }

    const layoutBuffer = await fs.promises.readFile(layoutPath);
    const layout = {
      buffer: layoutBuffer,
      width: project.layoutConfig.pageWidth,
      height: project.layoutConfig.pageHeight,
      format: 'png' as const,
      readingOrder: project.layoutConfig.readingOrder,
      panelPositions: [],
    };

    const result = await exportService.export(layout, {
      format: exportFormat as 'png' | 'jpg' | 'pdf',
      compression: exportCompression as 'low' | 'medium' | 'high',
      resolution: exportResolution as 'web' | 'print',
      title: title || project.name,
      author: author || 'koma-fill',
    });

    const timestamp = Date.now();
    const safeProjectName = toSafeFileSegment(project.name);
    const filename = `${safeProjectName}_${timestamp}`;

    const internalOutputDir = path.join(CONFIG.STORAGE_PATH, projectId);
    const internalFilePath = await exportService.saveToFile(result, internalOutputDir, filename);
    const manuscriptOutputDir = path.join(CONFIG.EXPORT_PATH, safeProjectName);
    const savedPath = await exportService.saveToFile(result, manuscriptOutputDir, filename);

    await projectRepository.updateProject(projectId, { status: 'exported' });

    res.json({
      message: 'Export successful',
      projectId,
      format: result.format,
      downloadUrl: `/uploads/${projectId}/${path.basename(internalFilePath)}`,
      savedPath,
      savedDirectory: manuscriptOutputDir,
      fileSize: result.fileSize,
    });
  } catch (err) {
    next(err);
  }
}
