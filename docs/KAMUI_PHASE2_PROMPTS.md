# KAMUI-4D Phase 2 Parallel Task Prompts for koma-fill
## 品質基盤 + アーキテクチャ改善 — Multi-Agent Implementation Guide

**Version:** 2.0
**Project:** koma-fill - AI-powered manga panel generation system
**Target:** KAMUI-4D Editor (Multi-AI CLI parallel execution)
**Date:** 2026-02-13
**前提:** Phase 1（コア実装）完了済み。TypeScriptコンパイル通過済み。

---

## Overview

Phase 1 で構築したコアパイプライン（全5サービス + フロントエンド2ページ）に対し、**品質基盤**と**アーキテクチャ改善**を同時に行う4並列タスク。

### Task Summary

| Task | Agent | 内容 | 推定時間 | 新規ファイル数 |
|------|-------|------|----------|---------------|
| Task 1 | Agent A | Jest設定 + バックエンドユニットテスト | 60-80分 | ~10ファイル |
| Task 2 | Agent B | 認証ミドルウェア + レート制限強化 | 30-45分 | ~3ファイル |
| Task 3 | Agent C | コントローラー層分離（manga.ts → 3分割） | 40-50分 | ~4ファイル |
| Task 4 | Agent D | フロントエンド品質強化（ErrorBoundary + hooks分離） | 50-70分 | ~6ファイル |

### Execution Strategy

```
Timeline:
  ┌──────────────────────────────┐
  │ Task 1 (Tests)    Agent A    │ 60-80 min
  └──────────────────────────────┘
  ┌──────────────────────┐
  │ Task 2 (Auth)  Agent B│ 30-45 min
  └──────────────────────┘
  ┌────────────────────────┐
  │ Task 3 (Split)  Agent C│ 40-50 min
  └────────────────────────┘
  ┌───────────────────────────┐
  │ Task 4 (Frontend) Agent D │ 50-70 min
  └───────────────────────────┘
```

**並列実行:** 全4タスクを同時開始可能。依存関係なし。

### 注意事項（全タスク共通）

1. **既存ファイルの変更は最小限に。** 既存の動作を壊さないこと。
2. **TypeScript strict mode 準拠。** `npx tsc --noEmit` が通ること。
3. **ESLint v9 (flat config)** — ルートの `eslint.config.js` を使用。
4. **作業前に `npm install`** を backend / frontend それぞれで実行すること。
5. **コミットメッセージは `feat:` / `test:` / `refactor:` プレフィックス付き。**

---

## Task 1: Jest設定 + バックエンドユニットテスト (Agent A)
### Service Layer Unit Tests with Mocked Dependencies

**Time Estimate:** 60-80 minutes
**Difficulty:** Intermediate-Hard
**Dependencies:** None

### Objective
Jest + ts-jest を設定し、バックエンドの全5サービスと3リポジトリに対するユニットテストを作成する。外部依存（OpenAI API, Sharp, fs）は全てモックする。

### Target Files to Create

```
backend/
├── jest.config.ts                    [NEW] Jest設定
├── src/
│   ├── services/
│   │   └── __tests__/
│   │       ├── imageAnalysisService.test.ts    [NEW]
│   │       ├── promptGenerationService.test.ts [NEW]
│   │       ├── imageGenerationService.test.ts  [NEW]
│   │       ├── layoutEngine.test.ts            [NEW]
│   │       └── exportService.test.ts           [NEW]
│   ├── repositories/
│   │   └── __tests__/
│   │       ├── projectRepository.test.ts       [NEW]
│   │       ├── panelRepository.test.ts         [NEW]
│   │       └── keyImageRepository.test.ts      [NEW]
│   └── middleware/
│       └── __tests__/
│           └── errorHandler.test.ts            [NEW]
```

### Target Files to Modify

```
backend/package.json    [MODIFY] test スクリプトを確認（既に jest --passWithNoTests）
```

---

### Step 1: Jest 設定ファイル作成

**File:** `backend/jest.config.ts`

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
  // OpenAI, Sharp などの外部モジュールはモック
  moduleNameMapper: {
    '^openai$': '<rootDir>/src/__mocks__/openai.ts',
  },
};

export default config;
```

---

### Step 2: サービス層テスト

#### 2-1: ImageAnalysisService テスト

**File:** `backend/src/services/__tests__/imageAnalysisService.test.ts`

テスト対象メソッド:
- `analyzeImage(base64Image, depth)` — 単一画像の分析
- `analyzeMultiple(images, depth)` — 複数画像の分析

モック対象:
- `openai.chat.completions.create` — Vision API呼び出し

テストケース:
1. `analyzeImage` が有効なbase64画像でImageAnalysisオブジェクトを返すこと
2. `analyzeImage` の `depth='detailed'` でより長いプロンプトが送信されること
3. `analyzeMultiple` が複数画像を順次処理し、配列で返すこと
4. OpenAI API エラー時に `OpenAIError` をスローすること
5. 不正なJSON応答時に `ValidationError` をスローすること
6. リトライロジック: 429 Too Many Requests で自動リトライすること

**モック方法:**
```typescript
// OpenAI をモック
jest.mock('openai');

import OpenAI from 'openai';
import { ImageAnalysisService } from '../imageAnalysisService';

const mockCreate = jest.fn();
(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
} as unknown as OpenAI));

// テスト用のモックレスポンス
const mockAnalysisResponse = {
  choices: [{
    message: {
      content: JSON.stringify({
        description: 'A manga panel showing a character',
        characters: [{ name: 'Hero', appearance: 'spiky hair', emotion: 'determined', position: 'center' }],
        objects: ['sword', 'shield'],
        colors: ['red', 'blue'],
        composition: 'center-focused',
        mood: 'intense',
        artStyle: 'shonen manga',
        suggestedTransitions: ['zoom_in', 'cut'],
      }),
    },
  }],
};
```

#### 2-2: PromptGenerationService テスト

**File:** `backend/src/services/__tests__/promptGenerationService.test.ts`

テスト対象メソッド:
- `generatePanelPrompts(storyPrompt, analyses, panelCount, settings)`

テストケース:
1. `panelCount=4` で4つの `PanelPrompt` が返ること
2. 各PanelPromptに `dallePrompt`, `storyBeat`, `panelIndex` が含まれること
3. `characterConsistency=true` で分析結果がプロンプトに反映されること
4. `imageStyle` がDALL-Eプロンプトに含まれること
5. OpenAI API エラー時に `OpenAIError` をスローすること
6. 不正なJSON応答のパースエラー処理

#### 2-3: ImageGenerationService テスト

**File:** `backend/src/services/__tests__/imageGenerationService.test.ts`

テスト対象メソッド:
- `generatePanel(prompt, panelIndex, projectId, settings)` — 単一パネル生成
- `generateBatch(panelPrompts, projectId, batchMode, settings, onProgress)` — バッチ生成

モック対象:
- `openai.images.generate` — DALL-E 3 API
- `fs/promises` — ファイル書き込み
- `fetch` or `https` — 画像ダウンロード（DALL-E URLから）

テストケース:
1. `generatePanel` が `GeneratedPanel` オブジェクトを返すこと
2. `quality='hd'` で DALL-E API に `quality: 'hd'` が渡ること
3. `generateBatch` の `sequential` モードで順次生成されること
4. `onProgress` コールバックが各パネルごとに呼ばれること
5. API エラー時のリトライ（最大 `MAX_RETRIES_PER_PANEL` 回）
6. 全リトライ失敗時のエラーハンドリング
7. `costUsd` の計算が正しいこと（standard=$0.04, hd=$0.08）

#### 2-4: LayoutEngine テスト

**File:** `backend/src/services/__tests__/layoutEngine.test.ts`

テスト対象メソッド:
- `composePanels(panelPaths, config)` — パネル画像をレイアウト合成
- `addSpeechBubbles(layout, bubbles)` — 吹き出し追加

モック対象:
- `sharp` — 画像処理
- `fs/promises` — ファイル読み込み

テストケース:
1. `composePanels` が `ComposedLayout` を返すこと
2. `panelPositions` がパネル数と一致すること
3. `readingOrder='japanese'` で右→左の配置になること
4. `readingOrder='western'` で左→右の配置になること
5. `addSpeechBubbles` が SVG を合成すること
6. 空のパネルパスで `ValidationError` をスローすること

**Sharpモック方法:**
```typescript
jest.mock('sharp');
import sharp from 'sharp';

const mockSharpInstance = {
  metadata: jest.fn().mockResolvedValue({ width: 1024, height: 1024 }),
  resize: jest.fn().mockReturnThis(),
  composite: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-png-data')),
};

(sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
```

#### 2-5: ExportService テスト

**File:** `backend/src/services/__tests__/exportService.test.ts`

テスト対象メソッド:
- `export(layout, options)` — レイアウトをフォーマット変換
- `saveToFile(result, outputDir, filename)` — ファイル保存

テストケース:
1. PNG エクスポートが正しいバッファを返すこと
2. JPG エクスポートが正しいバッファを返すこと
3. PDF エクスポートが正しいバッファを返すこと
4. `compression` オプションが反映されること
5. `saveToFile` がディレクトリ作成 + ファイル書き込みを行うこと
6. 不正な format で `ValidationError` をスローすること

---

### Step 3: リポジトリ層テスト

リポジトリテストは **実際の SQLite in-memory DB** を使用する。

**共通セットアップ:**
```typescript
import { initializeDatabase } from '../../database/connection';

beforeEach(() => {
  // In-memory DB で初期化（テストごとにクリーンな状態）
  // connection.ts の initializeDatabase を呼ぶか、
  // テスト用のDB接続を作成する
});
```

**注意:** 現在の `connection.ts` がファイルベースDBしか対応していない場合、
テスト用に `:memory:` オプションを受け付けるよう**最小限の変更**を加えてよい。
例: `initializeDatabase(dbPath?: string)` のようにパスを引数化。

#### projectRepository テスト
- `createProject` / `getProject` / `updateProject` / `listProjects` / `countProjects`

#### panelRepository テスト
- `createPanel` / `updatePanel` / `getPanelsByProject`

#### keyImageRepository テスト
- `createKeyImage` / `updateKeyImageAnalysis`

---

### Step 4: errorHandler テスト

**File:** `backend/src/middleware/__tests__/errorHandler.test.ts`

テストケース:
1. `AppError` が正しい statusCode とメッセージを返すこと
2. `NotFoundError` が 404 を返すこと
3. `ValidationError` が 400 を返すこと
4. `OpenAIError` が 502 を返すこと
5. 未知のエラーが 500 を返すこと

---

### Verification (Task 1)

```bash
cd backend

# テスト実行
npm test

# カバレッジ確認（オプション）
npx jest --coverage

# TypeScript コンパイルチェック（テストファイル含む）
npx tsc --noEmit
```

**Expected:**
- 全テスト PASS
- TypeScript エラーなし
- テストファイル数: 9ファイル以上

---

## Task 2: 認証ミドルウェア + レート制限強化 (Agent B)
### API Key Authentication & Per-Route Rate Limiting

**Time Estimate:** 30-45 minutes
**Difficulty:** Easy-Intermediate
**Dependencies:** None

### Objective
シンプルなAPIキー認証ミドルウェアを実装し、エンドポイントごとのレート制限を追加する。認証は Bearer トークン（APIキー）方式。開発環境ではオプショナル、本番環境では必須とする。

### Target Files

```
backend/src/
├── middleware/
│   ├── auth.ts                     [NEW] 認証ミドルウェア
│   └── rateLimiter.ts              [NEW] エンドポイント別レート制限
├── config/
│   └── constants.ts                [MODIFY] 認証関連の設定追加
├── routes/
│   └── manga.ts                    [MODIFY] ミドルウェア適用
├── app.ts                          [MODIFY] 認証ミドルウェア登録
.env.example                        [MODIFY] 新しい環境変数追加
```

---

### Step 1: 認証ミドルウェア

**File:** `backend/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { CONFIG } from '../config/constants';
import { AppError } from './errorHandler';

/**
 * APIキー認証ミドルウェア
 *
 * - Authorization: Bearer <API_KEY> ヘッダーを検証
 * - 開発環境 (NODE_ENV=development) かつ API_KEYS 未設定の場合はスキップ
 * - 本番環境では必須
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  // 開発環境でAPIキー未設定ならスキップ
  if (CONFIG.NODE_ENV === 'development' && CONFIG.API_KEYS.length === 0) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Provide Authorization: Bearer <API_KEY>', 401));
  }

  const token = authHeader.slice(7); // 'Bearer '.length
  if (!CONFIG.API_KEYS.includes(token)) {
    return next(new AppError('Invalid API key', 403));
  }

  next();
}

/**
 * 特定ルートのみ認証をスキップ（ヘルスチェックなど）
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(); // 認証ヘッダーなしでもOK
  }

  // ヘッダーがある場合は検証する
  return authenticate(req, _res, next);
}
```

---

### Step 2: エンドポイント別レート制限

**File:** `backend/src/middleware/rateLimiter.ts`

```typescript
import rateLimit from 'express-rate-limit';
import { CONFIG } from '../config/constants';

/**
 * 画像生成系エンドポイント用（DALL-E APIコスト制御）
 * 1分あたり DALLE_RATE_LIMIT_PER_MINUTE リクエスト
 */
export const imageGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: CONFIG.DALLE_RATE_LIMIT_PER_MINUTE,
  message: {
    error: 'Image generation rate limit exceeded. Please wait before generating more images.',
    retryAfterMs: 60000,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 画像分析系エンドポイント用
 */
export const imageAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: CONFIG.VISION_RATE_LIMIT_PER_MINUTE,
  message: {
    error: 'Analysis rate limit exceeded. Please wait before analyzing more images.',
    retryAfterMs: 60000,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 一般APIエンドポイント用（CRUD操作など）
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

---

### Step 3: CONFIG に認証設定を追加

**File:** `backend/src/config/constants.ts`

**変更内容:** CONFIG オブジェクトに以下を追加:

```typescript
// --- 以下を既存の CONFIG オブジェクト内に追加 ---

// Authentication
API_KEYS: process.env.API_KEYS
  ? process.env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  : [],
```

`as const` アサーション内に追加する場合、`API_KEYS` は `string[]` 型になるため、
`as const` の外か、もしくは型定義を調整すること。

**重要:** 現在の CONFIG は `as const` で宣言されている。`API_KEYS` は動的配列なので、
CONFIG の型定義を以下のように変更する必要がある:

```typescript
export const CONFIG = {
  // ... 既存のプロパティ ...

  // Authentication
  API_KEYS: (process.env.API_KEYS
    ? process.env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
    : []) as string[],
} as const;
```

もしくは `as const` を外して通常のオブジェクトにする。
ただし他の箇所への影響を最小限にするため、`API_KEYS` だけ `as string[]` キャストするのが安全。

---

### Step 4: ルートにミドルウェアを適用

**File:** `backend/src/routes/manga.ts`

**変更内容:** ファイル先頭のimportに追加:

```typescript
import { authenticate } from '../middleware/auth';
import { imageGenerationLimiter, imageAnalysisLimiter } from '../middleware/rateLimiter';
```

各ルートにミドルウェアを追加:

```typescript
// 認証が必要なルート（全ルート）
router.use(authenticate);

// 画像分析系
router.post('/:projectId/analyze', imageAnalysisLimiter, async (req, res, next) => { ... });

// 画像生成系（コストが高いのでレート制限）
router.post('/:projectId/generate-images', imageGenerationLimiter, handleGenerateImages);
router.get('/:projectId/generate-images', imageGenerationLimiter, handleGenerateImages);
router.post('/:projectId/regenerate/:panelIndex', imageGenerationLimiter, async (req, res, next) => { ... });
```

**注意:** `router.use(authenticate)` をルーター先頭に追加すれば、全ルートに一括適用される。
個別に適用する場合は各ルート定義に追加。

---

### Step 5: .env.example を更新

**File:** `.env.example`

以下を追加:

```
# --- 認証 ---
# APIキー（カンマ区切りで複数指定可能）
# 開発環境では未設定でもOK（認証スキップ）
# 本番環境では必須
# API_KEYS=your-api-key-1,your-api-key-2
```

---

### Step 6: app.ts のグローバルレート制限を整理

**File:** `backend/src/app.ts`

**変更内容:** 既存のグローバル `rateLimit` を `generalLimiter` に置き換え:

```typescript
// 既存のコード:
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({ ... });
app.use('/api/', limiter);

// 変更後:
import { generalLimiter } from './middleware/rateLimiter';
app.use('/api/', generalLimiter);
```

`rateLimit` の直接importと `limiter` 定数は削除する。
`express-rate-limit` のimportは `rateLimiter.ts` で行われるため、`app.ts` からは不要。

---

### Verification (Task 2)

```bash
cd backend

# TypeScript コンパイルチェック
npx tsc --noEmit

# ビルド
npm run build

# サーバー起動テスト（5秒で自動終了）
timeout 5 node dist/index.js 2>&1 || true

# 認証テスト（開発環境: API_KEYS未設定ならスキップされるはず）
# curl http://localhost:5000/api/manga → 200 OK
# curl -H "Authorization: Bearer invalid-key" http://localhost:5000/api/manga → 200 or 403（設定による）
```

**Expected:**
- TypeScript エラーなし
- ビルド成功
- 開発環境でAPI_KEYS未設定時は認証スキップで正常動作

---

## Task 3: コントローラー層分離 (Agent C)
### Split manga.ts (714 lines) into Controller Modules

**Time Estimate:** 40-50 minutes
**Difficulty:** Intermediate
**Dependencies:** None

### Objective
`backend/src/routes/manga.ts`（714行）を3つのコントローラーファイルに分割し、ルーターをシンプルなディスパッチャーに変える。Joi バリデーションスキーマもコントローラーと一緒に移動する。

### Target Files

```
backend/src/
├── controllers/                     [NEW DIRECTORY]
│   ├── projectController.ts         [NEW] CRUD操作
│   ├── generationController.ts      [NEW] 分析・プロンプト生成・画像生成
│   └── exportController.ts          [NEW] レイアウト合成・エクスポート
├── routes/
│   └── manga.ts                     [REWRITE] シンプルなルーター定義のみ
```

---

### 分割方針

| コントローラー | 担当ルート | 元の行数 |
|---------------|-----------|---------|
| `projectController.ts` | `POST /create`, `GET /:projectId`, `GET /`, `POST /:projectId/upload`, `PUT /:projectId/reorder` | ~200行 |
| `generationController.ts` | `POST /:projectId/analyze`, `POST /:projectId/generate-prompts`, `POST /:projectId/generate-images`, `GET /:projectId/generate-images`, `POST /:projectId/regenerate/:panelIndex` | ~320行 |
| `exportController.ts` | `POST /:projectId/layout`, `POST /:projectId/export` | ~130行 |

---

### Step 1: projectController.ts

**File:** `backend/src/controllers/projectController.ts`

移動する要素:
- `createMangaSchema` (Joi)
- `reorderSchema` (Joi)
- Multer設定 (`storage`, `upload`)
- `POST /create` ハンドラー
- `POST /:projectId/upload` ハンドラー
- `PUT /:projectId/reorder` ハンドラー
- `GET /:projectId` ハンドラー
- `GET /` ハンドラー

**フォーマット:**
```typescript
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
// ... 必要なimport

// Joi Schemas
const createMangaSchema = Joi.object<CreateMangaRequest>({ ... });
const reorderSchema = Joi.object<ReorderPanelsRequest>({ ... });

// Multer setup
const storage = multer.diskStorage({ ... });
export const upload = multer({ ... });

// Handlers
export async function createProject(req: Request, res: Response, next: NextFunction) { ... }
export async function uploadKeyImages(req: Request, res: Response, next: NextFunction) { ... }
export async function reorderPanels(req: Request, res: Response, next: NextFunction) { ... }
export async function getProject(req: Request, res: Response, next: NextFunction) { ... }
export async function listProjects(req: Request, res: Response, next: NextFunction) { ... }
```

**重要:** `upload` はmulterミドルウェアとしてルーターで使うため、`export` する。

---

### Step 2: generationController.ts

**File:** `backend/src/controllers/generationController.ts`

移動する要素:
- `analyzeSchema` (Joi)
- `generatePromptsSchema` (Joi)
- `generateImagesSchema` (Joi)
- サービスインスタンスの生成: `imageAnalysisService`, `promptGenerationService`, `imageGenerationService`
- `POST /:projectId/analyze` ハンドラー
- `POST /:projectId/generate-prompts` ハンドラー
- `handleGenerateImages` ハンドラー（SSEストリーミング）
- `POST /:projectId/regenerate/:panelIndex` ハンドラー

```typescript
// サービスインスタンス（モジュールレベルでシングルトン）
const imageAnalysisService = new ImageAnalysisService();
const promptGenerationService = new PromptGenerationService();
const imageGenerationService = new ImageGenerationService();

export async function analyzeImages(req: Request, res: Response, next: NextFunction) { ... }
export async function generatePrompts(req: Request, res: Response, next: NextFunction) { ... }
export async function generateImages(req: Request, res: Response, next: NextFunction) { ... }
export async function regeneratePanel(req: Request, res: Response, next: NextFunction) { ... }
```

---

### Step 3: exportController.ts

**File:** `backend/src/controllers/exportController.ts`

移動する要素:
- サービスインスタンス: `layoutEngine`, `exportService`
- `POST /:projectId/layout` ハンドラー
- `POST /:projectId/export` ハンドラー

```typescript
const layoutEngine = new LayoutEngine();
const exportService = new ExportService();

export async function composeLayout(req: Request, res: Response, next: NextFunction) { ... }
export async function exportManga(req: Request, res: Response, next: NextFunction) { ... }
```

---

### Step 4: manga.ts をシンプルなルーター定義に書き換え

**File:** `backend/src/routes/manga.ts`

```typescript
import { Router } from 'express';
import {
  createProject,
  uploadKeyImages,
  reorderPanels,
  getProject,
  listProjects,
  upload,
} from '../controllers/projectController';
import {
  analyzeImages,
  generatePrompts,
  generateImages,
  regeneratePanel,
} from '../controllers/generationController';
import {
  composeLayout,
  exportManga,
} from '../controllers/exportController';

const router = Router();

// Project CRUD
router.post('/create', createProject);
router.post('/:projectId/upload', upload.array('images', 10), uploadKeyImages);
router.put('/:projectId/reorder', reorderPanels);
router.get('/:projectId', getProject);
router.get('/', listProjects);

// Generation Pipeline
router.post('/:projectId/analyze', analyzeImages);
router.post('/:projectId/generate-prompts', generatePrompts);
router.post('/:projectId/generate-images', generateImages);
router.get('/:projectId/generate-images', generateImages);
router.post('/:projectId/regenerate/:panelIndex', regeneratePanel);

// Layout & Export
router.post('/:projectId/layout', composeLayout);
router.post('/:projectId/export', exportManga);

export default router;
```

**目標:** `manga.ts` が ~40行以下になること。

---

### Verification (Task 3)

```bash
cd backend

# TypeScript コンパイルチェック
npx tsc --noEmit

# ビルド
npm run build

# manga.ts の行数確認（40行以下が理想）
wc -l src/routes/manga.ts

# 各コントローラーの存在確認
ls -la src/controllers/

# 全export/importの整合性確認
npx tsc --noEmit 2>&1 | grep -i "error" | head -20
```

**Expected:**
- TypeScript エラーなし
- `manga.ts` が ~40行以下
- 3つのコントローラーファイルが存在
- 動作に変更なし（リファクタリングのみ）

---

## Task 4: フロントエンド品質強化 (Agent D)
### ErrorBoundary, LoadingSpinner, Hooks分離, エラー表示改善

**Time Estimate:** 50-70 minutes
**Difficulty:** Intermediate
**Dependencies:** None

### Objective
フロントエンドの品質を向上させる。ErrorBoundary でクラッシュ防止、LoadingSpinner で統一的なローディング表示、カスタムフックの分離でコードの保守性を向上させる。

### Target Files

```
frontend/src/
├── components/
│   ├── ErrorBoundary.tsx            [NEW] React Error Boundary
│   ├── LoadingSpinner.tsx           [NEW] 汎用ローディングコンポーネント
│   └── MangaLayoutViewer.tsx        [NEW] レイアウト表示（ズーム対応）
├── hooks/
│   ├── useProject.ts                [NEW] プロジェクトCRUDフック
│   └── useExport.ts                 [NEW] エクスポート操作フック
├── App.tsx                          [MODIFY] ErrorBoundary適用
├── pages/
│   ├── CreateMangaPage.tsx          [MODIFY] 新hooks使用
│   └── PreviewPage.tsx              [MODIFY] 新hooks + MangaLayoutViewer使用
```

---

### Step 1: ErrorBoundary コンポーネント

**File:** `frontend/src/components/ErrorBoundary.tsx`

```typescript
import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              エラーが発生しました
            </h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || '予期しないエラーが発生しました'}
            </p>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              再試行
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

### Step 2: LoadingSpinner コンポーネント

**File:** `frontend/src/components/LoadingSpinner.tsx`

```typescript
import React from 'react';

interface LoadingSpinnerProps {
  /** 表示サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** メッセージ */
  message?: string;
  /** フルスクリーンオーバーレイ */
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  fullScreen = false,
}) => {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${sizeClasses[size]} border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin`}
      />
      {message && (
        <p className="text-gray-600 text-sm animate-pulse">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};
```

---

### Step 3: MangaLayoutViewer コンポーネント

**File:** `frontend/src/components/MangaLayoutViewer.tsx`

機能:
- 生成されたレイアウト画像を表示
- ピンチズーム / マウスホイールズーム対応
- フルスクリーン表示ボタン
- パネルクリックで詳細表示

```typescript
import React, { useState, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';

interface MangaLayoutViewerProps {
  imageUrl: string;
  alt?: string;
  dimensions?: { width: number; height: number };
}

export const MangaLayoutViewer: React.FC<MangaLayoutViewerProps> = ({
  imageUrl,
  alt = 'Manga Layout',
  dimensions,
}) => {
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(prev + 0.1, 3));
    } else {
      setZoom((prev) => Math.max(prev - 0.1, 0.25));
    }
  }, []);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  const containerClass = isFullScreen
    ? 'fixed inset-0 z-50 bg-gray-900 flex flex-col'
    : 'relative bg-gray-100 rounded-lg overflow-hidden';

  return (
    <div className={containerClass} ref={containerRef}>
      {/* ツールバー */}
      <div className="flex items-center gap-2 p-2 bg-gray-800 text-white">
        <button onClick={handleZoomOut} className="p-1 hover:bg-gray-700 rounded" title="ズームアウト">
          <ZoomOut size={20} />
        </button>
        <span className="text-sm min-w-[4rem] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} className="p-1 hover:bg-gray-700 rounded" title="ズームイン">
          <ZoomIn size={20} />
        </button>
        <button onClick={() => setZoom(1)} className="px-2 py-1 text-xs hover:bg-gray-700 rounded">
          リセット
        </button>
        <div className="flex-1" />
        <button onClick={toggleFullScreen} className="p-1 hover:bg-gray-700 rounded" title="フルスクリーン">
          {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
        {dimensions && (
          <span className="text-xs text-gray-400">
            {dimensions.width} × {dimensions.height}
          </span>
        )}
      </div>

      {/* 画像表示エリア */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-4"
        onWheel={handleWheel}
      >
        <img
          src={imageUrl}
          alt={alt}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease-out',
            maxWidth: 'none',
          }}
          className="select-none"
          draggable={false}
        />
      </div>
    </div>
  );
};
```

---

### Step 4: useProject フック

**File:** `frontend/src/hooks/useProject.ts`

```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { MangaProject } from '../types';

interface UseProjectReturn {
  project: MangaProject | null;
  projects: MangaProject[];
  loading: boolean;
  error: string | null;
  createProject: (data: { projectName: string; storyPrompt: string; layoutConfig?: object; generationSettings?: object }) => Promise<MangaProject>;
  fetchProject: (projectId: string) => Promise<void>;
  fetchProjects: (limit?: number, offset?: number) => Promise<void>;
  clearError: () => void;
}

export function useProject(): UseProjectReturn {
  const [project, setProject] = useState<MangaProject | null>(null);
  const [projects, setProjects] = useState<MangaProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = useCallback(async (data: Parameters<UseProjectReturn['createProject']>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const created = await apiClient.createProject(data);
      setProject(created);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProject = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await apiClient.getProject(projectId);
      setProject(fetched);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch project';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async (limit?: number, offset?: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.listProjects(limit, offset);
      setProjects(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { project, projects, loading, error, createProject, fetchProject, fetchProjects, clearError };
}
```

**注意:** `apiClient` の既存メソッド名に合わせること。実際のメソッド名は `frontend/src/services/apiClient.ts` を確認して調整。

---

### Step 5: useExport フック

**File:** `frontend/src/hooks/useExport.ts`

```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

interface ExportResult {
  downloadUrl: string;
  format: string;
  fileSize: number;
}

interface UseExportReturn {
  exporting: boolean;
  exportResult: ExportResult | null;
  error: string | null;
  composeLayout: (projectId: string, speechBubbles?: object[]) => Promise<void>;
  exportManga: (projectId: string, options?: { format?: string; compression?: string; resolution?: string }) => Promise<ExportResult>;
  clearExportState: () => void;
}

export function useExport(): UseExportReturn {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const composeLayout = useCallback(async (projectId: string, speechBubbles?: object[]) => {
    setExporting(true);
    setError(null);
    try {
      await apiClient.composeLayout(projectId, speechBubbles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compose layout';
      setError(message);
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  const exportManga = useCallback(async (
    projectId: string,
    options?: { format?: string; compression?: string; resolution?: string }
  ) => {
    setExporting(true);
    setError(null);
    try {
      const result = await apiClient.exportManga(projectId, options);
      setExportResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  const clearExportState = useCallback(() => {
    setExportResult(null);
    setError(null);
  }, []);

  return { exporting, exportResult, error, composeLayout, exportManga, clearExportState };
}
```

**注意:** `apiClient` のメソッド名は実際のファイルを確認して調整すること。

---

### Step 6: App.tsx に ErrorBoundary を適用

**File:** `frontend/src/App.tsx`

**変更内容:** ルートコンポーネントを `<ErrorBoundary>` で囲む:

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      {/* 既存の Router / Routes はそのまま */}
      ...
    </ErrorBoundary>
  );
}
```

---

### Step 7: ページコンポーネントを新hooks + 新コンポーネントで更新

**File:** `frontend/src/pages/CreateMangaPage.tsx`

**変更内容（最小限）:**
- `useProject` フックをインポートして、プロジェクト作成ロジックをフックに委譲
- `LoadingSpinner` を使ったローディング表示の統一
- ページ全体のエラー表示を共通化

```tsx
import { useProject } from '../hooks/useProject';
import { LoadingSpinner } from '../components/LoadingSpinner';

// 既存のインラインstate管理の代わりに useProject を使用
const { project, loading, error, createProject, clearError } = useProject();
```

**File:** `frontend/src/pages/PreviewPage.tsx`

**変更内容（最小限）:**
- `useExport` フックを使ったエクスポート処理
- `MangaLayoutViewer` を使ったレイアウト表示
- `LoadingSpinner` の適用

```tsx
import { useExport } from '../hooks/useExport';
import { MangaLayoutViewer } from '../components/MangaLayoutViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
```

**重要:** 既存の `useMangaGeneration` フックはそのまま維持する。新しいフックは追加機能として使用し、既存のフックを破壊しないこと。

---

### Verification (Task 4)

```bash
cd frontend

# TypeScript コンパイルチェック
npx tsc --noEmit

# Viteビルド
npm run build

# 新ファイルの存在確認
ls -la src/components/ErrorBoundary.tsx
ls -la src/components/LoadingSpinner.tsx
ls -la src/components/MangaLayoutViewer.tsx
ls -la src/hooks/useProject.ts
ls -la src/hooks/useExport.ts
```

**Expected:**
- TypeScript エラーなし
- ビルド成功
- 5つの新ファイルが存在
- 既存の動作に変更なし

---

## Post-Merge Integration Test

全4タスクが完了し、mainブランチにマージした後に実行:

```bash
# ルートから
cd /path/to/koma-fill

# 依存インストール
npm install --workspaces

# バックエンドテスト
cd backend && npm test

# バックエンドビルド
npm run build

# フロントエンドビルド
cd ../frontend && npm run build

# TypeScript チェック（全体）
cd ../backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit

# サーバー起動確認
cd ../backend
timeout 5 node dist/index.js 2>&1 || true
```

### 確認ポイント

| チェック項目 | 期待値 |
|-------------|--------|
| `npm test` (backend) | 全テストPASS |
| `tsc --noEmit` (backend) | エラーなし |
| `tsc --noEmit` (frontend) | エラーなし |
| `npm run build` (backend) | dist/ 生成 |
| `npm run build` (frontend) | dist/ 生成 |
| Server startup | クラッシュなし |
| `manga.ts` 行数 | ~40行以下 |
| `controllers/` ファイル数 | 3ファイル |
| テストファイル数 | 9ファイル以上 |
| `middleware/auth.ts` 存在 | あり |
| `middleware/rateLimiter.ts` 存在 | あり |
| `ErrorBoundary.tsx` 存在 | あり |
| `LoadingSpinner.tsx` 存在 | あり |

---

## Appendix: 次のPhase 3候補

Phase 2完了後に取り組むべき項目:

1. **E2Eテスト** — Playwright or Cypress でフロントエンド〜API結合テスト
2. **パネル削除API** — `DELETE /api/manga/:projectId/panels/:panelIndex`
3. **generation_log テーブル** — API呼び出し・コスト記録
4. **キャンセル機能** — SSE画像生成のキャンセル対応（AbortController）
5. **Docker構成** — Dockerfile + docker-compose.yml
6. **README.md** — セットアップ手順、使い方ドキュメント
7. **CI/CD** — GitHub Actions でテスト・ビルド自動化
