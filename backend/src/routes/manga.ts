import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config/constants';
import {
  AnalyzeImagesRequest,
  CreateMangaRequest,
  GenerateImagesRequest,
  GeneratePromptsRequest,
  Panel,
  PanelPrompt,
  ReorderPanelsRequest,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_GENERATION_SETTINGS,
  KeyImage,
} from '../models/types';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { projectRepository } from '../repositories/projectRepository';
import { panelRepository } from '../repositories/panelRepository';
import { keyImageRepository } from '../repositories/keyImageRepository';
import { ImageGenerationService } from '../services/imageGenerationService';
import { ImageAnalysisService } from '../services/imageAnalysisService';
import { PromptGenerationService } from '../services/promptGenerationService';
import { LayoutEngine } from '../services/layoutEngine';
import { ExportService } from '../services/exportService';

const router = Router();
const imageAnalysisService = new ImageAnalysisService();
const promptGenerationService = new PromptGenerationService();
const layoutEngine = new LayoutEngine();
const exportService = new ExportService();
const imageGenerationService = new ImageGenerationService();

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

const analyzeSchema = Joi.object<AnalyzeImagesRequest>({
  analysisDepth: Joi.string().valid('quick', 'detailed').default('quick'),
});

const generatePromptsSchema = Joi.object<GeneratePromptsRequest>({
  storyPrompt: Joi.string().trim().min(1).required(),
  panelCount: Joi.number().integer().min(1).max(CONFIG.MAX_PANELS_PER_PROJECT).required(),
  characterConsistency: Joi.boolean().default(true),
});

const generateImagesSchema = Joi.object<GenerateImagesRequest>({
  panelIndices: Joi.array().items(Joi.number().integer().min(0)).optional(),
  batchMode: Joi.string().valid('sequential', 'parallel').default('sequential'),
});

// Multer設定: 画像アップロード
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const destination = path.resolve(CONFIG.STORAGE_PATH);
    fs.mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
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

// ============================================
// プロジェクト作成
// POST /api/manga/create
// ============================================
router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
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
});

// ============================================
// キー画像アップロード
// POST /api/manga/:projectId/upload
// ============================================
router.post('/:projectId/upload',
  upload.array('images', 10),
  async (req: Request, res: Response, next: NextFunction) => {
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
);

// ============================================
// 画像分析
// POST /api/manga/:projectId/analyze
// ============================================
router.post('/:projectId/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { error, value } = analyzeSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }
    if (project.keyImages.length === 0) {
      throw new ValidationError('No key images uploaded for this project');
    }

    await projectRepository.updateProject(projectId, { status: 'analyzing' });

    const depth = (value as AnalyzeImagesRequest).analysisDepth;
    const payload = await Promise.all(
      project.keyImages.map(async (image) => {
        const imageBuffer = await fs.promises.readFile(path.resolve(image.imageFilePath));
        return {
          base64: imageBuffer.toString('base64'),
          position: String(image.position),
        };
      })
    );

    const analyses = await imageAnalysisService.analyzeMultiple(payload, depth);
    await Promise.all(
      project.keyImages.map((image, index) =>
        keyImageRepository.updateKeyImageAnalysis(image.id, analyses[index]))
    );

    await projectRepository.updateProject(projectId, { status: 'complete' });

    res.json(analyses);
  } catch (err) {
    next(err);
  }
});

// ============================================
// パネルプロンプト生成
// POST /api/manga/:projectId/generate-prompts
// ============================================
router.post('/:projectId/generate-prompts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { error, value } = generatePromptsSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const payload = value as GeneratePromptsRequest;
    const analyses = payload.characterConsistency
      ? project.keyImages
        .map((image) => image.analysis)
        .filter((analysis): analysis is NonNullable<KeyImage['analysis']> => analysis !== undefined)
      : [];

    const prompts = await promptGenerationService.generatePanelPrompts(
      payload.storyPrompt,
      analyses,
      payload.panelCount,
      project.generationSettings
    );

    const panels = [...project.panels].sort((a, b) => a.panelIndex - b.panelIndex);
    if (panels.length < prompts.length) {
      throw new ValidationError('panelCount exceeds existing project panel count');
    }
    const panelByIndex = new Map(panels.map((panel) => [panel.panelIndex, panel]));

    await Promise.all(
      prompts.map((prompt: PanelPrompt, index) => {
        const panel = panelByIndex.get(prompt.panelIndex) ?? panels[index];
        return panelRepository.updatePanel(panel.id, {
          prompt: prompt.dallePrompt,
          storyBeat: prompt.storyBeat,
          status: 'pending',
        });
      })
    );

    await projectRepository.updateProject(projectId, { status: 'generating' });
    res.json(prompts);
  } catch (err) {
    next(err);
  }
});

// ============================================
// 画像生成 (SSE ストリーミング)
// POST /api/manga/:projectId/generate-images
// ============================================
const handleGenerateImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const source = req.method === 'GET' ? req.query : req.body;
    const { error, value } = generateImagesSchema.validate(source, {
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      throw new ValidationError(error.details.map((d) => d.message).join(', '));
    }

    const payload = value as GenerateImagesRequest;
    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const panelsToGenerate = project.panels
      .filter((panel) => !payload.panelIndices || payload.panelIndices.includes(panel.panelIndex))
      .filter((panel) => Boolean(panel.prompt));

    if (panelsToGenerate.length === 0) {
      throw new ValidationError('No target panels with prompts found');
    }

    const panelPrompts = panelsToGenerate.map((panel) => ({
      panelIndex: panel.panelIndex,
      dallePrompt: panel.prompt as string,
      storyBeat: panel.storyBeat ?? `Panel ${panel.panelIndex + 1}`,
      visualFocus: 'main subject',
      transitionType: 'cut' as const,
    }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const generatedPanels = await imageGenerationService.generateBatch(
      panelPrompts,
      projectId,
      payload.batchMode,
      project.generationSettings,
      (progressEvent) => {
        res.write(`data: ${JSON.stringify(progressEvent)}\n\n`);
      }
    );

    const panelByIndex = new Map(project.panels.map((panel) => [panel.panelIndex, panel]));

    await Promise.all(
      generatedPanels.map(async (generated) => {
        const target = panelByIndex.get(generated.panelIndex);
        if (!target) {
          return;
        }

        await panelRepository.updatePanel(target.id, {
          imageUrl: generated.imageUrl,
          imageFilePath: generated.localFilePath,
          prompt: generated.revisedPrompt ?? generated.prompt,
          status: 'generated',
          generatedAt: new Date().toISOString(),
        });
      })
    );

    const successIndices = new Set(generatedPanels.map((panel) => panel.panelIndex));
    const failedTargets = panelsToGenerate.filter((panel) => !successIndices.has(panel.panelIndex));
    await Promise.all(
      failedTargets.map((panel) =>
        panelRepository.updatePanel(panel.id, {
          status: 'failed',
          retryCount: panel.retryCount + 1,
        })
      )
    );

    const totalCost = generatedPanels.reduce((sum, panel) => sum + panel.costUsd, 0);
    await projectRepository.updateProject(projectId, {
      totalCost: project.totalCost + totalCost,
      status: 'generating',
    });

    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        stage: 'generating_images',
        currentStep: generatedPanels.length,
        totalSteps: panelsToGenerate.length,
        percentage: 100,
        message: 'Image generation complete',
        totalCost,
      })}\n\n`
    );
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          stage: 'generating_images',
          currentStep: 0,
          totalSteps: 0,
          percentage: 0,
          message: err instanceof Error ? err.message : 'Image generation failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        })}\n\n`
      );
      res.end();
      return;
    }
    next(err);
  }
};

router.post('/:projectId/generate-images', handleGenerateImages);
router.get('/:projectId/generate-images', handleGenerateImages);

// ============================================
// パネル再生成
// POST /api/manga/:projectId/regenerate/:panelIndex
// ============================================
router.post('/:projectId/regenerate/:panelIndex', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, panelIndex } = req.params;
    const parsedPanelIndex = Number(panelIndex);
    if (Number.isNaN(parsedPanelIndex) || parsedPanelIndex < 0) {
      throw new ValidationError('panelIndex must be a non-negative integer');
    }

    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const targetPanel = project.panels.find((panel) => panel.panelIndex === parsedPanelIndex);
    if (!targetPanel) {
      throw new NotFoundError(`Panel index ${parsedPanelIndex}`);
    }

    const requestedPrompt = typeof req.body?.newPrompt === 'string'
      ? req.body.newPrompt.trim()
      : '';
    const prompt = requestedPrompt || targetPanel.prompt;
    if (!prompt) {
      throw new ValidationError('No prompt found for target panel');
    }

    const panelPrompt: PanelPrompt = {
      panelIndex: parsedPanelIndex,
      dallePrompt: prompt,
      storyBeat: targetPanel.storyBeat ?? `Panel ${parsedPanelIndex + 1}`,
      visualFocus: 'main subject',
      transitionType: 'cut',
    };

    const generatedPanels = await imageGenerationService.generateBatch(
      [panelPrompt],
      projectId,
      'sequential',
      project.generationSettings
    );

    if (generatedPanels.length === 0) {
      throw new Error(`Panel ${parsedPanelIndex} regeneration failed`);
    }

    const generated = generatedPanels[0];
    const updated = await panelRepository.updatePanel(targetPanel.id, {
      imageUrl: generated.imageUrl,
      imageFilePath: generated.localFilePath,
      prompt: generated.revisedPrompt ?? generated.prompt,
      status: 'generated',
      retryCount: targetPanel.retryCount + 1,
      generatedAt: new Date().toISOString(),
    });

    await projectRepository.updateProject(projectId, {
      totalCost: project.totalCost + generated.costUsd,
      status: 'generating',
    });

    res.json({
      message: 'Panel regenerated successfully',
      panel: updated,
      costUsd: generated.costUsd,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// パネル並び替え
// PUT /api/manga/:projectId/reorder
// ============================================
router.put('/:projectId/reorder', async (req: Request, res: Response, next: NextFunction) => {
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
});

// ============================================
// レイアウト合成
// POST /api/manga/:projectId/layout
// ============================================
router.post('/:projectId/layout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { speechBubbles } = req.body;

    // プロジェクトとパネルを取得
    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    // 生成済みパネルの画像パスを取得
    const panelPaths = project.panels
      .sort((a, b) => a.panelIndex - b.panelIndex)
      .filter(p => p.imageFilePath && p.status === 'generated')
      .map(p => p.imageFilePath) as string[];

    if (panelPaths.length === 0) {
      throw new ValidationError('No generated panel images found');
    }

    // レイアウトを合成
    let layout = await layoutEngine.composePanels(panelPaths, project.layoutConfig);

    // 吹き出しを追加（指定されている場合）
    if (speechBubbles && Array.isArray(speechBubbles) && speechBubbles.length > 0) {
      layout = await layoutEngine.addSpeechBubbles(layout, speechBubbles);
    }

    // レイアウトを一時ファイルに保存
    const layoutPath = path.join(CONFIG.STORAGE_PATH, projectId, 'layout.png');
    await fs.promises.mkdir(path.dirname(layoutPath), { recursive: true });
    await fs.promises.writeFile(layoutPath, layout.buffer);

    // プロジェクトステータスを更新
    await projectRepository.updateProject(projectId, { status: 'complete' });

    res.json({
      message: 'Layout composed successfully',
      projectId,
      layoutPath: `/uploads/${projectId}/layout.png`,
      panelPositions: layout.panelPositions,
      dimensions: { width: layout.width, height: layout.height }
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// エクスポート
// POST /api/manga/:projectId/export
// ============================================
router.post('/:projectId/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { format, compression, resolution, title, author } = req.body;

    // デフォルト値
    const exportFormat = format || 'png';
    const exportCompression = compression || 'medium';
    const exportResolution = resolution || 'web';

    // プロジェクトを取得
    const project = await projectRepository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    // レイアウトファイルを読み込み
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
      panelPositions: []
    };

    // エクスポート
    const result = await exportService.export(layout, {
      format: exportFormat,
      compression: exportCompression,
      resolution: exportResolution,
      title: title || project.name,
      author: author || 'koma-fill',
    });

    // ファイル名を生成
    const timestamp = Date.now();
    const filename = `manga_${timestamp}`;

    // ファイルを保存
    const outputDir = path.join(CONFIG.STORAGE_PATH, projectId);
    const filePath = await exportService.saveToFile(result, outputDir, filename);

    // プロジェクトステータスを更新
    await projectRepository.updateProject(projectId, { status: 'exported' });

    res.json({
      message: 'Export successful',
      projectId,
      format: exportFormat,
      downloadUrl: `/uploads/${projectId}/${path.basename(filePath)}`,
      fileSize: result.fileSize,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// プロジェクト取得
// GET /api/manga/:projectId
// ============================================
router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
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
});

// ============================================
// プロジェクト一覧
// GET /api/manga
// ============================================
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
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
});

export default router;
