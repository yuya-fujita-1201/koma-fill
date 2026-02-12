# koma-fill プロジェクト コンテキスト

## 最終更新: 2026-02-12

## プロジェクト概要
**koma-fill（コマフィル）** - 漫画コマ補填ツール
1〜2枚のキー画像＋ストーリープロンプトから中間コマをDALL-E 3で自動生成し、漫画レイアウトに組み立てるWebアプリケーション。

## 技術スタック
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **画像生成**: OpenAI DALL-E 3 API
- **画像分析**: OpenAI Vision API (GPT-4o)
- **画像処理**: Sharp（レイアウト合成）
- **DB**: SQLite (better-sqlite3)
- **状態管理**: Zustand
- **エクスポート**: Sharp (PNG/JPG) + PDFKit (PDF)

## 現在のステータス: 設計完了・実装準備OK

### 完了済み
1. プロジェクトスケルトン作成（37ファイル）
2. 設定ファイル（package.json, tsconfig, .env.example, .gitignore）
3. 共有TypeScript型定義（backend/src/models/types.ts, frontend/src/types/index.ts）
4. バックエンドスケルトン（全サービス: インターフェース＋TODO＋実装ガイド）
5. フロントエンドスケルトン（全コンポーネント＋フック＋APIクライアント）
6. 設計ドキュメント（ARCHITECTURE.md, API_SPEC.md）
7. KAMUI-4D用実装プロンプト（KAMUI_PROMPTS.md - 5並列タスク, 2,447行）
8. .env設定済み（OpenAI APIキー sk-proj-... 設定完了）
9. Git初期化済み

### 未実施（次のステップ）
- KAMUI-4DまたはClaude Code CLIで5並列タスクの実装を実行
- npm install（backend/frontend両方）
- 動作テスト

## プロジェクト構造
```
koma-fill/
├── .env                  ← APIキー設定済み
├── .env.example
├── .gitignore
├── package.json          ← ルートワークスペース
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              ← エントリーポイント
│       ├── app.ts                ← Express設定
│       ├── config/constants.ts   ← 環境変数読み込み
│       ├── routes/manga.ts       ← 全APIルート（TODO）
│       ├── services/
│       │   ├── imageAnalysisService.ts    ← Vision API（TODO）
│       │   ├── promptGenerationService.ts ← GPT-4oプロンプト生成（TODO）
│       │   ├── imageGenerationService.ts  ← DALL-E 3生成（TODO）
│       │   ├── layoutEngine.ts            ← Sharp合成（TODO）
│       │   └── exportService.ts           ← PNG/JPG/PDFエクスポート（TODO）
│       ├── models/types.ts       ← 全TypeScript型定義（完成）
│       ├── middleware/errorHandler.ts ← エラーハンドリング（完成）
│       └── utils/imageProcessor.ts   ← 画像ユーティリティ（TODO）
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx / App.tsx
│       ├── pages/    CreateMangaPage, PreviewPage
│       ├── components/ ImageUploader, StoryPromptEditor, PanelGrid, LayoutSelector, ExportOptions
│       ├── hooks/    useMangaGeneration
│       ├── services/ apiClient
│       └── types/    index.ts（フロントエンド用型定義）
├── docs/
│   ├── ARCHITECTURE.md      ← アーキテクチャ設計
│   ├── API_SPEC.md          ← 全11エンドポイント仕様
│   └── KAMUI_PROMPTS.md     ← KAMUI-4D用5並列タスクプロンプト ★重要
├── output/                  ← 生成された漫画の出力先
└── uploads/                 ← アップロード画像保存先
```

## KAMUI-4D 並列タスク構成
| Task | Agent | 内容 | 推定時間 |
|------|-------|------|----------|
| Task 1 | Agent A | Backend基盤: Express + SQLite + CRUD | 45-60分 |
| Task 2 | Agent B | 画像分析 + プロンプト生成（Vision API + GPT-4o）| 50-60分 |
| Task 3 | Agent C | DALL-E 3画像生成 + リトライ + SSE | 50-70分 |
| Task 4 | Agent D | レイアウトエンジン + エクスポート（Sharp）| 45-60分 |
| Task 5 | Agent E | React フロントエンド全体 | 60-80分 |

## API エンドポイント一覧
- POST /api/manga/create - プロジェクト作成
- POST /api/manga/:id/upload - キー画像アップロード
- POST /api/manga/:id/analyze - 画像分析（Vision API）
- POST /api/manga/:id/generate-prompts - パネルプロンプト生成
- POST /api/manga/:id/generate-images - 画像生成（SSE）
- POST /api/manga/:id/regenerate/:panelIndex - パネル再生成
- PUT /api/manga/:id/reorder - パネル並び替え
- POST /api/manga/:id/layout - レイアウト合成
- POST /api/manga/:id/export - エクスポート
- GET /api/manga/:id - プロジェクト取得
- GET /api/manga - プロジェクト一覧

## 設計上の決定事項
- DBはSQLite（ローカル開発向け、軽量）
- 画像ストレージはローカルファイルシステム（./uploads/）
- SSEで画像生成進捗をストリーミング
- 読み順は日本式（右→左）をデフォルト
- DALL-E 3のコスト: standard $0.04/枚, HD $0.08/枚
- 4コマ漫画1つで約$0.20〜$0.40

## 関連プロジェクト
- ai-director-project: Flutter製iOS英語学習アプリ（同ワークスペース内）
- note-monetize: コンテンツマネタイズ企画（同ワークスペース内）

## オーナー
Yuya (sam.y.1201@gmail.com)
