# Koma Fill (コマフィル)

AI を活用したマンガパネル自動生成ツール。キー画像とストーリープロンプトから中間コマを自動生成し、完成されたマンガページを出力します。

## 技術スタック

| 領域 | 技術 |
|------|------|
| Backend | Node.js / Express / TypeScript |
| Frontend | React 18 / TypeScript / Vite / Tailwind CSS |
| State Management | Zustand |
| Database | SQLite (better-sqlite3) |
| AI | OpenAI API (GPT-4o, DALL-E 3) / Gemini Native Image (Nano Banana 2 / Pro) |
| Image Processing | Sharp |
| Testing | Jest (backend) / Vitest + React Testing Library (frontend) |
| CI/CD | GitHub Actions |
| Container | Docker / Docker Compose |

## セットアップ

### Prerequisites

- Node.js 20+
- npm 9+
- OpenAI API Key

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd koma-fill

# 環境変数を設定
cp .env.example .env
# .env を編集して OPENAI_API_KEY を設定

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスしてください。

### デスクトップアプリとして起動

```bash
# 開発モード（Electron + backend + frontend）
npm run dev:desktop

# macOS アプリをビルド
npm run pack

# /Applications にインストールして Launchpad から起動
npm run install:launcher
```

ビルド後の `.app` は `release/mac-arm64/Koma Fill.app` または `release/mac/Koma Fill.app` に生成されます。

### Docker での起動

```bash
# .env ファイルを設定済みであること
docker compose up -d

# ログを確認
docker compose logs -f
```

`http://localhost:3001` でアクセスできます。

## API エンドポイント

マンガ API は `/api/manga` 配下、ヘルスチェックは `/api/health` です。

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/health` | ヘルスチェック |
| POST | `/api/manga/create` | プロジェクト作成 |
| GET | `/api/manga/` | プロジェクト一覧 |
| GET | `/api/manga/:projectId` | プロジェクト取得 |
| DELETE | `/api/manga/:projectId` | プロジェクト削除 |
| POST | `/api/manga/:projectId/upload` | キー画像アップロード |
| PUT | `/api/manga/:projectId/reorder` | パネル並び替え |
| DELETE | `/api/manga/:projectId/panels/:panelIndex` | パネル削除 |
| POST | `/api/manga/:projectId/analyze` | 画像分析 |
| POST | `/api/manga/:projectId/generate-prompts` | プロンプト生成 |
| POST/GET | `/api/manga/:projectId/generate-images` | 画像生成 (SSE) |
| POST | `/api/manga/:projectId/regenerate/:panelIndex` | パネル再生成 |
| POST | `/api/manga/:projectId/layout` | レイアウト合成 |
| POST | `/api/manga/:projectId/export` | エクスポート |

## プロジェクト構造

```
koma-fill/
├── backend/
│   └── src/
│       ├── config/constants.ts      # 環境変数・定数
│       ├── controllers/             # projectController, generationController, exportController
│       ├── middleware/              # auth, errorHandler, rateLimiter
│       ├── models/types.ts         # 共有型定義
│       ├── repositories/           # projectRepository, panelRepository, keyImageRepository
│       ├── routes/manga.ts         # ルーター
│       ├── services/               # imageGeneration, imageAnalysis, promptGeneration, layoutEngine, export
│       └── database/               # connection, schema
├── frontend/
│   └── src/
│       ├── pages/                  # CreateMangaPage, PreviewPage
│       ├── components/             # UI コンポーネント
│       ├── hooks/                  # useMangaGeneration, useExport, useProject
│       ├── store/                  # Zustand ストア (mangaStore)
│       ├── services/apiClient.ts   # API クライアント
│       └── types/index.ts          # フロントエンド型定義
├── Dockerfile
├── docker-compose.yml
├── .github/workflows/ci.yml
└── scripts/smoke-test.sh
```

## テスト

```bash
# バックエンドテスト
cd backend && npm test

# フロントエンドテスト
cd frontend && npm test

# 全テスト実行
npm test
```

## ビルド

```bash
# バックエンド + フロントエンドをビルド
npm run build

# Electron アプリをビルド
npm run pack
```

## ライセンス

MIT
