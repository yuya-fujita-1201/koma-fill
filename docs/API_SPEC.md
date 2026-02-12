# koma-fill API 仕様書

**koma-fill** は、AI を活用したマンガパネル補間ツールの REST API です。ストーリープロンプトから主要画像をアップロードし、DALL-E と Vision API を使用して中間パネルを自動生成します。

## 目次

- [基本情報](#基本情報)
- [認証](#認証)
- [エラー応答](#エラー応答)
- [エンドポイント](#エンドポイント)
  - [プロジェクト管理](#プロジェクト管理)
  - [画像分析](#画像分析)
  - [プロンプト生成](#プロンプト生成)
  - [画像生成](#画像生成)
  - [レイアウト処理](#レイアウト処理)
  - [エクスポート](#エクスポート)

---

## 基本情報

- **ベース URL**: `https://api.koma-fill.example.com`
- **バージョン**: v1
- **Content-Type**: `application/json` (特記なき限り)
- **レスポンス形式**: JSON
- **ストリーミング対応**: SSE (Server-Sent Events)

---

## 認証

すべてのリクエストに以下のヘッダを含める必要があります：

```
Authorization: Bearer {API_KEY}
X-Client-Version: 1.0
```

---

## エラー応答

すべてのエラーは以下の形式で返されます：

```typescript
interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}
```

### ステータスコード

| コード | 説明 |
|--------|------|
| 200 | 成功 |
| 201 | リソース作成成功 |
| 202 | リクエスト受け付け (非同期処理) |
| 400 | 不正なリクエスト |
| 401 | 認証エラー |
| 403 | 権限なし |
| 404 | リソースなし |
| 409 | 競合 (既存リソース等) |
| 413 | ペイロードが大きすぎる |
| 429 | レート制限超過 |
| 500 | サーバーエラー |
| 503 | サービス利用不可 |

---

## エンドポイント

### プロジェクト管理

#### 1. POST /api/manga/create - プロジェクト作成

マンガプロジェクトを新規作成します。

**リクエスト**

```typescript
interface CreateProjectRequest {
  /** プロジェクト名 */
  projectName: string;

  /** ストーリー概要・プロンプト */
  storyPrompt: string;

  /** レイアウト設定 (オプション) */
  layoutConfig?: {
    /** パネル数 (デフォルト: 8) */
    panelCount?: number;

    /** グリッドレイアウト ('2x4' | '3x3' | 'custom') */
    gridLayout?: '2x4' | '3x3' | 'custom';

    /** カスタムグリッド (gridLayout='custom' の場合) */
    customGrid?: {
      rows: number;
      cols: number;
    };

    /** キャンバスサイズ (ピクセル) */
    canvasWidth?: number;
    canvasHeight?: number;

    /** 余白設定 (ピクセル) */
    padding?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };

  /** 生成設定 (オプション) */
  generationSettings?: {
    /** 生成品質 ('low' | 'medium' | 'high') */
    quality?: 'low' | 'medium' | 'high';

    /** キャラクター一貫性レベル (0-1) */
    characterConsistency?: number;

    /** アート風格統一度 (0-1) */
    artStyleConsistency?: number;

    /** 自動背景生成 */
    autoBackground?: boolean;
  };
}
```

**レスポンス (200 OK | 201 Created)**

```typescript
interface CreateProjectResponse {
  /** プロジェクト ID */
  projectId: string;

  /** プロジェクト状態 */
  status: 'created' | 'initializing';

  /** パネルメタデータ */
  panels: {
    /** パネル ID */
    panelId: string;

    /** パネルインデックス */
    index: number;

    /** パネル種類 ('key' | 'generated') */
    type: 'key' | 'generated';

    /** パネル状態 */
    status: 'empty' | 'key_image_uploaded' | 'analyzing' | 'generating' | 'completed' | 'failed';

    /** パネル位置情報 */
    position: {
      row: number;
      col: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };

    /** 作成時刻 */
    createdAt: string; // ISO 8601
  }[];

  /** プロジェクト作成時刻 */
  createdAt: string; // ISO 8601

  /** プロジェクト設定 */
  config: {
    layoutConfig: NonNullable<CreateProjectRequest['layoutConfig']>;
    generationSettings: NonNullable<CreateProjectRequest['generationSettings']>;
  };
}
```

**エラーレスポンス**

- **400**: projectName が空、または無効な形式
- **400**: panelCount が範囲外 (1-20)
- **401**: 認証失敗
- **429**: レート制限超過

---

#### 2. GET /api/manga - プロジェクト一覧取得

ユーザーのプロジェクト一覧を取得します。

**クエリパラメータ**

```typescript
interface ListProjectsQuery {
  /** ページネーション: オフセット (デフォルト: 0) */
  offset?: number;

  /** ページネーション: リミット (デフォルト: 20, 最大: 100) */
  limit?: number;

  /** ソート順序 ('created_desc' | 'created_asc' | 'updated_desc') */
  sort?: string;

  /** ステータスフィルター */
  status?: 'created' | 'in_progress' | 'completed' | 'failed';
}
```

**レスポンス (200 OK)**

```typescript
interface ListProjectsResponse {
  /** プロジェクト一覧 */
  projects: {
    projectId: string;
    projectName: string;
    status: string;
    panelCount: number;
    completedPanels: number;
    createdAt: string;
    updatedAt: string;
    estimatedCompletionTime?: number; // ミリ秒
  }[];

  /** ペジネーション情報 */
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

---

#### 3. GET /api/manga/:projectId - プロジェクト詳細取得

特定のプロジェクト情報を取得します。

**パスパラメータ**

```typescript
interface GetProjectParams {
  /** プロジェクト ID */
  projectId: string;
}
```

**レスポンス (200 OK)**

```typescript
interface GetProjectResponse {
  projectId: string;
  projectName: string;
  storyPrompt: string;
  status: 'created' | 'initializing' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;

  /** 詳細パネル情報 */
  panels: {
    panelId: string;
    index: number;
    type: 'key' | 'generated';
    status: string;
    position: {
      row: number;
      col: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };

    /** キー画像 URL (key type の場合) */
    keyImageUrl?: string;

    /** 生成画像 URL (generated type の場合) */
    imageUrl?: string;

    /** Vision API 分析結果 */
    analysis?: {
      characters: string[];
      mood: string;
      artStyle: string;
      colorPalette: string[];
      composition: string;
      detailedDescription: string;
    };

    /** DALL-E プロンプト */
    dallePrompt?: string;

    /** ストーリービート */
    storyBeat?: string;

    /** トランジション種類 */
    transitionType?: 'cut' | 'fade' | 'motion' | 'zoom';

    /** 生成メタデータ */
    generationMetadata?: {
      generatedAt: string;
      model: string;
      seed?: number;
      revisedPrompt?: string;
    };
  }[];

  /** プロジェクト設定 */
  config: {
    layoutConfig: any;
    generationSettings: any;
  };

  /** 統計情報 */
  stats: {
    totalPanels: number;
    completedPanels: number;
    failedPanels: number;
    estimatedTimeRemaining: number; // ミリ秒
  };
}
```

**エラーレスポンス**

- **404**: プロジェクト ID が見つからない
- **401**: アクセス権限なし

---

### 画像分析

#### 4. POST /api/manga/:projectId/upload - キー画像アップロード

複数のキー画像を multipart/form-data 形式でアップロードします。

**リクエスト**

- **Content-Type**: `multipart/form-data`

```typescript
interface UploadKeyImagesRequest {
  /** パネルインデックスをキーとした画像ファイルマップ */
  // form-data:
  // "images[0]" => File (image/jpeg | image/png)
  // "images[2]" => File
  // "images[5]" => File

  /** 分析実行フラグ (デフォルト: true) */
  autoAnalyze?: boolean;

  /** 分析深度 ('quick' | 'detailed') */
  analysisDepth?: 'quick' | 'detailed';
}
```

**レスポンス (200 OK)**

```typescript
interface UploadKeyImagesResponse {
  /** アップロード済みキー画像 */
  keyImages: {
    panelIndex: number;
    panelId: string;
    imageUrl: string;
    fileName: string;
    fileSize: number;
    dimensions: {
      width: number;
      height: number;
    };
    uploadedAt: string;

    /** Vision API 分析結果 (autoAnalyze=true の場合) */
    analysis?: {
      characters: string[];
      mood: string;
      artStyle: string;
      colorPalette: string[];
      composition: string;
      detailedDescription: string;
      confidence: number; // 0-1
    };
  }[];

  /** 処理結果サマリー */
  summary: {
    uploadedCount: number;
    failedCount: number;
    analyzedCount: number;
    totalProcessingTime: number; // ミリ秒
  };

  /** エラー情報 */
  errors?: Array<{
    panelIndex: number;
    error: string;
    details?: string;
  }>;
}
```

**制約**

- **ファイルサイズ**: 最大 10MB / ファイル
- **対応形式**: JPEG, PNG, WebP
- **解像度**: 推奨 512x512 以上、最大 4096x4096
- **アップロードファイル数**: 最大 20 個

**エラーレスポンス**

- **400**: 無効なファイル形式
- **413**: ファイルサイズ超過
- **404**: プロジェクト ID が見つからない

---

#### 5. POST /api/manga/:projectId/analyze - 画像分析

アップロード済みの画像を Vision API で分析します。

**リクエスト**

```typescript
interface AnalyzeImagesRequest {
  /** 分析対象パネルインデックス */
  panelIndices?: number[];

  /** 分析深度 */
  analysisDepth: 'quick' | 'detailed';

  /** 分析オプション */
  options?: {
    /** キャラクター抽出 */
    extractCharacters?: boolean;

    /** 色パレット抽出 */
    extractColorPalette?: boolean;

    /** 構図分析 */
    analyzeComposition?: boolean;

    /** 文化的背景検出 */
    detectCulturalContext?: boolean;
  };
}
```

**レスポンス (200 OK | 202 Accepted)**

```typescript
interface AnalyzeImagesResponse {
  /** 分析結果 */
  analyses: {
    panelIndex: number;
    panelId: string;
    status: 'analyzing' | 'completed' | 'failed';

    analysis?: {
      /** キャラクター情報 */
      characters: {
        name: string;
        role: string;
        description: string;
        expression: string;
        confidence: number;
      }[];

      /** ムード・感情 */
      mood: {
        primary: string;
        secondary?: string;
        intensity: number; // 0-1
      };

      /** アート風格 */
      artStyle: {
        style: string;
        era?: string;
        technique?: string;
        colorTone: string;
      };

      /** 色パレット */
      colorPalette: {
        dominantColor: string;
        colors: {
          hex: string;
          rgb: { r: number; g: number; b: number };
          name: string;
          percentage: number;
        }[];
      };

      /** 構図分析 */
      composition: {
        type: string;
        focusPoint: { x: number; y: number };
        depth: 'foreground' | 'midground' | 'background';
        balance: 'symmetrical' | 'asymmetrical';
      };

      /** 詳細説明 */
      detailedDescription: string;

      /** 背景要素 */
      backgroundElements: string[];

      /** シーンタイプ */
      sceneType: string;

      /** 時間帯 */
      timeOfDay?: string;

      /** 信頼度スコア */
      overallConfidence: number; // 0-1
    };

    errorMessage?: string;
    analyzeTime?: number; // ミリ秒
  }[];

  /** 処理サマリー */
  summary: {
    totalAnalyzed: number;
    successCount: number;
    failureCount: number;
    totalTime: number;
  };
}
```

**ストリーミング対応** (オプション)

Server-Sent Events でリアルタイム進捗を配信：

```typescript
interface AnalysisProgressEvent {
  type: 'analysis_start' | 'analysis_progress' | 'analysis_complete' | 'analysis_error';
  panelIndex: number;
  timestamp: string;

  // progress イベントの場合
  progress?: number; // 0-100

  // complete イベントの場合
  analysis?: object;

  // error イベントの場合
  error?: string;
}
```

**エラーレスポンス**

- **404**: プロジェクト ID または パネル ID が見つからない
- **400**: 分析対象パネルに画像がない

---

### プロンプト生成

#### 6. POST /api/manga/:projectId/generate-prompts - DALL-E プロンプト生成

ストーリープロンプトとキー画像の分析結果から、各パネルの DALL-E 生成プロンプトを作成します。

**リクエスト**

```typescript
interface GeneratePromptsRequest {
  /** ストーリープロンプト */
  storyPrompt: string;

  /** 生成対象パネル数 */
  panelCount?: number;

  /** キャラクター一貫性レベル (0-1) */
  characterConsistency?: number;

  /** アート風格統一度 (0-1) */
  artStyleConsistency?: number;

  /** プロンプト生成オプション */
  options?: {
    /** 生成品質 ('low' | 'medium' | 'high') */
    quality?: 'low' | 'medium' | 'high';

    /** マンガ固有のスタイル指定 */
    mangaStyle?: 'shoujo' | 'shounen' | 'seinen' | 'josei' | 'kodomo' | 'avant-garde';

    /** プロンプト言語 */
    language?: 'en' | 'ja';

    /** 詳細度 */
    detailLevel?: 'minimal' | 'standard' | 'detailed';
  };
}
```

**レスポンス (200 OK)**

```typescript
interface GeneratePromptsResponse {
  /** パネルプロンプト */
  panels: {
    panelIndex: number;
    panelId: string;

    /** DALL-E プロンプト */
    dallePrompt: string;

    /** プロンプト詳細 */
    promptDetails: {
      /** 主題 */
      subject: string;

      /** キャラクター指定 */
      characters?: {
        name: string;
        appearance: string;
        pose: string;
        expression: string;
      }[];

      /** 背景・環境 */
      background: string;

      /** 色指定 */
      colorGuidance: string;

      /** スタイル指定 */
      styleGuidance: string;

      /** その他修飾語 */
      modifiers: string[];
    };

    /** ストーリービート */
    storyBeat: string;

    /** 前パネルからの遷移 */
    transitionType: 'cut' | 'fade' | 'motion' | 'zoom';

    /** トランジション詳細 */
    transitionDescription?: string;

    /** 時間軸 */
    temporalMarker?: string;

    /** 推奨シード値 (一貫性向上用) */
    suggestedSeed?: number;
  }[];

  /** 処理メタデータ */
  metadata: {
    generatedAt: string;
    model: 'gpt-4-vision' | 'gpt-3.5-turbo';
    tokensUsed: number;
    processingTime: number;
  };
}
```

**エラーレスポンス**

- **404**: プロジェクト ID が見つからない
- **400**: storyPrompt が空
- **400**: キー画像の分析結果が不足

---

### 画像生成

#### 7. POST /api/manga/:projectId/generate-images - 画像生成 (SSE ストリーミング)

DALL-E を使用してパネル画像を生成します。Server-Sent Events でリアルタイム進捗を配信します。

**リクエスト**

```typescript
interface GenerateImagesRequest {
  /** 生成対象パネルインデックス (未指定で全パネル) */
  panelIndices?: number[];

  /** バッチ処理モード */
  batchMode?: {
    /** バッチサイズ (デフォルト: 3) */
    batchSize?: number;

    /** バッチ間の遅延 (ミリ秒) */
    delayBetweenBatches?: number;
  };

  /** 生成設定 */
  settings?: {
    /** 生成品質 ('hd' | 'standard') */
    quality?: 'hd' | 'standard';

    /** 出力解像度 */
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

    /** 修正プロンプト許可 */
    allowRevisedPrompt?: boolean;
  };
}
```

**レスポンス (200 OK - Server-Sent Events)**

SSE ストリーム上で以下のイベントが送信されます：

```typescript
interface GenerationStreamEvent {
  type: 'generation_start' | 'panel_start' | 'panel_progress' | 'panel_complete' | 'generation_complete' | 'error';
  timestamp: string;

  // generation_start
  start?: {
    totalPanels: number;
    estimatedTime: number; // 秒
  };

  // panel_start
  panelStart?: {
    panelIndex: number;
    panelId: string;
    prompt: string;
  };

  // panel_progress
  panelProgress?: {
    panelIndex: number;
    panelId: string;
    status: 'queued' | 'processing' | 'processing_revision';
    percentage: number; // 0-100
    estimatedTimeRemaining: number; // 秒
  };

  // panel_complete
  panelComplete?: {
    panelIndex: number;
    panelId: string;
    imageUrl: string;
    generationTime: number; // ミリ秒

    generationMetadata: {
      model: string;
      size: string;
      revisedPrompt?: string;
      seed?: number;
      processingTime: number;
    };

    status: 'completed';
  };

  // generation_complete
  complete?: {
    totalGenerated: number;
    totalTime: number; // ミリ秒
    failureCount: number;
  };

  // error
  error?: {
    panelIndex?: number;
    panelId?: string;
    errorCode: string;
    message: string;
    retryable: boolean;
  };
}
```

**イベントストリーム例**

```
data: {"type":"generation_start","start":{"totalPanels":8,"estimatedTime":240}}
data: {"type":"panel_start","panelStart":{"panelIndex":0,"panelId":"panel_001","prompt":"..."}}
data: {"type":"panel_progress","panelProgress":{"panelIndex":0,"percentage":25}}
data: {"type":"panel_progress","panelProgress":{"panelIndex":0,"percentage":75}}
data: {"type":"panel_complete","panelComplete":{"panelIndex":0,"imageUrl":"https://...","generationTime":45000}}
data: {"type":"panel_start","panelStart":{"panelIndex":1,"panelId":"panel_002"}}
...
data: {"type":"generation_complete","complete":{"totalGenerated":8,"totalTime":360000,"failureCount":0}}
```

**エラーレスポンス**

- **404**: プロジェクト ID が見つからない
- **400**: DALL-E プロンプトが生成されていない
- **429**: API レート制限
- **503**: DALL-E サービス利用不可

---

#### 8. POST /api/manga/:projectId/regenerate/:panelIndex - パネル再生成

特定のパネルを再生成します。

**パスパラメータ**

```typescript
interface RegeneratePanelParams {
  projectId: string;
  panelIndex: number;
}
```

**リクエスト**

```typescript
interface RegeneratePanelRequest {
  /** カスタムプロンプト (オプション) */
  customPrompt?: string;

  /** 生成設定 */
  settings?: {
    quality?: 'hd' | 'standard';
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  };

  /** 前回の修正プロンプトを活用 */
  usePreviousRevision?: boolean;
}
```

**レスポンス (200 OK)**

```typescript
interface RegeneratePanelResponse {
  panelIndex: number;
  panelId: string;
  status: 'generating' | 'completed';

  imageUrl: string;
  generationMetadata: {
    generatedAt: string;
    model: string;
    size: string;
    processingTime: number;
    revisedPrompt?: string;
  };

  // ストリーミング対応の場合、SSE イベントも並行配信
}
```

**エラーレスポンス**

- **404**: プロジェクト ID またはパネル ID が見つからない
- **400**: パネルインデックスが範囲外

---

### レイアウト処理

#### 9. PUT /api/manga/:projectId/reorder - パネル並び替え

パネルの順序を変更します。

**リクエスト**

```typescript
interface ReorderPanelsRequest {
  /** パネル ID の新しい順序 */
  newOrder: string[]; // panelId[]

  /** 逆順方向テスト (オプション) */
  validateTransitions?: boolean;
}
```

**レスポンス (200 OK)**

```typescript
interface ReorderPanelsResponse {
  panels: {
    panelIndex: number;
    panelId: string;
    previousIndex?: number;
    newPosition: {
      row: number;
      col: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];

  /** トランジション検証結果 (validateTransitions=true) */
  transitionValidation?: {
    isValid: boolean;
    issues: Array<{
      fromPanel: number;
      toPanel: number;
      issue: string;
      suggestion?: string;
    }>;
  };

  updatedAt: string;
}
```

**エラーレスポンス**

- **400**: newOrder に重複 ID がある
- **400**: newOrder 内の ID がプロジェクトに存在しない

---

#### 10. POST /api/manga/:projectId/layout - レイアウト合成

全パネルを 1 つのキャンバスに配置し、最終的なマンガレイアウトを生成します。

**リクエスト**

```typescript
interface ComposeLayoutRequest {
  /** レイアウト設定 */
  layoutSettings?: {
    /** パネル間のガター幅 (ピクセル) */
    gutterWidth?: number;

    /** パネル枠線設定 */
    borderStyle?: {
      width: number;
      color: string; // hex or rgb
      style: 'solid' | 'double' | 'dashed';
      radius?: number; // ボーダーラジウス
    };

    /** 背景設定 */
    backgroundColor?: string;

    /** 余白設定 */
    padding?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };

  /** 効果設定 */
  effectSettings?: {
    /** 背景ぼかし */
    addBleed?: boolean;

    /** トーン効果 */
    addTones?: boolean;

    /** スピード線追加 */
    addSpeedLines?: boolean;
  };
}
```

**レスポンス (202 Accepted)**

```typescript
interface ComposeLayoutResponse {
  projectId: string;
  status: 'composing' | 'completed';

  /** 合成画像 URL */
  layoutImageUrl?: string;

  /** キャンバス情報 */
  canvas: {
    width: number;
    height: number;
    dpi: number;
  };

  /** パネル配置情報 */
  panelPositions: {
    panelIndex: number;
    panelId: string;
    absolutePosition: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];

  /** 処理メタデータ */
  metadata: {
    startedAt: string;
    completedAt?: string;
    processingTime?: number;
  };

  /** 処理 ID (ポーリング用) */
  processId?: string;
}
```

**非同期処理の場合**

`processId` を使ってポーリング：

```bash
GET /api/manga/:projectId/layout-progress/:processId
```

```typescript
interface LayoutProgressResponse {
  processId: string;
  status: 'composing' | 'completed' | 'failed';
  progress: number; // 0-100
  layoutImageUrl?: string;
  error?: string;
}
```

**エラーレスポンス**

- **400**: パネルがすべて完成していない

---

### エクスポート

#### 11. POST /api/manga/:projectId/export - エクスポート

マンガを PNG / JPG / PDF 形式でエクスポートします。

**リクエスト**

```typescript
interface ExportRequest {
  /** エクスポート形式 */
  format: 'png' | 'jpg' | 'pdf';

  /** 画像フォーマット設定 */
  imageSettings?: {
    /** 品質 (JPG: 0-100, PNG: 0-9) */
    quality?: number;

    /** 色深度 ('8bit' | '16bit') */
    colorDepth?: '8bit' | '16bit';

    /** ICC プロファイル */
    colorProfile?: 'srgb' | 'adobergb' | 'prophoto';
  };

  /** PDF 設定 (format='pdf' の場合) */
  pdfSettings?: {
    /** ページサイズ */
    pageSize: 'A4' | 'A3' | 'letter' | 'custom';

    /** カスタムページサイズ (mm) */
    customPageSize?: {
      width: number;
      height: number;
    };

    /** 向き */
    orientation: 'portrait' | 'landscape';

    /** マージン (mm) */
    margin: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };

    /** メタデータ */
    metadata?: {
      title: string;
      author?: string;
      subject?: string;
      keywords?: string[];
    };

    /** 圧縮 */
    compress?: boolean;
  };

  /** メタデータ */
  metadata?: {
    title: string;
    author?: string;
    description?: string;
    tags?: string[];
  };

  /** ファイル名 */
  fileName?: string;
}
```

**レスポンス (200 OK)**

```typescript
interface ExportResponse {
  projectId: string;
  exportId: string;
  status: 'completed' | 'processing';

  /** ダウンロード URL */
  downloadUrl: string;

  /** ファイル情報 */
  file: {
    fileName: string;
    format: string;
    fileSize: number; // バイト
    mimeType: string;
  };

  /** エクスポート情報 */
  export: {
    format: string;
    dimensions: {
      width: number;
      height: number;
    };
    dpi: number;
    createdAt: string;
    expiresAt: string; // ダウンロード期限 (7日後)
  };
}
```

**ダウンロード**

`downloadUrl` から直接ダウンロード可能（有効期限: 7 日間）

**エラーレスポンス**

- **400**: 無効なエクスポート形式
- **400**: パネルがすべて完成していない
- **413**: ファイルサイズ超過 (最大 500MB)

---

## レート制限

API は以下のレート制限を適用します：

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1645564800
```

- **基本**: 100 リクエスト/10分
- **アップロード**: 10 ファイル/10分
- **画像生成**: 5 プロジェクト/10分 (同時)

レート制限に達すると、429 Too Many Requests を返します。

---

## ベストプラクティス

### 1. エラーハンドリング

```typescript
try {
  const response = await fetch('/api/manga/create', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer API_KEY' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const error = await response.json() as ErrorResponse;
    console.error(`Error ${error.code}: ${error.message}`);
  }
} catch (e) {
  // ネットワークエラー処理
}
```

### 2. SSE ストリーム処理

```typescript
const eventSource = new EventSource(`/api/manga/${projectId}/generate-images`);

eventSource.addEventListener('panel_complete', (event) => {
  const data = JSON.parse(event.data) as GenerationStreamEvent;
  updatePanelUI(data.panelComplete);
});

eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data) as GenerationStreamEvent;
  handleGenerationError(data.error);
  eventSource.close();
});
```

### 3. 非同期処理のポーリング

```typescript
async function waitForCompletion(projectId: string, processId: string) {
  let status = 'composing';

  while (status !== 'completed' && status !== 'failed') {
    const response = await fetch(`/api/manga/${projectId}/layout-progress/${processId}`, {
      headers: { 'Authorization': 'Bearer API_KEY' }
    });

    const data = await response.json();
    status = data.status;
    console.log(`Progress: ${data.progress}%`);

    // 2秒待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return data;
}
```

---

## データモデル参考

### Panel

```typescript
interface Panel {
  panelId: string;
  projectId: string;
  index: number;
  type: 'key' | 'generated';
  status: 'empty' | 'key_image_uploaded' | 'analyzing' | 'generating' | 'completed' | 'failed';

  // 画像データ
  keyImageUrl?: string;
  imageUrl?: string;

  // 分析・生成メタデータ
  analysis?: PanelAnalysis;
  dallePrompt?: string;
  generationMetadata?: GenerationMetadata;

  // 位置・サイズ
  position: PanelPosition;

  // タイムスタンプ
  createdAt: string;
  updatedAt: string;
}

interface PanelAnalysis {
  characters: string[];
  mood: string;
  artStyle: string;
  colorPalette: string[];
  composition: string;
  detailedDescription: string;
}

interface GenerationMetadata {
  generatedAt: string;
  model: string;
  revisedPrompt?: string;
  processingTime: number;
}

interface PanelPosition {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

---

## ウェブフック (オプション)

長時間の非同期処理完了時に、ウェブフックで通知を受け取ることができます：

```typescript
interface WebhookPayload {
  event: 'image_generation_complete' | 'layout_composition_complete' | 'error';
  projectId: string;
  timestamp: string;
  data: any;
}
```

ウェブフック URL は、プロジェクト作成時またはダッシュボードで設定します。

---

## バージョン履歴

| バージョン | 公開日 | 主な変更 |
|-----------|--------|--------|
| 1.0 | 2024-XX-XX | 初版公開 |

---

## サポート

問題が発生した場合は、以下の情報と共にサポートに連絡してください：

- **エラーコード** (例: `PANEL_GENERATION_FAILED`)
- **Request ID** (`X-Request-ID` ヘッダ)
- **タイムスタンプ**
- **再現手順**

サポートメール: support@koma-fill.example.com
