# Claude Code 自律実行タスク指示書

## ゴール

koma-fill を **本番運用可能なMVP (v1.0)** に仕上げる。
以下のタスクを上から順に実行し、各タスク完了時にコミットすること。
途中で判断に迷う場合は最もシンプルな実装を選択して進むこと。
全タスク完了時に `scripts/smoke-test.sh` が全パスすることを最終ゴールとする。

---

## 共通ルール

- コミットメッセージは日本語OK。Conventional Commits 形式 (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`)
- TypeScript strict mode でコンパイルエラーが出ないこと (`npx tsc --noEmit` を各タスク後に実行)
- 既存テスト (`cd backend && npm test`) が壊れないこと
- `.env` ファイルは変更しない。`.env.example` のみ更新可
- 1タスク = 1コミット を原則とする

---

## プロジェクト構造 (参照用)

```
koma-fill/
├── backend/
│   └── src/
│       ├── config/constants.ts      # 環境変数・定数
│       ├── controllers/             # projectController, generationController, exportController
│       ├── middleware/              # auth, errorHandler, rateLimiter
│       ├── models/types.ts         # 共有型定義
│       ├── repositories/           # projectRepository, panelRepository, keyImageRepository
│       ├── routes/manga.ts         # ルーター (48行, 11エンドポイント)
│       ├── services/               # 5サービス (imageGeneration, imageAnalysis, promptGeneration, layoutEngine, export)
│       └── database/               # connection, schema
├── frontend/
│   └── src/
│       ├── pages/                  # CreateMangaPage, PreviewPage
│       ├── components/             # 9コンポーネント
│       ├── hooks/                  # useMangaGeneration, useExport, useProject
│       ├── services/apiClient.ts   # API クライアント
│       └── types/index.ts          # フロントエンド型定義 (MangaStore interface あり、Zustand未実装)
├── scripts/smoke-test.sh
└── docs/
```

---

## Task 1: モデル設定を環境変数化

**目的**: OpenAI モデル名をハードコードから環境変数に変更し、gpt-4o にアクセスできない環境でもフォールバック可能にする

**ファイル**: `backend/src/config/constants.ts`

**やること**:
1. `DALLE_MODEL`, `VISION_MODEL`, `PROMPT_MODEL` を `process.env` から取得するように変更
2. デフォルト値は現在のまま (`dall-e-3`, `gpt-4o`, `gpt-4o`)
3. `.env.example` にコメント付きで追記

**変更例**:
```typescript
DALLE_MODEL: (process.env.DALLE_MODEL || 'dall-e-3') as string,
VISION_MODEL: (process.env.VISION_MODEL || 'gpt-4o') as string,
PROMPT_MODEL: (process.env.PROMPT_MODEL || 'gpt-4o') as string,
```

**注意**: `as const` を外す必要がある。これにより型が `string` になるので、サービス側で OpenAI API に渡す箇所の型キャストが必要になる可能性あり。影響範囲を確認して対応すること。

**コミット**: `feat: モデル名を環境変数で設定可能にする`

---

## Task 2: パネル削除 API + フロントエンド接続

**目的**: PreviewPage の `handleDelete` がスタブなので実装する

### Backend:

1. `backend/src/controllers/projectController.ts` に `deletePanel` 関数を追加:
   - `DELETE /api/manga/:projectId/panels/:panelIndex`
   - 対象パネルの画像ファイルも削除 (`fs.unlink`)
   - 残りのパネルの `panelIndex` を詰め直す (リナンバリング)
   - レスポンス: `{ message: 'Panel deleted', remainingPanels: number }`

2. `backend/src/routes/manga.ts` にルート追加:
   ```typescript
   router.delete('/:projectId/panels/:panelIndex', deletePanel);
   ```

3. `backend/src/repositories/panelRepository.ts` に `deletePanel(panelId: string)` メソッドを追加

### Frontend:

4. `frontend/src/services/apiClient.ts` に `deletePanel` 関数を追加:
   ```typescript
   export async function deletePanel(projectId: string, panelIndex: number) {
     const res = await api.delete(`/manga/${projectId}/panels/${panelIndex}`);
     return res.data;
   }
   ```

5. `frontend/src/pages/PreviewPage.tsx` の `handleDelete` を実装:
   - 確認ダイアログ (window.confirm) 表示
   - API コール
   - 成功時: toast + プロジェクト再読み込み
   - 失敗時: error toast

### テスト:

6. `backend/src/controllers/__tests__/` は今回は不要（repository テストの環境問題あり）

**コミット**: `feat: パネル削除API実装 + フロントエンド接続`

---

## Task 3: プロジェクト削除 API

**目的**: プロジェクトごと削除する機能がない

### Backend:

1. `backend/src/controllers/projectController.ts` に `deleteProject` 関数を追加:
   - `DELETE /api/manga/:projectId`
   - DB からプロジェクト + 全パネル + 全キーイメージを削除
   - `STORAGE_PATH/{projectId}/` ディレクトリごと削除 (`fs.rm(dir, { recursive: true, force: true })`)
   - レスポンス: `{ message: 'Project deleted' }`

2. `backend/src/routes/manga.ts` にルート追加:
   ```typescript
   router.delete('/:projectId', deleteProject);
   ```

3. `backend/src/repositories/projectRepository.ts` に `deleteProject(projectId: string)` メソッド追加

### Frontend:

4. `frontend/src/services/apiClient.ts` に `deleteProject` 関数追加

5. `PreviewPage.tsx` のヘッダーに「プロジェクト削除」ボタン追加
   - 確認ダイアログ
   - 成功時: toast + navigate('/') でトップに戻る

**コミット**: `feat: プロジェクト削除API + UI実装`

---

## Task 4: Zustand ストア実装

**目的**: `frontend/src/types/index.ts` に `MangaStore` interface が定義済みだが、Zustand ストアが未実装

**ファイル**: `frontend/src/store/mangaStore.ts` (新規作成)

**やること**:

1. Zustand ストアを実装:
```typescript
import { create } from 'zustand';
import { MangaStore, DEFAULT_LAYOUT_CONFIG, DEFAULT_GENERATION_SETTINGS } from '../types';

export const useMangaStore = create<MangaStore>((set) => ({
  project: null,
  uploadedImages: [],
  storyPrompt: '',
  layoutConfig: { ...DEFAULT_LAYOUT_CONFIG },
  generationSettings: { ...DEFAULT_GENERATION_SETTINGS },
  progress: {
    stage: 'idle',
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    message: '',
  },
  error: null,

  setStoryPrompt: (prompt) => set({ storyPrompt: prompt }),
  addUploadedImage: (image) => set((state) => ({
    uploadedImages: [...state.uploadedImages, image],
  })),
  removeUploadedImage: (index) => set((state) => ({
    uploadedImages: state.uploadedImages.filter((_, i) => i !== index),
  })),
  updateLayoutConfig: (config) => set((state) => ({
    layoutConfig: { ...state.layoutConfig, ...config },
  })),
  updateGenerationSettings: (settings) => set((state) => ({
    generationSettings: { ...state.generationSettings, ...settings },
  })),
  setProgress: (progress) => set((state) => ({
    progress: { ...state.progress, ...progress },
  })),
  setError: (error) => set({ error }),
  setProject: (project) => set({ project }),
  reset: () => set({
    project: null,
    uploadedImages: [],
    storyPrompt: '',
    layoutConfig: { ...DEFAULT_LAYOUT_CONFIG },
    generationSettings: { ...DEFAULT_GENERATION_SETTINGS },
    progress: { stage: 'idle', currentStep: 0, totalSteps: 0, percentage: 0, message: '' },
    error: null,
  }),
}));
```

2. `CreateMangaPage.tsx` をリファクタリングして、ローカルの `useState` を Zustand ストアに移行
   - `storyPrompt`, `uploadedImages`, `layoutConfig`, `generationSettings`, `progress` を useMangaStore から取得
   - ページ離脱時に `reset()` は呼ばない（PreviewPage に遷移した後も保持するため）

3. `PreviewPage.tsx` は `project` のフェッチ結果を `useMangaStore.setProject()` に保存

**注意**: 既存の動作を壊さないこと。段階的に移行し、各ページが引き続き正常動作することを確認。

**コミット**: `refactor: Zustand ストア実装 + CreateMangaPage を接続`

---

## Task 5: フロントエンドテスト基盤 + 主要テスト

**目的**: フロントエンドのテストがゼロなので基盤構築と基本テストを追加

### セットアップ:

1. Vitest + React Testing Library をインストール:
   ```bash
   cd frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
   ```

2. `frontend/vite.config.ts` に Vitest 設定を追加:
   ```typescript
   /// <reference types="vitest" />
   // defineConfig の中に:
   test: {
     globals: true,
     environment: 'jsdom',
     setupFiles: './src/test/setup.ts',
   },
   ```

3. `frontend/src/test/setup.ts` 作成:
   ```typescript
   import '@testing-library/jest-dom';
   ```

4. `frontend/package.json` に `"test": "vitest run"` を追加
5. ルートの `package.json` の `test` スクリプトも更新してフロントエンドテストも実行するように

### テストファイル:

6. `frontend/src/store/__tests__/mangaStore.test.ts`:
   - 初期状態の確認
   - setStoryPrompt / addUploadedImage / removeUploadedImage
   - updateLayoutConfig (部分更新)
   - reset で初期状態に戻ること

7. `frontend/src/services/__tests__/apiClient.test.ts`:
   - axios mock で各 API 関数の呼び出しを検証
   - createProject, getProject, listProjects の基本テスト

8. `frontend/src/hooks/__tests__/useExport.test.ts`:
   - renderHook でエクスポートフロー検証
   - エラーハンドリング

**コミット**: `test: フロントエンドテスト基盤 + Zustand/apiClient/hooks テスト追加`

---

## Task 6: Dockerfile + docker-compose

**目的**: ローカル開発と本番デプロイの両方に対応

### ファイル作成:

1. `Dockerfile` (マルチステージビルド):
   ```dockerfile
   # --- Build Stage ---
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   COPY backend/package*.json ./backend/
   COPY frontend/package*.json ./frontend/
   RUN npm ci --workspace=backend --workspace=frontend
   COPY . .
   RUN npm run build

   # --- Production Stage ---
   FROM node:20-alpine
   WORKDIR /app
   COPY --from=builder /app/backend/dist ./backend/dist
   COPY --from=builder /app/backend/package*.json ./backend/
   COPY --from=builder /app/frontend/dist ./frontend/dist
   COPY --from=builder /app/package*.json ./
   RUN npm ci --workspace=backend --production
   ENV NODE_ENV=production
   ENV PORT=5000
   EXPOSE 5000
   CMD ["node", "backend/dist/index.js"]
   ```

   **注意**: 本番では Express が `frontend/dist` を static serve する必要がある。`backend/src/app.ts` にプロダクション用の static ミドルウェアを追加すること:
   ```typescript
   if (CONFIG.NODE_ENV === 'production') {
     app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));
     // SPA fallback
     app.get('*', (_req, res) => {
       res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'));
     });
   }
   ```

2. `docker-compose.yml`:
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "${PORT:-5000}:5000"
       env_file:
         - .env
       volumes:
         - ./data:/app/data
         - ./uploads:/app/uploads
       restart: unless-stopped
   ```

3. `.dockerignore`:
   ```
   node_modules
   .git
   .kamui
   .worktrees
   data
   uploads
   *.md
   ```

**コミット**: `chore: Dockerfile + docker-compose 追加`

---

## Task 7: GitHub Actions CI パイプライン

**目的**: PR / push 時に自動でビルド・テスト・lint を実行

### ファイル: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: cd backend && npm test
      - run: cd frontend && npm test
```

**コミット**: `ci: GitHub Actions CI パイプライン追加`

---

## Task 8: README.md 整備

**目的**: プロジェクトの全体像を説明するドキュメント

**ファイル**: `README.md` (ルート)

**内容**:
1. プロジェクト概要（コマフィル - AIマンガパネル生成ツール）
2. スクリーンショット枠（後で追加）
3. 技術スタック
4. セットアップ手順:
   - Prerequisites (Node.js 20+, OpenAI API Key)
   - `cp .env.example .env` → API キー設定
   - `npm install` → `npm run dev`
   - ブラウザで http://localhost:3000
5. Docker での起動方法
6. API エンドポイント一覧 (表形式、全11 + 新規追加分)
7. プロジェクト構造
8. テスト実行方法
9. ライセンス (MIT)

**コミット**: `docs: README.md 追加`

---

## Task 9: 最終整合性チェック + PROGRESS_LOG 更新

**やること**:

1. TypeScript コンパイルチェック (バックエンド + フロントエンド):
   ```bash
   cd backend && npx tsc --noEmit
   cd ../frontend && npx tsc --noEmit
   ```

2. バックエンドテスト実行:
   ```bash
   cd backend && npm test
   ```

3. フロントエンドテスト実行:
   ```bash
   cd frontend && npm test
   ```

4. ESLint:
   ```bash
   npm run lint
   ```

5. ビルド確認:
   ```bash
   npm run build
   ```

6. `docs/PROGRESS_LOG.md` を更新:
   - 完了フェーズの記録
   - 実装率を更新 (→ ~95%)
   - 残タスクリスト

7. 問題があれば修正してからコミット

**コミット**: `chore: v1.0 最終整合性チェック + PROGRESS_LOG 更新`

---

## 完了条件

以下がすべて満たされたら完了:

- [ ] `npx tsc --noEmit` がバックエンド・フロントエンドともにエラーなし
- [ ] `cd backend && npm test` が全パス (better-sqlite3 環境依存のスキップは許容)
- [ ] `cd frontend && npm test` が全パス
- [ ] `npm run build` が成功
- [ ] `npm run lint` がエラーなし (warnings は許容)
- [ ] 全 9 タスクがコミット済み
- [ ] README.md が存在し、セットアップ手順が明記
- [ ] Dockerfile が存在し、ビルド可能

---

## 注記

- better-sqlite3 のネイティブバイナリは環境依存。CI では `npm rebuild better-sqlite3` が必要になる場合あり
- OpenAI API キーがない環境ではサービステストの一部をモック前提でスキップ可
- フロントエンドテストは Vitest + jsdom 環境で実行（実ブラウザは不要）
- Zustand のバージョンは `zustand@4.5.0` が既にインストール済み
