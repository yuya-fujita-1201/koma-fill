import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config/constants';
import {
  CreateMangaRequest,
  KeyImage,
  Panel,
  ReorderPanelsRequest,
} from '../models/types';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { projectRepository } from '../repositories/projectRepository';
import { panelRepository } from '../repositories/panelRepository';
import { keyImageRepository } from '../repositories/keyImageRepository';
import { DEFAULT_GENERATION_SETTINGS, DEFAULT_LAYOUT_CONFIG } from '../models/types';

const createMangaSchema = Joi.object<CreateMangaRequest>({
  projectName: Joi.string().trim().min(1).max(200).required(),
  storyPrompt: Joi.string().trim().min(1).required(),
  layoutConfig: Joi.object({
    totalPanels: Joi.number().integer().min(1).max(CONFIG.MAX_PANELS_PER_PROJECT),
    format: Joi.string().valid('vertical', 'horizontal', 'square'),
    readingOrder: Joi.string().valid('japanese', 'western'),
    gutterSize: Joi.number().integer().min(0),
    borderWidth: Joi.number().integer().min(0),
    borderColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    pageWidth: Joi.number().integer().min(200),
    pageHeight: Joi.number().integer().min(200),
  }).optional(),
  generationSettings: Joi.object({
    imageStyle: Joi.string().trim().min(1),
    aspectRatio: Joi.string().valid('square', 'wide', 'tall'),
    qualityLevel: Joi.string().valid('standard', 'hd'),
    negativePrompt: Joi.string().allow('', null),
    seed: Joi.number().integer(),
  }).optional(),
});

const reorderSchema = Joi.object<ReorderPanelsRequest>({
  panelOrder: Joi.array().items(Joi.number().integer().min(0)).min(1).required(),
});

export const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const destination = path.resolve(CONFIG.STORAGE_PATH);
    fs.mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

export async function createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { error, value } = createMangaSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const body = value as CreateMangaRequest;
    const project = await projectRepository.createProject({
      ...body,
      layoutConfig: {
        ...DEFAULT_LAYOUT_CONFIG,
        ...(body.layoutConfig ?? {}),
      },
      generationSettings: {
        ...DEFAULT_GENERATION_SETTINGS,
        ...(body.generationSettings ?? {}),
      },
    });

    const panelCount = project.layoutConfig.totalPanels;
    const panels: Panel[] = Array.from({ length: panelCount }, (_, panelIndex) => ({
      id: uuidv4(),
      projectId: project.id,
      panelIndex,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    }));

    for (const panel of panels) {
      await panelRepository.createPanel(project.id, panel);
    }

    const fullProject = await projectRepository.getProject(project.id);
    if (!fullProject) {
      throw new Error('Failed to load created project');
    }

    res.status(201).json(fullProject);
  } catch (err) {
    next(err);
  }
}

export async function uploadKeyImages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params;
    const files = (req.files as Express.Multer.File[]) ?? [];
    const project = await projectRepository.getProject(projectId);

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (files.length === 0) {
      throw new ValidationError('No image files uploaded');
    }

    const requestedPositionsRaw = req.body.positions;
    const positionList = Array.isArray(requestedPositionsRaw)
      ? requestedPositionsRaw
      : requestedPositionsRaw
        ? [requestedPositionsRaw]
        : [];

    const createdImages = files.map((file, index) => {
      const rawPosition = positionList[index] ?? req.body.position ?? (index === 0 ? 'start' : 'end');
      const numericPosition = Number(rawPosition);
      const position = Number.isNaN(numericPosition) ? rawPosition : numericPosition;

      const image: KeyImage = {
        id: uuidv4(),
        projectId,
        imageFilePath: file.path,
        position,
        createdAt: new Date().toISOString(),
      };

      return keyImageRepository.createKeyImage(projectId, image);
    });

    res.json(await Promise.all(createdImages));
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params;
    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const offset = Number(req.query.offset ?? 0) || 0;
    const projects = await projectRepository.listProjects(limit, offset);
    const totalCount = await projectRepository.countProjects();
    res.setHeader('X-Total-Count', String(totalCount));
    res.json(projects);
  } catch (err) {
    next(err);
  }
}

export async function reorderPanels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params;
    const { error, value } = reorderSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const panelOrder = (value as ReorderPanelsRequest).panelOrder;
    const existingPanels = await panelRepository.getPanelsByProject(projectId);

    if (existingPanels.length !== panelOrder.length) {
      throw new ValidationError('panelOrder length must match the number of panels');
    }

    const panelByCurrentIndex = new Map(existingPanels.map((panel) => [panel.panelIndex, panel]));

    const updatedPanels = panelOrder.map((currentPanelIndex, nextIndex) => {
      const panel = panelByCurrentIndex.get(currentPanelIndex);
      if (!panel) {
        throw new ValidationError(`Invalid panel index in panelOrder: ${currentPanelIndex}`);
      }
      return panelRepository.updatePanel(panel.id, {
        panelIndex: nextIndex,
      });
    });

    const reorderedPanels = await Promise.all(updatedPanels);
    res.json(reorderedPanels.sort((a, b) => a.panelIndex - b.panelIndex));
  } catch (err) {
    next(err);
  }
}
