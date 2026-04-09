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
const AUTO_SPLIT_MIN_LENGTH = 28;
const AUTO_SPLIT_PUNCTUATION = /[、。！？?!…]/u;

export function buildAutomaticSpeechBubbles(panels: Panel[]): SpeechBubble[] {
  return [...panels]
    .sort((a, b) => a.panelIndex - b.panelIndex)
    .flatMap((panel) => {
      const segments = splitSpeechBubbleText(panel.speechBubbleText).map((text) => ({
        text,
        style: inferBubbleStyle(text),
      }));
      if (segments.length === 0) {
        return [];
      }

      const hasNarrationLead = isNarrationText(segments[0].text);
      let dialogueSlotIndex = 0;

      return segments.map((segment) => {
        const bubble: SpeechBubble = {
          panelIndex: panel.panelIndex,
          text: segment.text,
          position: inferBubblePosition(segment.text, dialogueSlotIndex, hasNarrationLead),
          style: segment.style,
        };

        if (!isNarrationText(segment.text)) {
          dialogueSlotIndex += 1;
        }

        return bubble;
      });
    });
}

export function splitSpeechBubbleText(text?: string): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n+|\s*\|\|\s*/g)
    .flatMap((segment) => autoSplitBubbleSegment(segment.trim()))
    .filter(Boolean);
}

export function inferBubbleStyle(text: string): SpeechBubble['style'] {
  if (isNarrationText(text)) {
    return 'rectangular';
  }

  if (isThoughtText(text)) {
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

export function inferBubblePosition(
  text: string,
  dialogueSlotIndex = 0,
  hasNarrationLead = false
): SpeechBubble['position'] {
  if (isNarrationText(text)) {
    return 'top';
  }

  if (isThoughtText(text)) {
    if (hasNarrationLead) {
      return dialogueSlotIndex === 0 ? 'middle' : 'bottom';
    }
    return 'middle';
  }

  const dialogueTrack = hasNarrationLead
    ? (['middle', 'bottom'] as const)
    : (['top', 'middle', 'bottom'] as const);
  const trackPosition = dialogueTrack[Math.min(dialogueSlotIndex, dialogueTrack.length - 1)];

  if (text.length >= 28 && trackPosition === 'top') {
    return 'middle';
  }

  return trackPosition;
}

function isNarrationText(text: string): boolean {
  return /^(?:モノローグ|ナレーション|地の文)\s*[:：]/.test(text);
}

function isThoughtText(text: string): boolean {
  return /^[（(].+[）)]$/.test(text.trim());
}

function autoSplitBubbleSegment(segment: string): string[] {
  if (!segment) {
    return [];
  }

  if (segment.length < AUTO_SPLIT_MIN_LENGTH || isNarrationText(segment) || isThoughtText(segment)) {
    return [segment];
  }

  const splitIndex = findAutoSplitIndex(segment);
  if (splitIndex < 0) {
    return [segment];
  }

  const first = segment.slice(0, splitIndex + 1).trim();
  const second = segment.slice(splitIndex + 1).trim();

  if (first.length < 4 || second.length < 4) {
    return [segment];
  }

  return [first, second];
}

function findAutoSplitIndex(segment: string): number {
  const lowerBound = Math.floor(segment.length * 0.25);
  const upperBound = Math.ceil(segment.length * 0.8);
  const midpoint = segment.length / 2;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = lowerBound; index < upperBound; index += 1) {
    if (!AUTO_SPLIT_PUNCTUATION.test(segment[index])) {
      continue;
    }

    const distance = Math.abs(index - midpoint);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }

  return bestIndex;
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
