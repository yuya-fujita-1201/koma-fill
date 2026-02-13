import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import path from 'path';
import fs from 'fs';
import {
  AnalyzeImagesRequest,
  GenerateImagesRequest,
  GeneratePromptsRequest,
  PanelPrompt,
  RegeneratePanelRequest,
} from '../models/types';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { projectRepository } from '../repositories/projectRepository';
import { panelRepository } from '../repositories/panelRepository';
import { keyImageRepository } from '../repositories/keyImageRepository';
import { ImageGenerationService } from '../services/imageGenerationService';
import { ImageAnalysisService } from '../services/imageAnalysisService';
import { PromptGenerationService } from '../services/promptGenerationService';

const analyzeSchema = Joi.object<AnalyzeImagesRequest>({
  analysisDepth: Joi.string().valid('quick', 'detailed').default('quick'),
});

const generatePromptsSchema = Joi.object<GeneratePromptsRequest>({
  storyPrompt: Joi.string().trim().min(1).required(),
  panelCount: Joi.number().integer().min(1).max(12).required(),
  characterConsistency: Joi.boolean().default(true),
});

const generateImagesSchema = Joi.object<GenerateImagesRequest>({
  panelIndices: Joi.array().items(Joi.number().integer().min(0)).optional(),
  batchMode: Joi.string().valid('sequential', 'parallel').default('sequential'),
});

const imageAnalysisService = new ImageAnalysisService();
const promptGenerationService = new PromptGenerationService();
const imageGenerationService = new ImageGenerationService();

export async function analyzeImages(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      project.keyImages.map((image, index) => keyImageRepository.updateKeyImageAnalysis(image.id, analyses[index]))
    );

    await projectRepository.updateProject(projectId, { status: 'complete' });
    res.json(analyses);
  } catch (err) {
    next(err);
  }
}

export async function generatePrompts(req: Request, res: Response, next: NextFunction): Promise<void> {
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
        .filter((analysis): analysis is NonNullable<typeof image.analysis> => analysis !== undefined)
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
}

export async function generateImages(req: Request, res: Response, next: NextFunction): Promise<void> {
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
        res.write(`data: ${JSON.stringify(progressEvent)}\\n\\n`);
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
      })}\\n\\n`
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
        })}\\n\\n`
      );
      res.end();
      return;
    }
    next(err);
  }
}

export async function regeneratePanel(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const validated: RegeneratePanelRequest = req.body as RegeneratePanelRequest;
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
}
