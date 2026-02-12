# koma-fill アーキテクチャドキュメント

## 1. プロジェクト概要

**koma-fill** は、AI画像生成を活用した漫画パネル補間ツールです。ユーザーが1〜2枚のキー画像とストーリープロンプトを入力すると、中間パネルを自動生成し、最終的に漫画レイアウトとして組み立てます。

### 主な機能
- キー画像の自動分析（Vision API）
- ストーリープロンプト → 各コマのプロンプト自動生成
- DALL-E 3による高品質なパネル画像生成
- Sharp を用いた漫画レイアウト合成
- 複数フォーマットでの出力（PNG / JPG / PDF）

---

## 2. 技術スタック

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: SQLite3
- **Image Processing**: Sharp
- **API Integration**: OpenAI (DALL-E 3, Vision API)

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks / Context API

### 外部サービス
- **OpenAI DALL-E 3**: 画像生成
- **OpenAI Vision API**: 画像分析

---

## 3. ディレクトリ構造

```
koma-fill/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── projectController.ts
│   │   │   ├── panelController.ts
│   │   │   └── exportController.ts
│   │   ├── services/
│   │   │   ├── ImageAnalysisService.ts
│   │   │   ├── PromptGenerationService.ts
│   │   │   ├── ImageGenerationService.ts
│   │   │   ├── LayoutEngine.ts
│   │   │   ├── ExportService.ts
│   │   │   └── RateLimitService.ts
│   │   ├── models/
│   │   │   ├── Project.ts
│   │   │   ├── Panel.ts
│   │   │   └── KeyImage.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rateLimiter.ts
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   ├── projects.ts
│   │   │   ├── panels.ts
│   │   │   └── export.ts
│   │   ├── database/
│   │   │   ├── db.ts
│   │   │   └── migrations/
│   │   └── app.ts
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProjectForm.tsx
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── PromptEditor.tsx
│   │   │   ├── PanelPreview.tsx
│   │   │   ├── MangaLayoutViewer.tsx
│   │   │   └── ExportDialog.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── ProjectEditor.tsx
│   │   │   └── Results.tsx
│   │   ├── hooks/
│   │   │   ├── useProject.ts
│   │   │   ├── usePanelGeneration.ts
│   │   │   └── useExport.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docs/
│   ├── ARCHITECTURE.md (このファイル)
│   ├── API.md
│   └── SETUP.md
└── README.md
```

---

## 4. サービス層アーキテクチャ

### 4.1 ImageAnalysisService
キー画像を Vision API で分析し、コンテンツ、色彩、構図などのメタデータを抽出します。

```typescript
// src/services/ImageAnalysisService.ts
interface ImageAnalysisResult {
  description: string;
  mainColors: string[];
  subjects: string[];
  composition: string;
  mood: string;
  style: string;
}

class ImageAnalysisService {
  async analyzeImage(imageBuffer: Buffer): Promise<ImageAnalysisResult>
  async compareImages(image1: Buffer, image2: Buffer): Promise<TransitionAnalysis>
}
```

### 4.2 PromptGenerationService
ストーリープロンプトとキー画像の分析結果を組み合わせて、各コマに対応するプロンプトを生成します。

```typescript
// src/services/PromptGenerationService.ts
interface PanelPrompt {
  panelNumber: number;
  description: string;
  generationPrompt: string;
  constraints: string[];
}

class PromptGenerationService {
  async generatePanelPrompts(
    storyPrompt: string,
    keyImageAnalysis: ImageAnalysisResult[],
    panelCount: number
  ): Promise<PanelPrompt[]>

  async refinePrompt(
    basePrompt: string,
    styleGuides: string[]
  ): Promise<string>
}
```

### 4.3 ImageGenerationService
生成されたプロンプトを DALL-E 3 に送信し、パネル画像を生成します。

```typescript
// src/services/ImageGenerationService.ts
interface GenerationConfig {
  model: string;
  size: '1024x1024' | '1792x1024' | '1024x1792';
  quality: 'standard' | 'hd';
  timeout: number;
}

class ImageGenerationService {
  async generatePanel(
    prompt: string,
    config: GenerationConfig
  ): Promise<Buffer>

  async generateBatch(
    prompts: PanelPrompt[],
    config: GenerationConfig
  ): Promise<Map<number, Buffer>>

  private async validatePrompt(prompt: string): Promise<boolean>
}
```

### 4.4 LayoutEngine
生成されたパネル画像を Sharp で合成し、漫画レイアウト（見開き、コマ割りなど）を作成します。

```typescript
// src/services/LayoutEngine.ts
interface LayoutConfig {
  pageWidth: number;
  pageHeight: number;
  dpi: number;
  panelsPerPage: number;
  layout: 'horizontal' | 'vertical' | 'mixed';
  borderWidth: number;
  borderColor: string;
}

class LayoutEngine {
  async createLayout(
    panels: Map<number, Buffer>,
    config: LayoutConfig
  ): Promise<Buffer>

  async addPanelNumbers(image: Buffer): Promise<Buffer>
  async addWatermark(image: Buffer, text: string): Promise<Buffer>
  private calculateGridLayout(panelCount: number): GridLayout
}
```

### 4.5 ExportService
最終的な漫画レイアウトを複数フォーマットでエクスポートします。

```typescript
// src/services/ExportService.ts
interface ExportOptions {
  format: 'png' | 'jpg' | 'pdf';
  quality: number;
  compression: number;
}

class ExportService {
  async exportToPNG(
    image: Buffer,
    options: ExportOptions
  ): Promise<Buffer>

  async exportToJPG(
    image: Buffer,
    options: ExportOptions
  ): Promise<Buffer>

  async exportToPDF(
    pages: Buffer[],
    metadata: PDFMetadata,
    options: ExportOptions
  ): Promise<Buffer>
}
```

---

## 5. データフロー図

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Workflow Flow                            │
└─────────────────────────────────────────────────────────────────────┘

     ┌──────────────────┐
     │  Upload Stage    │
     │ (Key Images +    │
     │  Story Prompt)   │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────────────────┐
     │  ImageAnalysisService        │
     │ (Vision API)                 │
     │ ├─ Extract descriptions      │
     │ ├─ Identify colors/subjects  │
     │ ├─ Analyze composition       │
     │ └─ Determine style/mood      │
     └────────┬─────────────────────┘
              │
              ▼
     ┌──────────────────────────────┐
     │  PromptGenerationService     │
     │ ├─ Parse story prompt        │
     │ ├─ Map narrative to panels   │
     │ ├─ Generate per-panel prompts│
     │ └─ Enhance with style guides │
     └────────┬─────────────────────┘
              │
              ▼
     ┌──────────────────────────────┐
     │  ImageGenerationService      │
     │ (DALL-E 3)                   │
     │ ├─ Validate prompts          │
     │ ├─ Generate images in batch  │
     │ └─ Implement retry logic     │
     └────────┬─────────────────────┘
              │
              ▼
     ┌──────────────────────────────┐
     │  LayoutEngine                │
     │ (Sharp)                      │
     │ ├─ Arrange panels            │
     │ ├─ Add borders/dividers      │
     │ ├─ Number panels             │
     │ └─ Composite pages           │
     └────────┬─────────────────────┘
              │
              ▼
     ┌──────────────────────────────┐
     │  ExportService               │
     │ ├─ Format conversion         │
     │ ├─ Quality optimization      │
     │ └─ Multi-page assembly       │
     └────────┬─────────────────────┘
              │
              ▼
     ┌──────────────────┐
     │  Output Result   │
     │ (PNG/JPG/PDF)    │
     └──────────────────┘
```

---

## 6. データベーススキーマ (SQLite)

### manga_projects テーブル
ユーザーのプロジェクト情報を保存します。

```sql
CREATE TABLE manga_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  story_prompt TEXT NOT NULL,
  panel_count INTEGER DEFAULT 8,
  status TEXT DEFAULT 'draft', -- draft, processing, completed, error
  layout_config JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  UNIQUE(user_id, title)
);
```

### panels テーブル
各パネルの情報とその生成履歴を保存します。

```sql
CREATE TABLE panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  panel_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  generated_image_path TEXT,
  image_hash TEXT UNIQUE,
  generation_status TEXT DEFAULT 'pending', -- pending, generating, completed, failed
  generation_time_ms INTEGER,
  revision_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES manga_projects(id),
  UNIQUE(project_id, panel_number)
);
```

### key_images テーブル
アップロードされたキー画像とその分析結果を保存します。

```sql
CREATE TABLE key_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  image_type TEXT DEFAULT 'start', -- start, end, reference
  image_path TEXT NOT NULL,
  image_hash TEXT UNIQUE NOT NULL,
  analysis_result JSON NOT NULL, -- ImageAnalysisResult
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES manga_projects(id)
);
```

### generation_log テーブル
DALL-E 3 API呼び出しログ（レート制限・監視用）。

```sql
CREATE TABLE generation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  project_id INTEGER,
  status_code INTEGER,
  tokens_used INTEGER,
  request_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES manga_projects(id)
);
```

---

## 7. フロントエンドコンポーネント構成

```
App (Root)
├── Home Page
│   ├── ProjectForm
│   │   └── useProject (custom hook)
│   └── ImageUploader
│       └── useImageValidation (custom hook)
├── ProjectEditor Page
│   ├── ImagePreview
│   ├── PromptEditor
│   │   └── useDraftSave (custom hook)
│   ├── PanelPreview (Grid)
│   │   └── PanelCard (multiple)
│   └── GenerationProgress
│       └── usePanelGeneration (custom hook)
├── Results Page
│   ├── MangaLayoutViewer
│   │   └── ZoomControl
│   ├── ExportDialog
│   │   └── useExport (custom hook)
│   └── RevisionPanel
└── Shared Components
    ├── LoadingSpinner
    ├── ErrorBoundary
    └── Toast/Notification
```

### 主要 Hook

```typescript
// src/hooks/useProject.ts
function useProject(projectId?: string): {
  project: Project | null;
  loading: boolean;
  error: Error | null;
  saveProject: (data: ProjectData) => Promise<void>;
  deleteProject: () => Promise<void>;
}

// src/hooks/usePanelGeneration.ts
function usePanelGeneration(projectId: string): {
  panels: Map<number, PanelState>;
  progress: number;
  isGenerating: boolean;
  error: Error | null;
  startGeneration: () => Promise<void>;
  cancelGeneration: () => void;
}

// src/hooks/useExport.ts
function useExport(projectId: string): {
  exporting: boolean;
  exportFormat: 'png' | 'jpg' | 'pdf';
  downloadFile: (format: string, quality: number) => Promise<Blob>;
}
```

---

## 8. セキュリティ・レートリミット設計

### 8.1 認証・認可
- **API Key ベース認証**: ユーザーごとに固有のAPIキーを発行
- **JWT トークン**: セッション管理（有効期限30分）
- **CORS ポリシー**: フロントエンドからのリクエストを制限

### 8.2 レート制限（RateLimitService）

```typescript
// src/services/RateLimitService.ts
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxPanelsPerDay: number;
  maxProjectsPerUser: number;
  cooldownMinutes: number;
}

class RateLimitService {
  async checkLimit(userId: string, action: 'panel' | 'project'): Promise<boolean>
  async recordRequest(userId: string, action: string): Promise<void>
  async getRemainingQuota(userId: string): Promise<QuotaInfo>
}
```

**デフォルト設定:**
- 1ユーザー/分: 最大10リクエスト
- 1ユーザー/日: 最大50パネル生成
- 1ユーザー: 最大10プロジェクト
- API呼び出し失敗時: 60秒のクールダウン

### 8.3 入力検証

```typescript
// Prompt入力の検証
- Maximum length: 4000 characters
- Forbidden keywords: 明示的な規制キーワード
- Content filtering: OpenAI Content Policy準拠

// 画像アップロードの検証
- Allowed formats: PNG, JPG, WebP
- Max size: 20 MB/image
- Min resolution: 512x512 px
- Max resolution: 4096x4096 px
```

### 8.4 環境変数管理

```bash
# .env.example
OPENAI_API_KEY=sk_...
OPENAI_ORG_ID=org_...
DATABASE_PATH=./data/koma-fill.db
JWT_SECRET=your_secret_key
NODE_ENV=production
LOG_LEVEL=info
RATE_LIMIT_REQUESTS_PER_MIN=10
RATE_LIMIT_PANELS_PER_DAY=50
```

### 8.5 エラーハンドリング・ログ

```typescript
// Middleware error handler
class ErrorHandler {
  handleServiceError(error: Error): { status: number; message: string }
  logError(error: Error, context: string): void
  sanitizeErrorMessage(message: string): string // APIキー等を除去
}

// ログレベル: DEBUG, INFO, WARN, ERROR
```

---

## 9. パフォーマンス最適化

### 画像処理
- **キャッシング**: 同一プロンプト生成結果をメモリ/ディスク保存
- **バッチ処理**: 複数パネル生成を並列処理（最大3並列）
- **Progressive JPEG**: 出力時にプログレッシブJPEG圧縮

### フロントエンド
- **Code splitting**: React.lazy + Suspense
- **Image lazy loading**: IntersectionObserver
- **State optimization**: Zustand or Redux（必要に応じて）

---

## 10. デプロイメント

### Docker構成
```dockerfile
# Backend: Node.js + Express
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
CMD ["node", "dist/app.js"]

# Frontend: Node.js build stage → Nginx
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

---

## まとめ

koma-fill は、複数のAIサービスとしっかりした画像処理エンジンを組み合わせた、スケーラブルで保守性の高い漫画生成ツールです。マイクロサービスアーキテクチャにより、各機能の独立性と拡張性を確保しています。
