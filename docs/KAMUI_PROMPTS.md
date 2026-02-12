# KAMUI-4D Parallel Task Prompts for koma-fill
## Manga Generation AI System - Multi-Agent Implementation Guide

**Version:** 1.0
**Project:** koma-fill - AI-powered manga panel generation system
**Target:** KAMUI-4D Editor (Multi-AI CLI parallel execution)

---

## How to Use These Prompts in KAMUI-4D

This document contains **5 independent task prompts** designed to run in parallel across multiple AI coding agents. Each prompt is self-contained and can be executed independently without blocking other tasks.

### Setup Instructions

1. **Install dependencies** (run once before starting tasks):
   ```bash
   cd /mnt/Projects/koma-fill/backend
   npm install

   cd /mnt/Projects/koma-fill/frontend
   npm install
   ```

2. **Environment Configuration**:
   Create `/mnt/Projects/koma-fill/.env`:
   ```
   NODE_ENV=development
   PORT=5000
   BASE_URL=http://localhost:5000
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_ORG_ID=your_org_id_optional
   DATABASE_PATH=./data/koma-fill.db
   STORAGE_PATH=./uploads
   MAX_IMAGE_SIZE_MB=20
   DALLE_RATE_LIMIT_PER_MINUTE=5
   VISION_RATE_LIMIT_PER_MINUTE=30
   MAX_RETRIES_PER_PANEL=3
   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. **Execution Strategy**:
   - Copy each task prompt below into a separate KAMUI-4D session/agent
   - **Tasks 1-5 can ALL start simultaneously** (no blocking dependencies)
   - Each task should run independently in its own AI CLI session
   - Monitor each agent's progress via console output
   - **Integration testing** should happen after all 5 tasks complete (see bottom of doc)

4. **Task Dependencies**:
   ```
   Task 1 (Backend) → provides database & API contracts
   Task 2 (Vision) → uses Task 1's API, reads backend/src/models/types.ts
   Task 3 (Images) → uses Task 1's API, reads backend/src/models/types.ts
   Task 4 (Layout) → uses Task 1's API, reads backend/src/models/types.ts
   Task 5 (Frontend) → calls Tasks 1-4 via REST API
   ```
   **All tasks can start immediately** - they communicate via file system and API contracts.

---

## Task 1: Backend基盤 (Agent A)
### Express Server, SQLite Database & CRUD Routes Foundation

**Time Estimate:** 45-60 minutes
**Difficulty:** Intermediate
**Dependencies:** None (this is the foundation layer)

### Objective
Set up a fully functional Express.js backend with SQLite database, implement CRUD operations for manga projects and panels, configure file upload handling with multer, and provide a solid API foundation for other agents to build upon.

### Target Files to Create/Modify

```
backend/
├── src/
│   ├── database/
│   │   ├── connection.ts          [NEW] SQLite connection & initialization
│   │   └── schema.ts              [NEW] Table schema definitions
│   ├── index.ts                   [MODIFY] Add DB initialization
│   ├── app.ts                     [COMPLETE] Already done - verify middleware
│   ├── routes/
│   │   └── manga.ts               [IMPLEMENT] Route handlers with DB calls
│   └── middleware/
│       └── errorHandler.ts        [VERIFY] Already complete
├── uploads/                        [CREATE] Directory for image storage
└── data/                           [CREATE] Directory for SQLite DB
```

### TypeScript Interfaces (from `/mnt/Projects/koma-fill/backend/src/models/types.ts`)

Key types you'll use:
```typescript
// Core entities
MangaProject {
  id: string;                    // UUID
  name: string;
  description?: string;
  status: ProjectStatus;         // 'draft' | 'analyzing' | 'generating' | 'complete' | 'exported'
  layoutConfig: LayoutConfig;
  generationSettings: GenerationSettings;
  panels: Panel[];
  keyImages: KeyImage[];
  totalCost: number;
  createdAt: string;             // ISO datetime
  updatedAt: string;
}

Panel {
  id: string;                    // UUID
  projectId: string;
  panelIndex: number;            // 0-based
  imageUrl?: string;
  imageFilePath?: string;
  prompt?: string;
  storyBeat?: string;
  speechBubbleText?: string;
  status: PanelStatus;           // 'pending' | 'generated' | 'failed' | 'placeholder'
  retryCount: number;
  generatedAt?: string;
  createdAt: string;
}

KeyImage {
  id: string;                    // UUID
  projectId: string;
  imageFilePath: string;
  position: ImagePosition;       // 'start' | 'end' | number
  analysis?: ImageAnalysis;
  createdAt: string;
}

LayoutConfig {
  totalPanels: number;           // 4, 6, 8, etc.
  format: LayoutFormat;          // 'vertical' | 'horizontal' | 'square'
  readingOrder: ReadingOrder;    // 'japanese' | 'western'
  gutterSize: number;            // px
  borderWidth: number;           // px
  borderColor: string;           // hex #RRGGBB
  backgroundColor: string;       // hex
  pageWidth: number;             // px
  pageHeight: number;            // px
}

GenerationSettings {
  imageStyle: string;            // e.g., "manga style, black and white ink"
  aspectRatio: 'square' | 'wide' | 'tall';
  qualityLevel: 'standard' | 'hd';
  negativePrompt?: string;
  seed?: number;
}
```

### Implementation Checklist

#### 1. Create Database Connection Module (`backend/src/database/connection.ts`)
```typescript
// Requirements:
- Initialize better-sqlite3 connection
- Create/open database at DATABASE_PATH from .env
- Export initDatabase() async function
- Enable foreign keys constraint
- Handle database file creation if needed
- Connection should be cached/singleton
```

#### 2. Create Database Schema Module (`backend/src/database/schema.ts`)
```typescript
// SQL Schema Requirements:
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  layoutConfig JSON NOT NULL,
  generationSettings JSON NOT NULL,
  totalCost REAL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE panels (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  panelIndex INTEGER NOT NULL,
  imageUrl TEXT,
  imageFilePath TEXT,
  prompt TEXT,
  storyBeat TEXT,
  speechBubbleText TEXT,
  status TEXT NOT NULL,
  retryCount INTEGER DEFAULT 0,
  generatedAt TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id)
);

CREATE TABLE keyImages (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  imageFilePath TEXT NOT NULL,
  position TEXT NOT NULL,
  analysis JSON,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id)
);

CREATE INDEX idx_project_status ON projects(status);
CREATE INDEX idx_panel_project ON panels(projectId);
CREATE INDEX idx_panel_status ON panels(status);
```

#### 3. Modify `backend/src/index.ts`
```typescript
// Add:
- Import { initDatabase } from './database/connection'
- Call await initDatabase() before app.listen()
- Log database initialization success
```

#### 4. Create Repository Layer (`backend/src/repositories/`)
```typescript
// Create:
- ProjectRepository with methods:
  - createProject(data: CreateMangaRequest): Promise<MangaProject>
  - getProject(id: string): Promise<MangaProject | null>
  - listProjects(limit: number, offset: number): Promise<MangaProject[]>
  - updateProject(id: string, updates: Partial<MangaProject>): Promise<MangaProject>
  - deleteProject(id: string): Promise<void>

- PanelRepository with methods:
  - createPanel(projectId: string, data: Panel): Promise<Panel>
  - getPanelsByProject(projectId: string): Promise<Panel[]>
  - getPanel(panelId: string): Promise<Panel | null>
  - updatePanel(panelId: string, updates: Partial<Panel>): Promise<Panel>
  - updatePanelStatus(panelId: string, status: PanelStatus): Promise<void>

- KeyImageRepository with methods:
  - createKeyImage(projectId: string, data: KeyImage): Promise<KeyImage>
  - getKeyImages(projectId: string): Promise<KeyImage[]>
  - updateKeyImageAnalysis(imageId: string, analysis: ImageAnalysis): Promise<void>
```

#### 5. Implement Routes in `backend/src/routes/manga.ts`
Replace TODO comments with actual implementations:

- **POST /api/manga/create**
  - Validate CreateMangaRequest using Joi
  - Generate unique project ID (uuid)
  - Create project in database with 'draft' status
  - Create initial panel records (count = layoutConfig.totalPanels)
  - Return created MangaProject with 201 status

- **POST /api/manga/:projectId/upload**
  - Files already handled by multer middleware
  - Save KeyImage records to database with file paths
  - Store position information
  - Return array of KeyImage objects

- **GET /api/manga/:projectId**
  - Fetch project + panels + key images from database
  - Return complete MangaProject object
  - Throw NotFoundError if project doesn't exist

- **GET /api/manga**
  - Implement pagination (limit/offset query params)
  - Return array of projects
  - Include total count header

- **PUT /api/manga/:projectId/reorder**
  - Parse ReorderPanelsRequest body
  - Update panelIndex for each panel based on new order
  - Return updated panels array

### Testing Requirements

After implementation, verify:

```bash
# 1. Database initialization
npm run dev
# Check console: "✓ configured" for database

# 2. Create project
curl -X POST http://localhost:5000/api/manga/create \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "Test Manga",
    "storyPrompt": "A hero on a quest",
    "layoutConfig": { "totalPanels": 4 }
  }'

# 3. Get project
curl http://localhost:5000/api/manga/{projectId}

# 4. Upload images
curl -X POST http://localhost:5000/api/manga/{projectId}/upload \
  -F "images=@test1.jpg" \
  -F "images=@test2.jpg"

# 5. Check database
sqlite3 data/koma-fill.db "SELECT * FROM projects; SELECT * FROM panels;"
```

### Files This Task Provides to Other Agents

- **Database schema** - Tasks 2, 3, 4, 5 will read/write to these tables
- **API contracts** - manga.ts route signatures that Tasks 2-4 will call
- **File storage structure** - uploads/ directory path that Task 3 will use
- **Type definitions** - already in backend/src/models/types.ts (reference only)

### Output Validation Checklist

- [ ] Database file created at `data/koma-fill.db`
- [ ] All 3 tables created with correct schema
- [ ] Repositories implement CRUD operations
- [ ] All route handlers work without TODO comments
- [ ] multer uploads save files to `uploads/` directory
- [ ] POST /create returns 201 with MangaProject object
- [ ] GET /:projectId returns full project with panels
- [ ] Error handler catches and responds appropriately
- [ ] No TypeScript compilation errors
- [ ] npm run dev starts without errors

---

## Task 2: 画像分析+プロンプト生成 (Agent B)
### Vision API Integration & DALL-E Prompt Generation

**Time Estimate:** 50-60 minutes
**Difficulty:** Intermediate
**Dependencies:** Task 1 (needs database & API routes available)

### Objective
Implement OpenAI Vision API integration to analyze uploaded key images and extract character/style information. Then implement story-to-panel prompt generation using GPT-4o to create DALL-E 3 compatible prompts that maintain consistency across panels.

### Target Files to Create/Modify

```
backend/
└── src/
    └── services/
        ├── imageAnalysisService.ts      [IMPLEMENT] Vision API analysis
        ├── promptGenerationService.ts   [CREATE] Story → panel prompts
```

### System Prompts (Already Provided)

Both vision analysis prompts are defined in `imageAnalysisService.ts`:
- `QUICK_ANALYSIS_PROMPT` - fast, ~500 tokens
- `DETAILED_ANALYSIS_PROMPT` - thorough, ~2000 tokens

These guide the Vision API to return structured JSON matching the `ImageAnalysis` interface.

### TypeScript Interfaces

```typescript
// Input: Key image file path (from Task 1)
// Output: ImageAnalysis object

ImageAnalysis {
  description: string;
  characters: CharacterInfo[];
  objects: string[];
  colors: string[];
  composition: string;
  mood: string;
  artStyle: string;
  suggestedTransitions: string[];
}

CharacterInfo {
  name?: string;
  appearance: string;        // detailed physical description
  emotion: string;
  position: string;          // screen position (e.g., "center-left")
}

// Panel prompt generation
PanelPrompt {
  panelIndex: number;
  dallePrompt: string;       // Full DALL-E 3 prompt (100-300 words)
  storyBeat: string;         // What happens in this panel
  visualFocus: string;       // Main visual element
  transitionType: TransitionType;  // 'cut' | 'pan' | 'zoom_in' | 'zoom_out' | 'fade' | 'action'
  suggestedDialogue?: string;
}
```

### Implementation Details

#### ImageAnalysisService (`backend/src/services/imageAnalysisService.ts`)

**Constructor:**
```typescript
constructor() {
  this.openai = new OpenAI({
    apiKey: CONFIG.OPENAI_API_KEY,
    organization: CONFIG.OPENAI_ORG_ID
  });
}
```

**Method: analyzeImage(imageBase64: string, depth: 'quick' | 'detailed')**
- Input: Base64-encoded image data from KeyImage file
- Implementation:
  1. Read image file and convert to Base64 (if not already)
  2. Call `this.openai.chat.completions.create()`:
     - model: CONFIG.VISION_MODEL ('gpt-4o')
     - messages: [
       { role: 'system', content: QUICK_ANALYSIS_PROMPT or DETAILED_ANALYSIS_PROMPT }
       { role: 'user', content: [
         { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
       ]}
     ]
     - response_format: { type: 'json_object' }
     - max_tokens: depth === 'quick' ? 500 : 2000
  3. Parse response.choices[0].message.content as JSON
  4. Validate against ImageAnalysis schema
  5. Return ImageAnalysis object

**Method: analyzeMultiple(images, depth)**
- Input: Array of { base64, position } objects
- Use Promise.all with rate limiting (max CONFIG.VISION_RATE_LIMIT_PER_MINUTE calls/min)
- Implement backoff if rate limited
- Return array of ImageAnalysis objects

**Method: extractCharacters(analysis)**
- Optional: Deep-dive character extraction
- Can call another Vision API pass if needed for more detail

#### PromptGenerationService (NEW FILE - `backend/src/services/promptGenerationService.ts`)

**Constructor:**
```typescript
constructor() {
  this.openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
}
```

**Method: generatePanelPrompts(request: GeneratePromptsRequest)**

Input:
```typescript
GeneratePromptsRequest {
  storyPrompt: string;           // User's story
  panelCount: number;            // Total panels to generate
  characterConsistency: boolean; // Whether to maintain character consistency
}
```

Implementation:
1. **Story Breakdown Phase:**
   - Call GPT-4o to split story into N panel beats
   - System prompt should guide structure like:
   ```
   "You are a manga story expert. Break the provided story into exactly {panelCount}
    distinct visual beats. Each beat should be 1-2 sentences describing what happens
    visually in that panel. Format as JSON array of objects with 'panelIndex' and 'beat' fields."
   ```

2. **Character Consistency Analysis:**
   - If characterConsistency=true and keyImages were analyzed:
     - Retrieve stored ImageAnalysis for key images
     - Create character consistency profile (appearance, emotion arcs, etc.)
     - Include in subsequent prompts

3. **DALL-E 3 Prompt Generation:**
   - For each story beat, create detailed DALL-E 3 prompt
   - System prompt pattern:
   ```
   "You are a DALL-E 3 prompt expert specializing in manga panels.
    Given a story beat, generate a detailed visual prompt (100-300 words) that:
    - Specifies art style: {generationSettings.imageStyle}
    - Maintains character consistency: {characterProfile}
    - Follows manga composition principles
    - Uses specific visual terms (angle, lighting, pose, emotion)
    - Avoids abstract concepts; be concrete and visual
    - Follows DALL-E 3 content policy

    Return JSON with: { dallePrompt, visualFocus, transitionType, suggestedDialogue }"
   ```

4. **Transition Logic:**
   - Analyze flow between consecutive beats
   - Suggest transition type ('cut', 'pan', 'zoom_in', etc.)
   - Update imageUrl in previous panel to support transitions

5. **Return Value:**
   - Array of PanelPrompt objects, one per panel
   - Each with populated dallePrompt, storyBeat, visualFocus, transitionType

### Database Integration

After generating prompts, save to Panel table:
- Update each panel's `prompt` field with `dallePrompt`
- Update `storyBeat` field
- Update `status` to 'pending' (ready for image generation)

### API Integration

Implement route handlers in `backend/src/routes/manga.ts`:

**POST /api/manga/:projectId/analyze**
```typescript
// 1. Fetch project and keyImages from DB
// 2. Read image files and convert to Base64
// 3. Call imageAnalysisService.analyzeMultiple()
// 4. Store analysis results in DB (keyImages.analysis)
// 5. Update project status to 'analyzing' → 'complete'
// 6. Return analysis results
```

**POST /api/manga/:projectId/generate-prompts**
```typescript
// 1. Validate GeneratePromptsRequest
// 2. Fetch project and keyImages analyses from DB
// 3. Call promptGenerationService.generatePanelPrompts()
// 4. Update panel records with generated prompts
// 5. Update project status to 'generating'
// 6. Return array of PanelPrompt objects
```

### Testing Requirements

```bash
# 1. Prepare test image
# (Use any PNG/JPG with a character or scene)

# 2. Create project and upload image (Task 1)
PROJECT_ID=$(curl -s -X POST http://localhost:5000/api/manga/create \
  -H "Content-Type: application/json" \
  -d '{"projectName":"Test","storyPrompt":"A hero finds treasure"}' | jq -r '.id')

# 3. Upload test image
curl -X POST http://localhost:5000/api/manga/$PROJECT_ID/upload \
  -F "images=@test_image.jpg"

# 4. Analyze images
curl -X POST http://localhost:5000/api/manga/$PROJECT_ID/analyze \
  -H "Content-Type: application/json" \
  -d '{"analysisDepth":"quick"}'

# 5. Generate prompts
curl -X POST http://localhost:5000/api/manga/$PROJECT_ID/generate-prompts \
  -H "Content-Type: application/json" \
  -d '{
    "storyPrompt": "A hero finds treasure in a dark cave",
    "panelCount": 4,
    "characterConsistency": true
  }'

# 6. Verify output
curl http://localhost:5000/api/manga/$PROJECT_ID | jq '.panels[].prompt'
```

### Files This Task Provides to Other Agents

- **Panel prompt data** - Stored in DB panels table, used by Task 3 for image generation
- **Character analysis** - Used by Task 5 frontend for display
- **Art style consistency** - Guides Task 3's image generation

### Output Validation Checklist

- [ ] ImageAnalysisService.analyzeImage() calls Vision API successfully
- [ ] Vision API responses parse correctly to ImageAnalysis
- [ ] PromptGenerationService generates DALL-E-compatible prompts
- [ ] Panel prompts maintain character consistency (if enabled)
- [ ] Transition types are correctly assigned
- [ ] All panel records updated in database with prompts
- [ ] /analyze endpoint returns ImageAnalysis array
- [ ] /generate-prompts endpoint returns PanelPrompt array
- [ ] Error handling for API failures (rate limits, auth, etc.)
- [ ] No TypeScript compilation errors

---

## Task 3: DALL-E 3画像生成 (Agent C)
### Image Generation with Retry Logic & Progress Streaming

**Time Estimate:** 50-70 minutes
**Difficulty:** Intermediate-Advanced
**Dependencies:** Task 1 (DB & API), Task 2 (panel prompts)

### Objective
Implement DALL-E 3 image generation with robust error handling, exponential backoff retry logic, local image storage, Server-Sent Events (SSE) streaming for real-time progress updates, and cost tracking per API call.

### Target Files to Create/Modify

```
backend/
└── src/
    └── services/
        ├── imageGenerationService.ts    [IMPLEMENT] DALL-E 3 API integration
        └── (imageProcessor.ts)          [REFERENCE] Utility for image processing
```

### TypeScript Interfaces

```typescript
GeneratedPanel {
  panelIndex: number;
  imageUrl: string;              // DALL-E public URL (temporary)
  localFilePath: string;         // /uploads/{projectId}/panel_{index}.png
  prompt: string;                // Original prompt sent
  revisedPrompt?: string;        // DALL-E 3's revised prompt (if modified)
  costUsd: number;               // API call cost
}

// Request type
GenerateImagesRequest {
  panelIndices?: number[];       // undefined = all panels
  batchMode: 'sequential' | 'parallel';
}

// Progress event (sent via SSE)
ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  stage: string;                 // 'generating_images'
  currentStep: number;           // Current panel index
  totalSteps: number;            // Total panels
  percentage: number;            // 0-100
  message: string;               // Human-readable status
  panelId?: string;
  panelIndex?: number;
  error?: string;                // Error message if type='error'
}
```

### Implementation Details

#### ImageGenerationService (`backend/src/services/imageGenerationService.ts`)

**Constructor & Initialization:**
```typescript
constructor() {
  this.openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
  this.uploadDir = path.resolve(CONFIG.STORAGE_PATH);
}
```

**Method: generatePanel() - Single Panel Generation**

```typescript
async generatePanel(
  prompt: string,
  panelIndex: number,
  projectId: string,
  settings?: GenerationSettings
): Promise<GeneratedPanel>
```

Implementation:
1. **Image Size Calculation:**
   - Map aspectRatio to DALL-E 3 size:
     - 'square' → '1024x1024'
     - 'wide' → '1792x1024'
     - 'tall' → '1024x1792'

2. **API Call (with retry logic in wrapper):**
   ```typescript
   const response = await this.openai.images.generate({
     model: CONFIG.DALLE_MODEL,           // 'dall-e-3'
     prompt: prompt,
     n: 1,
     size: size,
     quality: settings?.qualityLevel === 'hd' ? 'hd' : 'standard',
     style: 'natural',                    // or 'vivid' for more dramatic
   });
   ```

3. **Extract Response Data:**
   - imageUrl = response.data[0].url
   - revisedPrompt = response.data[0].revised_prompt
   - Calculate cost based on settings.qualityLevel:
     - standard: $0.040 per image
     - hd: $0.080 per image

4. **Download & Save Image:**
   - Call this.downloadAndSave(imageUrl, projectId, panelIndex)
   - Saves as PNG: `{STORAGE_PATH}/{projectId}/panel_{panelIndex}.png`
   - Returns localFilePath

5. **Return GeneratedPanel object**

**Method: generateBatch() - Batch Generation with Mode Selection**

```typescript
async generateBatch(
  panelPrompts: PanelPrompt[],
  projectId: string,
  batchMode: 'sequential' | 'parallel',
  settings?: GenerationSettings,
  onProgress?: (event: ProgressEvent) => void
): Promise<GeneratedPanel[]>
```

Implementation:
1. Validate inputs
2. Route to sequential or parallel handler
3. Call onProgress callback with progress events
4. Return array of GeneratedPanel

**Method: generateSequential() - Rate-Limit Friendly**

```typescript
private async generateSequential(
  panelPrompts: PanelPrompt[],
  projectId: string,
  settings?: GenerationSettings,
  onProgress?: (event: ProgressEvent) => void
): Promise<GeneratedPanel[]>
```

Implementation:
1. Initialize results array
2. For each panelPrompt (with index):
   a. Call generatePanelWithRetry(panelPrompt, projectId, settings)
   b. On success:
      - Add to results array
      - Call onProgress with percentage = (index + 1) / total * 100
   c. On failure (after max retries):
      - Update panel status to 'failed' in DB
      - Log error
      - Continue to next panel

3. Return results array (may include failed panels with status='failed')

**Method: generateParallel() - High Speed (Rate Limit Aware)**

```typescript
private async generateParallel(
  panelPrompts: PanelPrompt[],
  projectId: string,
  settings?: GenerationSettings,
  onProgress?: (event: ProgressEvent) => void
): Promise<GeneratedPanel[]>
```

Implementation:
1. **Batch Control:**
   - Max concurrent = Math.floor(CONFIG.DALLE_RATE_LIMIT_PER_MINUTE / 2)
   - Split panelPrompts into batches of max concurrent

2. **For each batch:**
   - Create Promise.allSettled() for batch
   - Wait for all to settle
   - Process results
   - Send progress update to onProgress
   - Delay before next batch (respect rate limits)

3. **Failure Handling:**
   - Collect failed panels
   - Retry failed panels sequentially (exponential backoff)
   - Update onProgress for retries

4. **Return results array**

**Method: generatePanelWithRetry() - Core Retry Logic**

```typescript
private async generatePanelWithRetry(
  panelPrompt: PanelPrompt,
  projectId: string,
  settings?: GenerationSettings,
  retryCount: number = 0
): Promise<GeneratedPanel>
```

Implementation:
1. Try to generate panel via generatePanel()
2. On success: Return GeneratedPanel
3. On failure:
   - If retryCount < CONFIG.MAX_RETRIES_PER_PANEL:
     - Calculate backoff delay: 2^retryCount * 1000ms (exponential)
     - Wait for delay
     - Recursively call with retryCount++
   - If max retries exceeded:
     - Throw error with panel index info

**Exponential Backoff Formula:**
```
delay(attempt) = base_delay * (2 ^ attempt) + random jitter
delay(0) = 1000ms (1 second)
delay(1) = 2000ms (2 seconds)
delay(2) = 4000ms (4 seconds)
+ add ±random(0, 500ms) jitter to avoid thundering herd
```

**Method: downloadAndSave() - Store Images Locally**

```typescript
private async downloadAndSave(
  imageUrl: string,
  projectId: string,
  panelIndex: number
): Promise<string>
```

Implementation:
1. Create project uploads directory if not exists: `{STORAGE_PATH}/{projectId}/`
2. Fetch image from URL using axios or native fetch:
   ```typescript
   const response = await fetch(imageUrl);
   const arrayBuffer = await response.arrayBuffer();
   const buffer = Buffer.from(arrayBuffer);
   ```
3. Save to disk:
   ```typescript
   const filePath = path.join(this.uploadDir, projectId, `panel_${panelIndex}.png`);
   await fs.writeFile(filePath, buffer);
   ```
4. Return relative or absolute path

**Method: getImageSize() - Aspect Ratio to DALL-E Size**

```typescript
private getImageSize(
  aspectRatio: string
): '1024x1024' | '1792x1024' | '1024x1792'
```

Self-explanatory mapping function.

### Route Handler Integration

Implement in `backend/src/routes/manga.ts`:

**POST /api/manga/:projectId/generate-images - SSE Streaming**

```typescript
router.post('/:projectId/generate-images', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { panelIndices, batchMode } = req.body as GenerateImagesRequest;

    // Set up SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Fetch project and panels from DB
    const project = await getProject(projectId);
    if (!project) throw new NotFoundError('Project');

    // Filter panels (all or specific indices)
    const panelsToGenerate = project.panels.filter(
      p => !panelIndices || panelIndices.includes(p.panelIndex)
    );

    // Generate prompts array
    const panelPrompts: PanelPrompt[] = panelsToGenerate.map(p => ({
      panelIndex: p.panelIndex,
      dallePrompt: p.prompt!,
      storyBeat: p.storyBeat!,
      visualFocus: 'main subject',  // Extract from context if available
      transitionType: 'cut',        // Default, could be from DB
    }));

    // Call imageGenerationService
    imageGenService.generateBatch(
      panelPrompts,
      projectId,
      batchMode,
      project.generationSettings,
      (progressEvent) => {
        // Send progress as SSE
        res.write(`data: ${JSON.stringify(progressEvent)}\n\n`);
      }
    ).then(generatedPanels => {
      // Update database with generated images
      for (const panel of generatedPanels) {
        updatePanelImage(panel.panelIndex, {
          imageUrl: panel.imageUrl,
          imageFilePath: panel.localFilePath,
          revisedPrompt: panel.revisedPrompt,
          status: panel.revisedPrompt ? 'generated' : 'generated',
        });
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        message: 'Image generation complete',
        totalCost: generatedPanels.reduce((sum, p) => sum + p.costUsd, 0),
      })}\n\n`);

      res.end();
    }).catch(err => {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: err.message,
      })}\n\n`);
      res.end();
    });
  } catch (err) {
    next(err);
  }
});
```

### Cost Tracking

**Implementation:**
- Track cost per API call in GeneratedPanel.costUsd
- Sum across all panels: `totalCost = sum(generatedPanels.map(p => p.costUsd))`
- Update project.totalCost in DB: `project.totalCost += generatedPanels totalCost`
- Log costs for each call (useful for budget monitoring)

**Cost Constants (from types.ts):**
```typescript
API_COSTS = {
  VISION_PER_CALL: 0.025,    // GPT-4V
  DALLE3_STANDARD: 0.040,    // per image
  DALLE3_HD: 0.080,          // per image
}
```

### Testing Requirements

```bash
# 1. Set up test project (with prompts from Task 2)
PROJECT_ID="test-project-id"
# Or use output from Task 2 test

# 2. Generate images (sequential mode)
curl -X POST http://localhost:5000/api/manga/$PROJECT_ID/generate-images \
  -H "Content-Type: application/json" \
  -d '{"batchMode": "sequential"}' \
  -H "Accept: text/event-stream"

# 3. Verify local image files created
ls -la uploads/$PROJECT_ID/

# 4. Check database for updated image URLs
sqlite3 data/koma-fill.db "SELECT panelIndex, imageFilePath, status FROM panels WHERE projectId='$PROJECT_ID';"

# 5. Verify cost tracking
curl http://localhost:5000/api/manga/$PROJECT_ID | jq '.totalCost'
```

### Files This Task Provides to Other Agents

- **Generated panel images** - Stored in uploads/{projectId}/, used by Task 4
- **Image file paths** - Updated in DB, used by Task 4 for layout composition
- **Cost tracking** - Used by frontend for budget display

### Output Validation Checklist

- [ ] DALL-E 3 API calls succeed with valid prompts
- [ ] Retry logic works with exponential backoff
- [ ] Images download and save to {STORAGE_PATH}/{projectId}/
- [ ] SSE streaming sends progress events correctly
- [ ] onProgress callback fires with accurate percentage
- [ ] Cost calculation correct (0.04 standard, 0.08 HD)
- [ ] Panel records updated with imageUrl and imageFilePath
- [ ] Sequential and parallel modes both work
- [ ] Rate limiting respected (max 5 calls/min by default)
- [ ] Error handling for network issues, API failures
- [ ] No TypeScript compilation errors

---

## Task 4: レイアウトエンジン+エクスポート (Agent D)
### Manga Layout Composition & Multi-Format Export

**Time Estimate:** 45-60 minutes
**Difficulty:** Intermediate (Sharp library learning curve)
**Dependencies:** Task 1 (DB), Task 3 (generated images)

### Objective
Implement Sharp-based manga layout composition with grid calculation, panel resizing and positioning, border/gutter rendering, speech bubble overlay, and PNG/JPG/PDF export functionality.

### Target Files to Create/Modify

```
backend/
└── src/
    ├── services/
    │   ├── layoutEngine.ts          [IMPLEMENT] Panel composition & layout
    │   └── exportService.ts         [CREATE] PNG/JPG/PDF export
    └── utils/
        └── imageProcessor.ts        [HELPER] Image processing utilities
```

### TypeScript Interfaces

```typescript
// Layout composition result
ComposedLayout {
  buffer: Buffer;                    // PNG image buffer
  width: number;                     // Page width (px)
  height: number;                    // Page height (px)
  format: 'png';
  panelPositions: PanelPosition[];   // Position data for each panel
}

PanelPosition {
  panelIndex: number;
  x: number;                         // Offset from top-left (px)
  y: number;
  width: number;                     // Panel width (px)
  height: number;                    // Panel height (px)
}

// Input to layout engine
LayoutConfig {
  totalPanels: number;               // 4, 6, 8, etc.
  format: LayoutFormat;              // 'vertical' | 'horizontal' | 'square'
  readingOrder: ReadingOrder;        // 'japanese' | 'western'
  gutterSize: number;                // Space between panels (px)
  borderWidth: number;               // Panel border thickness (px)
  borderColor: string;               // Hex color
  backgroundColor: string;           // Hex color
  pageWidth: number;                 // Canvas width (px)
  pageHeight: number;                // Canvas height (px)
}
```

### Implementation Details

#### LayoutEngine (`backend/src/services/layoutEngine.ts`)

**Method: composePanels() - Main Composition Function**

```typescript
async composePanels(
  panelImagePaths: string[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): Promise<ComposedLayout>
```

Implementation Steps:

1. **Calculate Grid:**
   ```typescript
   const grid = this.calculateGrid(panelImagePaths.length, config);
   // Returns { cols: number, rows: number }
   ```
   Already implemented - use it.

2. **Calculate Panel Positions:**
   ```typescript
   const positions = this.calculatePanelPositions(grid, config);
   // Returns: PanelPosition[] with x, y, width, height for each panel
   ```
   Already implemented - use it.

3. **Create Background Canvas:**
   ```typescript
   import sharp from 'sharp';

   let canvas = sharp({
     create: {
       width: config.pageWidth,
       height: config.pageHeight,
       channels: 4,                    // RGBA
       background: config.backgroundColor,  // Parsed from hex
     }
   });
   ```

4. **Load & Resize Panel Images:**
   ```typescript
   const composites = await Promise.all(
     panelImagePaths.map(async (imgPath, i) => {
       if (!fs.existsSync(imgPath)) {
         throw new Error(`Panel image not found: ${imgPath}`);
       }

       const position = positions[i];
       const resized = await sharp(imgPath)
         .resize(position.width, position.height, {
           fit: 'cover',              // Fill panel, crop if needed
           withoutEnlargement: false
         })
         .toBuffer();

       return {
         input: resized,
         left: position.x,
         top: position.y
       };
     })
   );
   ```

5. **Composite Panels Onto Canvas:**
   ```typescript
   let result = await canvas.composite(composites).png();
   ```

6. **Add Borders (Optional - if borderWidth > 0):**
   - Use SVG overlay to draw rectangles around each panel
   - Create SVG:
     ```svg
     <svg width="800" height="1200">
       <!-- For each panel position -->
       <rect x="10" y="10" width="390" height="590"
             fill="none" stroke="black" stroke-width="2" />
     </svg>
     ```
   - Composite SVG overlay:
     ```typescript
     const borderSvg = this.generateBorderSvg(positions, config);
     result = await result.composite([{
       input: borderSvg,
       top: 0,
       left: 0
     }]);
     ```

7. **Return ComposedLayout:**
   ```typescript
   const buffer = await result.toBuffer();
   return {
     buffer,
     width: config.pageWidth,
     height: config.pageHeight,
     format: 'png',
     panelPositions: positions
   };
   ```

**Method: addSpeechBubbles() - Overlay Speech Bubbles**

```typescript
async addSpeechBubbles(
  layout: ComposedLayout,
  bubbles: SpeechBubble[]
): Promise<ComposedLayout>
```

Implementation:

1. **For each speech bubble:**
   - Get panel position from layout.panelPositions[bubble.panelIndex]
   - Calculate bubble position within panel:
     - 'top' → y = panel.y + 30
     - 'middle' → y = panel.y + panel.height/2 - 30
     - 'bottom' → y = panel.y + panel.height - 60

2. **Create SVG speech bubble:**
   ```typescript
   const svg = this.generateSpeechBubbleSvg(bubble, position, style);
   // Generates SVG with text, shape varies by style:
   // 'rounded', 'cloud', 'spiked', 'rectangular'
   ```

3. **Composite all bubble SVGs:**
   ```typescript
   let result = sharp(layout.buffer);
   const bubbleSvgs = bubbles.map((bubble, idx) =>
     this.generateSpeechBubbleSvg(bubble, panelPositions[bubble.panelIndex])
   );

   result = await result.composite(
     bubbleSvgs.map((svg, i) => ({ input: svg }))
   );
   ```

4. **Return updated ComposedLayout**

**Helper: generateBorderSvg()**
```typescript
private generateBorderSvg(
  positions: PanelPosition[],
  config: LayoutConfig
): Buffer
```

Generate SVG with rectangle borders around each panel:
```svg
<svg width="800" height="1200">
  <rect x="10" y="10" width="390" height="590"
        fill="none" stroke="#000000" stroke-width="2" />
  <!-- repeated for each panel -->
</svg>
```

Convert to Buffer and return.

**Helper: generateSpeechBubbleSvg()**
```typescript
private generateSpeechBubbleSvg(
  bubble: SpeechBubble,
  panelPosition: PanelPosition,
  targetY: number  // top/middle/bottom
): Buffer
```

Generate SVG with speech bubble shape. Example for 'rounded':
```svg
<svg width="300" height="100">
  <!-- Rounded rectangle -->
  <path d="M 10,10 Q 10,10 20,10 L 270,10 Q 280,10 280,20 L 280,70 Q 280,80 270,80 L 30,80 Q 20,80 20,70 L 20,40 L 0,60 L 20,50 L 20,20 Q 20,10 10,10"
        fill="white" stroke="black" stroke-width="1" />
  <text x="20" y="50" font-family="Arial" font-size="14">Your text here</text>
</svg>
```

Return SVG as Buffer via:
```typescript
const svgBuffer = Buffer.from(svgString, 'utf-8');
```

### ExportService (`backend/src/services/exportService.ts`) - NEW FILE

Implement export to PNG, JPG, PDF formats.

```typescript
export class ExportService {
  async exportPNG(
    layout: ComposedLayout,
    filepath: string,
    compression: 'low' | 'medium' | 'high'
  ): Promise<void>

  async exportJPG(
    layout: ComposedLayout,
    filepath: string,
    quality: number  // 60-95
  ): Promise<void>

  async exportPDF(
    layout: ComposedLayout,
    filepath: string,
    metadata: { title?: string; author?: string }
  ): Promise<void>
}
```

**exportPNG():**
```typescript
async exportPNG(layout, filepath, compression) {
  const compressionLevel = compression === 'high' ? 9 : compression === 'medium' ? 6 : 1;
  await sharp(layout.buffer)
    .png({ compressionLevel })
    .toFile(filepath);
}
```

**exportJPG():**
```typescript
async exportJPG(layout, filepath, quality = 80) {
  await sharp(layout.buffer)
    .jpeg({ quality, mozjpeg: true })
    .toFile(filepath);
}
```

**exportPDF():**
Requires pdfkit library:
```typescript
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';

async exportPDF(layout, filepath, metadata = {}) {
  const doc = new PDFDocument({
    size: [layout.width, layout.height]
  });

  if (metadata.title) doc.title(metadata.title);
  if (metadata.author) doc.author(metadata.author);

  // Add image to PDF
  doc.image(layout.buffer, 0, 0, {
    width: layout.width,
    height: layout.height
  });

  doc.pipe(createWriteStream(filepath));
  doc.end();
}
```

### Route Handler Integration

Implement in `backend/src/routes/manga.ts`:

**POST /api/manga/:projectId/layout**
```typescript
router.post('/:projectId/layout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { speechBubbles } = req.body as GenerateLayoutRequest;

    // Fetch project and panels from DB
    const project = await getProject(projectId);
    if (!project) throw new NotFoundError('Project');

    // Get panel image paths
    const panelPaths = project.panels
      .sort((a, b) => a.panelIndex - b.panelIndex)
      .map(p => p.imageFilePath)
      .filter(path => path !== undefined);

    // Compose layout
    const layoutEngine = new LayoutEngine();
    let layout = await layoutEngine.composePanels(panelPaths, project.layoutConfig);

    // Add speech bubbles if provided
    if (speechBubbles && speechBubbles.length > 0) {
      layout = await layoutEngine.addSpeechBubbles(layout, speechBubbles);
    }

    // Save layout buffer to temporary file for preview
    const layoutPath = path.join(CONFIG.STORAGE_PATH, projectId, 'layout.png');
    await fs.writeFile(layoutPath, layout.buffer);

    // Update project status
    await updateProject(projectId, { status: 'complete' });

    // Return layout info
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
```

**POST /api/manga/:projectId/export**
```typescript
router.post('/:projectId/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { format, compression, resolution, title, author } = req.body as ExportRequest;

    // Fetch project layout
    const layoutPath = path.join(CONFIG.STORAGE_PATH, projectId, 'layout.png');
    if (!fs.existsSync(layoutPath)) {
      throw new Error('Layout not yet generated. Call /layout endpoint first.');
    }

    const layoutBuffer = await fs.promises.readFile(layoutPath);
    const layout: ComposedLayout = {
      buffer: layoutBuffer,
      width: 800,  // From project.layoutConfig
      height: 1200,
      format: 'png',
      panelPositions: []  // Could fetch from DB if needed
    };

    // Export to requested format
    const exportService = new ExportService();
    const timestamp = Date.now();
    const exportPath = path.join(CONFIG.STORAGE_PATH, projectId, `manga_${timestamp}.${format}`);

    if (format === 'png') {
      await exportService.exportPNG(layout, exportPath, compression as 'low' | 'medium' | 'high');
    } else if (format === 'jpg') {
      const qualityMap = { low: 60, medium: 80, high: 95 };
      await exportService.exportJPG(layout, exportPath, qualityMap[compression]);
    } else if (format === 'pdf') {
      await exportService.exportPDF(layout, exportPath, { title, author });
    }

    // Update project status
    await updateProject(projectId, { status: 'exported' });

    res.json({
      message: 'Export successful',
      projectId,
      format,
      downloadUrl: `/uploads/${projectId}/manga_${timestamp}.${format}`,
      filePath: exportPath
    });
  } catch (err) {
    next(err);
  }
});
```

### Testing Requirements

```bash
# 1. Generate layout from Task 3 images
PROJECT_ID="test-project-id"
curl -X POST http://localhost:5000/api/manga/$PROJECT_ID/layout \
  -H "Content-Type: application/json" \
  -d '{
    "speechBubbles": [
      {
        "panelIndex": 0,
        "text": "Wow!",
        "position": "top",
        "style": "rounded"
      }
    ]
  }'

# 2. View composed layout
open http://localhost:5000/uploads/$PROJECT_ID/layout.png

# 3. Export to PNG
curl -X POST http://localhost:5000/api/manga/$PROJECT_ID/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "png",
    "compression": "medium",
    "resolution": "web",
    "title": "My Manga"
  }'

# 4. Export to PDF
curl -X POST http://localhost:5000/api/manga/$PROJECT_ID/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "pdf",
    "compression": "medium",
    "title": "My Manga",
    "author": "AI Creator"
  }'

# 5. Verify files exist
ls -lh uploads/$PROJECT_ID/
```

### Files This Task Provides to Other Agents

- **Composed layout image** - Used by frontend for preview
- **Export files** - PNG/JPG/PDF outputs for download
- **Layout metadata** - Panel positions for debugging/display

### Output Validation Checklist

- [ ] calculateGrid() and calculatePanelPositions() methods work correctly
- [ ] composePanels() successfully combines images with sharp
- [ ] Borders render correctly around panels
- [ ] Speech bubbles overlay without distortion
- [ ] Multiple speech bubble styles work ('rounded', 'cloud', 'spiked', 'rectangular')
- [ ] Layout PNG saved and readable
- [ ] exportPNG() produces valid PNG files
- [ ] exportJPG() produces valid JPG files with quality control
- [ ] exportPDF() produces valid PDF with metadata
- [ ] /layout endpoint returns correct panel positions
- [ ] /export endpoint returns download URLs
- [ ] Compression settings affect file size appropriately
- [ ] No TypeScript compilation errors

---

## Task 5: Reactフロントエンド (Agent E)
### Complete React UI with Component Implementation

**Time Estimate:** 60-80 minutes
**Difficulty:** Intermediate (React component patterns)
**Dependencies:** Tasks 1-4 (backend API must be running)

### Objective
Complete all React components for the koma-fill frontend including image upload with drag-drop, story prompt editor, panel grid with drag-and-drop reordering, complete manga generation workflow orchestration, real-time SSE progress updates, and multi-format export options. Configure Tailwind CSS for styling.

### Target Files to Create/Modify

```
frontend/
├── src/
│   ├── components/
│   │   ├── ImageUploader.tsx           [IMPLEMENT] Dropzone with position selector
│   │   ├── StoryPromptEditor.tsx       [ENHANCE] Add sample prompts
│   │   ├── PanelGrid.tsx               [IMPLEMENT] Drag-and-drop reordering
│   │   ├── LayoutSelector.tsx          [VERIFY] Layout config UI
│   │   ├── ExportOptions.tsx           [VERIFY] Export format selection
│   │   └── ProgressBar.tsx             [CREATE] Real-time progress display
│   ├── hooks/
│   │   └── useMangaGeneration.ts       [IMPLEMENT] Full workflow orchestration
│   ├── services/
│   │   └── apiClient.ts                [IMPLEMENT] API client with SSE support
│   ├── pages/
│   │   ├── CreateMangaPage.tsx         [IMPLEMENT] Main workflow page
│   │   └── PreviewPage.tsx             [IMPLEMENT] Result preview & download
│   ├── App.tsx                         [UPDATE] Routing
│   ├── main.tsx                        [VERIFY] Entry point
│   └── index.css                       [UPDATE] Tailwind directives
├── tailwind.config.js                  [CREATE] Tailwind configuration
├── postcss.config.js                   [CREATE] PostCSS configuration
├── package.json                        [UPDATE] Add Tailwind dependencies
└── tsconfig.json                       [VERIFY] TypeScript config
```

### TypeScript Interfaces (from `frontend/src/types/index.ts`)

Already defined - reference for component props.

### Implementation Details

#### 1. Tailwind CSS Setup

**Install Dependencies:**
```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**tailwind.config.js:**
```javascript
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        manga: {
          dark: '#1a1a1a',
          light: '#f5f5f5',
        }
      }
    },
  },
  plugins: [],
}
```

**postcss.config.js:**
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**frontend/src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition;
  }
  .btn-secondary {
    @apply px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition;
  }
  .input-field {
    @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500;
  }
}
```

#### 2. API Client (`frontend/src/services/apiClient.ts`)

```typescript
import { MangaProject, Panel, GenerationProgress, ProgressEvent } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export class APIClient {
  /**
   * Create new manga project
   */
  async createProject(name: string, storyPrompt: string, layoutConfig?: any) {
    const response = await fetch(`${API_BASE}/manga/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: name,
        storyPrompt,
        layoutConfig
      })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<MangaProject>;
  }

  /**
   * Upload key images
   */
  async uploadImages(projectId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));

    const response = await fetch(`${API_BASE}/manga/${projectId}/upload`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  /**
   * Analyze images using Vision API
   */
  async analyzeImages(projectId: string, depth: 'quick' | 'detailed' = 'quick') {
    const response = await fetch(`${API_BASE}/manga/${projectId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisDepth: depth })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  /**
   * Generate panel prompts
   */
  async generatePrompts(projectId: string, storyPrompt: string, panelCount: number) {
    const response = await fetch(`${API_BASE}/manga/${projectId}/generate-prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyPrompt,
        panelCount,
        characterConsistency: true
      })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<Panel[]>;
  }

  /**
   * Generate images via DALL-E 3 (SSE streaming)
   */
  streamImageGeneration(
    projectId: string,
    batchMode: 'sequential' | 'parallel',
    onProgress: (event: ProgressEvent) => void,
    onError: (error: Error) => void
  ): () => void {
    const eventSource = new EventSource(
      `${API_BASE}/manga/${projectId}/generate-images?batchMode=${batchMode}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
      } catch (e) {
        console.error('Failed to parse SSE message:', e);
      }
    };

    eventSource.onerror = () => {
      onError(new Error('Generation failed or connection lost'));
      eventSource.close();
    };

    // Return cleanup function
    return () => eventSource.close();
  }

  /**
   * Compose layout with speech bubbles
   */
  async composeLayout(projectId: string, speechBubbles?: any) {
    const response = await fetch(`${API_BASE}/manga/${projectId}/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speechBubbles })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  /**
   * Export to PNG/JPG/PDF
   */
  async exportManga(
    projectId: string,
    format: 'png' | 'jpg' | 'pdf',
    compression: 'low' | 'medium' | 'high' = 'medium',
    title?: string,
    author?: string
  ) {
    const response = await fetch(`${API_BASE}/manga/${projectId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format,
        compression,
        resolution: 'web',
        title,
        author
      })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  /**
   * Fetch project details
   */
  async getProject(projectId: string) {
    const response = await fetch(`${API_BASE}/manga/${projectId}`);
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<MangaProject>;
  }

  /**
   * Reorder panels
   */
  async reorderPanels(projectId: string, panelOrder: number[]) {
    const response = await fetch(`${API_BASE}/manga/${projectId}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelOrder })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }
}

export const apiClient = new APIClient();
```

#### 3. useMangaGeneration Hook (`frontend/src/hooks/useMangaGeneration.ts`)

```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { MangaProject, GenerationProgress, UploadedImage } from '../types';

export function useMangaGeneration() {
  const [project, setProject] = useState<MangaProject | null>(null);
  const [progress, setProgress] = useState<GenerationProgress>({
    stage: 'idle',
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    message: ''
  });
  const [error, setError] = useState<string | null>(null);

  /**
   * Complete workflow: Create → Upload → Analyze → Generate Prompts → Generate Images → Layout
   */
  const generateManga = useCallback(async (
    projectName: string,
    storyPrompt: string,
    uploadedImages: UploadedImage[],
    layoutConfig: any,
    generationSettings: any
  ) => {
    try {
      setError(null);

      // Stage 1: Create project
      setProgress({
        stage: 'uploading',
        currentStep: 0,
        totalSteps: 5,
        percentage: 20,
        message: 'Creating project...'
      });
      const newProject = await apiClient.createProject(projectName, storyPrompt, layoutConfig);
      setProject(newProject);

      // Stage 2: Upload images
      setProgress({
        stage: 'uploading',
        currentStep: 1,
        totalSteps: 5,
        percentage: 40,
        message: 'Uploading reference images...'
      });
      const files = uploadedImages.map(img => img.file);
      await apiClient.uploadImages(newProject.id, files);

      // Stage 3: Analyze images
      setProgress({
        stage: 'analyzing',
        currentStep: 2,
        totalSteps: 5,
        percentage: 60,
        message: 'Analyzing images with Vision API...'
      });
      await apiClient.analyzeImages(newProject.id, 'detailed');

      // Stage 4: Generate prompts
      setProgress({
        stage: 'generating_prompts',
        currentStep: 3,
        totalSteps: 5,
        percentage: 70,
        message: 'Generating panel prompts...'
      });
      await apiClient.generatePrompts(
        newProject.id,
        storyPrompt,
        layoutConfig.totalPanels
      );

      // Stage 5: Generate images (with SSE streaming)
      setProgress({
        stage: 'generating_images',
        currentStep: 4,
        totalSteps: 5,
        percentage: 75,
        message: 'Starting image generation...'
      });

      await new Promise<void>((resolve, reject) => {
        const cleanup = apiClient.streamImageGeneration(
          newProject.id,
          'sequential',  // or 'parallel' based on user preference
          (progressEvent) => {
            if (progressEvent.type === 'complete') {
              setProgress(prev => ({
                ...prev,
                percentage: 90,
                message: 'Image generation complete!'
              }));
              resolve();
            } else if (progressEvent.type === 'error') {
              reject(new Error(progressEvent.error || 'Generation failed'));
            } else {
              setProgress({
                stage: 'generating_images',
                currentStep: 4 + (progressEvent.currentStep || 0) * 0.1,
                totalSteps: 5,
                percentage: 75 + (progressEvent.percentage || 0) * 0.15,
                message: progressEvent.message,
                currentPanelIndex: progressEvent.panelIndex
              });
            }
          },
          reject
        );
      });

      // Stage 6: Compose layout
      setProgress({
        stage: 'composing_layout',
        currentStep: 5,
        totalSteps: 5,
        percentage: 95,
        message: 'Composing final layout...'
      });
      await apiClient.composeLayout(newProject.id);

      // Complete
      const finalProject = await apiClient.getProject(newProject.id);
      setProject(finalProject);
      setProgress({
        stage: 'idle',
        currentStep: 5,
        totalSteps: 5,
        percentage: 100,
        message: 'Manga generation complete!'
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setProgress({
        stage: 'idle',
        currentStep: 0,
        totalSteps: 0,
        percentage: 0,
        message: `Error: ${errorMsg}`
      });
    }
  }, []);

  const exportManga = useCallback(async (
    projectId: string,
    format: 'png' | 'jpg' | 'pdf',
    compression: 'low' | 'medium' | 'high' = 'medium'
  ) => {
    try {
      setError(null);
      setProgress({
        stage: 'exporting',
        currentStep: 0,
        totalSteps: 1,
        percentage: 50,
        message: `Exporting as ${format.toUpperCase()}...`
      });

      const result = await apiClient.exportManga(projectId, format, compression);

      setProgress({
        stage: 'idle',
        currentStep: 1,
        totalSteps: 1,
        percentage: 100,
        message: 'Export complete!'
      });

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed';
      setError(errorMsg);
      throw err;
    }
  }, []);

  return {
    project,
    progress,
    error,
    generateManga,
    exportManga,
    setError
  };
}
```

#### 4. Components

**ImageUploader.tsx:**
```typescript
import { useCallback, useState } from 'react';
import { UploadedImage, ImagePosition } from '../types';

interface ImageUploaderProps {
  onImagesSelected: (images: UploadedImage[]) => void;
}

export function ImageUploader({ onImagesSelected }: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<ImagePosition>('start');

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addImages(files);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addImages(Array.from(e.target.files));
    }
  };

  const addImages = (files: File[]) => {
    const newImages = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      position: selectedPosition
    }));
    setImages(prev => [...prev, ...newImages]);
    onImagesSelected([...images, ...newImages]);
  };

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    setImages(updated);
    onImagesSelected(updated);
  };

  return (
    <div className="w-full max-w-2xl">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition"
      >
        <p className="text-gray-600 mb-4">Drag and drop images here or click to select</p>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
          id="image-input"
        />
        <label htmlFor="image-input" className="btn-primary cursor-pointer">
          Select Images
        </label>
      </div>

      <div className="mt-4">
        <label className="block mb-2">Position in Story:</label>
        <select
          value={selectedPosition}
          onChange={e => setSelectedPosition(e.target.value as ImagePosition)}
          className="input-field"
        >
          <option value="start">Start (Reference)</option>
          <option value="end">End (Reference)</option>
          <option value={1}>Panel 1</option>
          <option value={2}>Panel 2</option>
        </select>
      </div>

      {images.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {images.map((img, idx) => (
            <div key={idx} className="relative">
              <img src={img.previewUrl} alt={`Preview ${idx}`} className="rounded-lg w-full h-48 object-cover" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**StoryPromptEditor.tsx (Enhanced):**
```typescript
import { useState } from 'react';

interface StoryPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const SAMPLE_PROMPTS = [
  'A young ninja discovers their hidden powers and must save their village from a mysterious threat.',
  'Two rival chefs compete in a cooking tournament, discovering they have more in common than they thought.',
  'A time traveler must prevent a catastrophic event by gathering clues from different eras.',
];

export function StoryPromptEditor({ value, onChange }: StoryPromptEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full max-w-2xl">
      <label className="block text-lg font-semibold mb-2">Your Story Prompt</label>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Write your manga story here. Be descriptive about characters, setting, and plot..."
        className="input-field h-32 resize-none"
      />

      <div className="mt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:underline text-sm"
        >
          {isExpanded ? 'Hide' : 'Show'} Sample Prompts
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-2">
            {SAMPLE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onChange(prompt)}
                className="block w-full text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**PanelGrid.tsx (with Drag-and-Drop):**
```typescript
import { useState } from 'react';
import { Panel } from '../types';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePanel({ panel }: { panel: Panel }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: panel.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-4">
      <div className="bg-white rounded-lg shadow p-4 cursor-grab active:cursor-grabbing">
        <img
          src={panel.imageUrl}
          alt={`Panel ${panel.panelIndex}`}
          className="w-full h-auto rounded mb-2"
        />
        <p className="text-sm text-gray-600">{panel.storyBeat}</p>
        <span className={`inline-block mt-2 px-2 py-1 rounded text-xs text-white ${
          panel.status === 'generated' ? 'bg-green-500' :
          panel.status === 'pending' ? 'bg-blue-500' :
          'bg-red-500'
        }`}>
          {panel.status}
        </span>
      </div>
    </div>
  );
}

interface PanelGridProps {
  panels: Panel[];
  onReorder: (newOrder: Panel[]) => void;
}

export function PanelGrid({ panels, onReorder }: PanelGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = panels.findIndex(p => p.id === active.id);
      const newIndex = panels.findIndex(p => p.id === over.id);
      const newPanels = [...panels];
      [newPanels[oldIndex], newPanels[newIndex]] = [newPanels[newIndex], newPanels[oldIndex]];
      onReorder(newPanels);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={panels.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {panels.map(panel => (
            <SortablePanel key={panel.id} panel={panel} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

**ProgressBar.tsx:**
```typescript
import { GenerationProgress } from '../types';

export function ProgressBar({ progress }: { progress: GenerationProgress }) {
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-2 flex justify-between">
        <span className="text-sm font-semibold">{progress.message}</span>
        <span className="text-sm text-gray-600">{Math.round(progress.percentage)}%</span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  );
}
```

#### 5. Pages

**CreateMangaPage.tsx:**
```typescript
import { useState } from 'react';
import { ImageUploader } from '../components/ImageUploader';
import { StoryPromptEditor } from '../components/StoryPromptEditor';
import { LayoutSelector } from '../components/LayoutSelector';
import { ProgressBar } from '../components/ProgressBar';
import { useMangaGeneration } from '../hooks/useMangaGeneration';
import { UploadedImage, LayoutConfig } from '../types';

export function CreateMangaPage() {
  const [projectName, setProjectName] = useState('');
  const [storyPrompt, setStoryPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    totalPanels: 4,
    format: 'vertical',
    readingOrder: 'japanese',
    gutterSize: 10,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    pageWidth: 800,
    pageHeight: 1200
  });

  const { progress, error, generateManga } = useMangaGeneration();

  const handleStart = async () => {
    if (!projectName || !storyPrompt) {
      alert('Please enter project name and story prompt');
      return;
    }

    await generateManga(projectName, storyPrompt, uploadedImages, layoutConfig, {
      imageStyle: 'manga style',
      aspectRatio: 'square',
      qualityLevel: 'standard'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center mb-2">koma-fill</h1>
        <p className="text-center text-gray-600">AI-Powered Manga Panel Generator</p>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

        {progress.stage === 'idle' ? (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <label className="block text-lg font-semibold mb-2">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="input-field"
                placeholder="My Awesome Manga"
              />
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <StoryPromptEditor value={storyPrompt} onChange={setStoryPrompt} />
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <ImageUploader onImagesSelected={setUploadedImages} />
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <LayoutSelector config={layoutConfig} onChange={setLayoutConfig} />
            </div>

            <button onClick={handleStart} className="btn-primary w-full text-lg py-3">
              Generate Manga
            </button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow">
            <ProgressBar progress={progress} />
          </div>
        )}
      </div>
    </div>
  );
}
```

**PreviewPage.tsx:**
```typescript
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { PanelGrid } from '../components/PanelGrid';
import { ExportOptions } from '../components/ExportOptions';
import { MangaProject } from '../types';

export function PreviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<MangaProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      apiClient.getProject(projectId).then(setProject).finally(() => setLoading(false));
    }
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-12">Loading...</div>;
  if (!project) return <div className="text-center py-12">Project not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate('/')} className="btn-secondary mb-6">← Back</button>

        <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
        <p className="text-gray-600 mb-6">Project Status: {project.status}</p>

        {project.panels.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-2xl font-semibold mb-4">Panels</h2>
            <PanelGrid panels={project.panels} onReorder={() => {}} />
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Export</h2>
          <ExportOptions projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
```

#### 6. Update App.tsx

```typescript
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CreateMangaPage } from './pages/CreateMangaPage';
import { PreviewPage } from './pages/PreviewPage';
import './index.css';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CreateMangaPage />} />
        <Route path="/project/:projectId" element={<PreviewPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
```

### package.json Updates

Add dependencies:
```bash
npm install -D tailwindcss postcss autoprefixer
npm install react-router-dom @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Testing Requirements

```bash
# 1. Start backend (from Task 1)
cd backend && npm run dev

# 2. In another terminal, start frontend
cd frontend && npm run dev

# 3. Open browser: http://localhost:3000

# 4. Test workflow:
# - Enter project name and story
# - Upload reference images
# - Configure layout
# - Click "Generate Manga"
# - Watch progress bar
# - See panel grid with images
# - Export to PNG/JPG/PDF
```

### Files This Task Uses from Other Agents

- **API endpoints** from Task 1 (database & routes)
- **Analysis data** from Task 2 (character consistency)
- **Generated images** from Task 3 (panel images)
- **Composed layouts** from Task 4 (final manga)

### Output Validation Checklist

- [ ] Tailwind CSS configured and working
- [ ] ImageUploader component with drag-drop works
- [ ] react-dropzone integration functional
- [ ] StoryPromptEditor displays with sample prompts
- [ ] Sample prompt insertion works
- [ ] PanelGrid displays with drag-and-drop reordering
- [ ] @dnd-kit integration functional
- [ ] useMangaGeneration hook orchestrates full workflow
- [ ] SSE progress streaming displays correctly
- [ ] ProgressBar updates in real-time
- [ ] apiClient makes correct API calls
- [ ] All components have TypeScript types
- [ ] CreateMangaPage workflow complete
- [ ] PreviewPage shows generated manga
- [ ] ExportOptions functional (PNG/JPG/PDF)
- [ ] Routing works (create → preview)
- [ ] Error handling displays user-friendly messages
- [ ] npm run dev starts without errors
- [ ] No TypeScript compilation errors

---

## Integration Testing (After All Tasks Complete)

After all 5 agents finish their implementations, run the following integration tests:

```bash
# 1. Start backend
cd /mnt/Projects/koma-fill/backend
npm install
npm run dev
# Expected: "🎨 koma-fill server running on http://localhost:5000"

# 2. Start frontend (new terminal)
cd /mnt/Projects/koma-fill/frontend
npm install
npm run dev
# Expected: "VITE ✓ ready in XXX ms"

# 3. Complete workflow test
# Open http://localhost:3000 in browser
# - Create project
# - Upload 2 reference images
# - Enter story prompt
# - Select layout (4 panels)
# - Click "Generate Manga"
# - Wait for completion
# - View generated panels
# - Export to PNG
# - Verify PNG file created in uploads/

# 4. Verify database
sqlite3 /mnt/Projects/koma-fill/data/koma-fill.db
> SELECT COUNT(*) FROM projects;
> SELECT COUNT(*) FROM panels;
> SELECT COUNT(*) FROM keyImages;

# 5. Check file structure
ls -la /mnt/Projects/koma-fill/uploads/
ls -la /mnt/Projects/koma-fill/data/

# 6. API health check
curl http://localhost:5000/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Known Integration Points to Verify

- Task 1 → Task 2: Panel prompts saved in DB, readable by frontend
- Task 2 → Task 3: Vision analysis influences character consistency in prompts
- Task 3 → Task 4: Generated images saved to disk, paths in database
- Task 4 → Task 5: Layout images served via `/uploads/` static directory
- Task 5 ↔ All: Frontend calls all backend API endpoints successfully

---

## Success Criteria Summary

All 5 tasks completed when:

1. **Backend (Task 1)**: Express server with SQLite database, all CRUD routes working
2. **Vision & Prompts (Task 2)**: OpenAI Vision API analyzes images, GPT-4o generates DALL-E prompts
3. **Image Generation (Task 3)**: DALL-E 3 generates 4+ images with retry logic, SSE progress works
4. **Layout & Export (Task 4)**: Sharp composes panels into manga layout, exports PNG/JPG/PDF
5. **Frontend (Task 5)**: React UI allows workflow from story → generated manga → export

**Total Expected Time**: 4-5 hours per agent (can run in parallel)
**Minimum Test Time**: 30 minutes for integration testing

Good luck, KAMUI agents! ✓

---

*Last Updated: 2025-02-12*
*For issues or questions, refer to the specific task prompts above*
