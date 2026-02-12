import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { CONFIG } from '../config/constants';

const router = Router();

// Multer設定: 画像アップロード
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(CONFIG.STORAGE_PATH));
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
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ============================================
// プロジェクト作成
// POST /api/manga/create
// ============================================
router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: [Agent A] CreateMangaRequest のバリデーション
    // TODO: [Agent A] プロジェクトをDBに作成
    // TODO: [Agent A] パネルの初期レコードを作成
    res.status(201).json({
      message: 'TODO: Implement project creation',
      body: req.body,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// キー画像アップロード
// POST /api/manga/:projectId/upload
// ============================================
router.post('/:projectId/upload',
  upload.array('images', 2),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const files = req.files as Express.Multer.File[];
      // TODO: [Agent A] アップロード画像をDBに保存
      // TODO: [Agent A] 画像のposition情報を保存
      res.json({
        message: 'TODO: Implement image upload',
        projectId,
        filesCount: files?.length || 0,
      });
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
    // TODO: [Agent B] ImageAnalysisService を呼び出し
    // TODO: [Agent B] Vision API でキー画像を分析
    // TODO: [Agent B] 分析結果をDBに保存
    res.json({
      message: 'TODO: Implement image analysis',
      projectId,
    });
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
    // TODO: [Agent B] PromptGenerationService を呼び出し
    // TODO: [Agent B] ストーリーをコマごとのビートに分割
    // TODO: [Agent B] 各コマ用のDALL-E 3プロンプトを生成
    res.json({
      message: 'TODO: Implement prompt generation',
      projectId,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// 画像生成 (SSE ストリーミング)
// POST /api/manga/:projectId/generate-images
// ============================================
router.post('/:projectId/generate-images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    // TODO: [Agent C] SSEレスポンスヘッダー設定
    // TODO: [Agent C] ImageGenerationService を呼び出し
    // TODO: [Agent C] 各パネルをDALL-E 3で生成（進捗をSSEで送信）
    // TODO: [Agent C] リトライロジック
    res.json({
      message: 'TODO: Implement image generation with SSE',
      projectId,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// パネル再生成
// POST /api/manga/:projectId/regenerate/:panelIndex
// ============================================
router.post('/:projectId/regenerate/:panelIndex', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, panelIndex } = req.params;
    // TODO: [Agent C] 指定パネルを新しいプロンプトで再生成
    res.json({
      message: 'TODO: Implement panel regeneration',
      projectId,
      panelIndex,
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
    // TODO: [Agent A] パネルの順番をDB上で更新
    res.json({
      message: 'TODO: Implement panel reordering',
      projectId,
    });
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
    // TODO: [Agent D] LayoutEngine を呼び出し
    // TODO: [Agent D] パネルをグリッドに配置
    // TODO: [Agent D] ガター・ボーダー・吹き出しを追加
    res.json({
      message: 'TODO: Implement layout composition',
      projectId,
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
    // TODO: [Agent D] ExportService を呼び出し
    // TODO: [Agent D] PNG/JPG/PDF形式で出力
    res.json({
      message: 'TODO: Implement export',
      projectId,
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
    // TODO: [Agent A] DBからプロジェクト情報を取得
    res.json({
      message: 'TODO: Implement project fetch',
      projectId,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// プロジェクト一覧
// GET /api/manga
// ============================================
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: [Agent A] DBから全プロジェクトを取得（ページネーション）
    res.json({
      message: 'TODO: Implement project list',
      projects: [],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
