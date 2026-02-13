import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  composeLayout,
  exportManga,
} from '../controllers/exportController';
import {
  createProject,
  getProject,
  listProjects,
  reorderPanels,
  uploadKeyImages,
  upload,
} from '../controllers/projectController';
import {
  analyzeImages,
  generateImages,
  generatePrompts,
  regeneratePanel,
} from '../controllers/generationController';
import {
  imageAnalysisLimiter,
  imageGenerationLimiter,
} from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate);

// Project CRUD
router.post('/create', createProject);
router.post('/:projectId/upload', upload.array('images', 10), uploadKeyImages);
router.put('/:projectId/reorder', reorderPanels);
router.get('/:projectId', getProject);
router.get('/', listProjects);

// Generation Pipeline
router.post('/:projectId/analyze', imageAnalysisLimiter, analyzeImages);
router.post('/:projectId/generate-prompts', generatePrompts);
router.post('/:projectId/generate-images', imageGenerationLimiter, generateImages);
router.get('/:projectId/generate-images', imageGenerationLimiter, generateImages);
router.post('/:projectId/regenerate/:panelIndex', imageGenerationLimiter, regeneratePanel);

// Layout & Export
router.post('/:projectId/layout', composeLayout);
router.post('/:projectId/export', exportManga);

export default router;
