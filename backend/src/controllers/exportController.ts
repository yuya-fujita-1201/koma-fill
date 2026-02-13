import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { LayoutConfig, SpeechBubble } from '../models/types';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { projectRepository } from '../repositories/projectRepository';
import { LayoutEngine } from '../services/layoutEngine';
import { ExportService } from '../services/exportService';
import { CONFIG } from '../config/constants';

const layoutEngine = new LayoutEngine();
const exportService = new ExportService();

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

    if (speechBubbles && Array.isArray(speechBubbles) && speechBubbles.length > 0) {
      layout = await layoutEngine.addSpeechBubbles(layout, speechBubbles as SpeechBubble[]);
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
    const filename = `manga_${timestamp}`;

    const outputDir = path.join(CONFIG.STORAGE_PATH, projectId);
    const filePath = await exportService.saveToFile(result, outputDir, filename);

    await projectRepository.updateProject(projectId, { status: 'exported' });

    res.json({
      message: 'Export successful',
      projectId,
      format: result.format,
      downloadUrl: `/uploads/${projectId}/${path.basename(filePath)}`,
      fileSize: result.fileSize,
    });
  } catch (err) {
    next(err);
  }
}
