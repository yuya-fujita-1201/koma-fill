# koma-fill 開発記録 — 2026年2月13日〜14日

> 想定読者: AIツールを使った個人開発に興味がある人、マルチエージェント開発ワークフローに関心がある人
> 用途: Note記事の素材 / 開発日記
> キーワード: AI漫画生成, マルチエージェント開発, Claude Code, KAMUI-4D, React + Express

---

## このドキュメントについて

koma-fill（コマフィル）の v1.0 MVP 開発における2日間の作業記録です。マルチAIエージェントを活用した並列開発ワークフロー、遭遇したバグとその解決プロセス、OpenAI APIのプロジェクトレベル設定のハマりポイントなど、実践的な知見をまとめています。

---

## プロジェクト概要: koma-fill とは

koma-fillは、AI画像生成を活用した漫画パネル補間ツールです。ユーザーが1〜2枚のキー画像とストーリープロンプトを入力すると、中間のコマを自動生成し、漫画レイアウトとして組み立てます。

### 技術スタック

- **バックエンド**: Node.js + Express + TypeScript + SQLite
- **フロントエンド**: React 18 + Vite + TypeScript + Tailwind CSS + Zustand
- **AI**: OpenAI DALL-E 3（画像生成）、GPT-4o / GPT-4o-mini（画像分析・プロンプト生成）
- **インフラ**: Docker + GitHub Actions CI

### 開発体制（マルチエージェント）

一人の開発者（人間）が複数のAIエージェントを使い分けて開発を進めました。

| 役割 | ツール | 担当内容 |
|------|--------|----------|
| アーキテクト / レビュアー | Claude（Cowork） | 設計判断、コードレビュー、バグ修正 |
| 並列コーディング | KAMUI-4D | 4並列タスクの自律的コード実装 |
| 逐次コーディング | Claude Code | 9タスクの順次自律実装 |
| コードレビュー | Codex | PR単位のレビュー |
| ブラウザ操作 | Claude in Chrome | OpenAIダッシュボード設定変更 |

---

## Day 1（2月13日）: 基盤構築とKAMUI修正

### KAMUI-4D によるPhase 1 並列実装

KAMUI-4Dで4つのタスクを並列実行し、バックエンド/フロントエンドの基盤を一気に構築しました。

- Agent A: バックエンド5サービス実装（ImageAnalysis, PromptGeneration, ImageGeneration, LayoutEngine, Export）
- Agent B: データベーススキーマ + リポジトリ層
- Agent C: APIルーティング + コントローラー
- Agent D: フロントエンド全コンポーネント + ページ

### コードレビューで8件の指摘

KAMUI出力を全ファイル精査し、以下の問題を検出・手動修正しました。

1. **ImageUploaderのuseEffectクリーンアップ不備**（Bug）
2. **吹き出しテキスト分割が日本語未対応**（Bug）
3. **吹き出しSVGビューポートサイズ不整合**（Bug）
4. **エクスポートレスポンスにサーバー絶対パス漏洩**（Security）
5. **未使用importの残存**（Cleanup x2）
6. **@dnd-kit/utilities が暗黙の依存**（Improvement）
7. **CORS設定の不統一**（Improvement）

### Phase 2: 4並列タスク

KAMUI-4Dの第2弾として、テスト・認証・リファクタ・UIコンポーネントの4タスクを設計・実行しました。

---

## Day 2（2月14日）: v1.0仕上げとデバッグ

### Claude Code 9タスク自律実行

v1.0 MVPの仕上げとして、以下の9タスクをClaude Codeで順次実行しました。

1. モデル名を環境変数で設定可能に
2. パネル削除API + フロントエンド接続
3. プロジェクト削除API + UI実装
4. Zustandストア実装 + CreateMangaPage接続
5. フロントエンドテスト基盤 + テスト追加（3 suites, 22 tests）
6. Dockerfile + docker-compose追加
7. GitHub Actions CIパイプライン追加
8. README.md追加
9. 最終整合性チェック

### バグ修正①: React無限再レンダリング

起動時に「Maximum update depth exceeded」エラーが発生。根本原因を追跡しました。

**原因の連鎖:**

```
useMangaGeneration()でuseMangaStore()を引数なしで呼び出し
  → ストア全体の変更を購読（どんな更新でも再レンダリング）
    → setUploadedImagesがuseCallbackでラップされていない
      → 毎回新しい関数参照が生成される
        → ImageUploaderのuseEffectがonImagesChangeを依存配列に持つ
          → 新しい参照 → useEffect発火 → state更新 → 親再レンダリング → ∞
```

**修正（3ファイル）:**

1. `useMangaGeneration.ts` — 完全リライト
   - `useMangaStore()` → 個別セレクタ `useMangaStore((s) => s.uploadedImages)` に変更
   - 全コールバックを `useCallback` でメモ化
   - `startGeneration` 内は `useMangaStore.getState()` で非リアクティブ読み取り

2. `ImageUploader.tsx` — useRef パターン導入
   - `onImagesChangeRef` で親からのコールバックをrefに保持
   - useEffectの依存配列から `onImagesChange` を除外

3. `PreviewPage.tsx` — useCallbackの依存配列修正

**Zustand使う人向けの教訓:**
- `useMangaStore()` を引数なしで呼ぶと全ステート変更で再レンダリングされる
- アクション（関数）も `(s) => s.someAction` の形で個別取得すべき
- 子コンポーネントに渡すコールバックは必ず `useCallback` でラップする
- useEffect内で使うコールバックは `useRef` パターンを検討する

### バグ修正②: OpenAI API 403エラー

修正後の起動で「Request failed with status code 403」が発生。

**調査プロセス:**

1. APIキーの有効性テスト → 200 OK（キー自体は有効）
2. モデル個別テスト:
   - `gpt-4o` → **403**（プロジェクトにアクセス権なし）
   - `gpt-4o-mini` → 200 OK
   - `dall-e-3` → **403**
3. エラーメッセージ: `"Project proj_7uVoQ... does not have access to model gpt-4o"`

**根本原因:** OpenAI APIのプロジェクトレベルで「Allowed models」が制限されていて、dall-e-3とgpt-4oが許可リストに入っていなかった。

**解決:** Claude in Chromeを使ってOpenAIダッシュボード（platform.openai.com）のProject limits設定画面にアクセスし、dall-e-3とgpt-4oのチェックボックスを有効化。

**OpenAI APIを使う人向けの教訓:**
- APIキーが有効でも、プロジェクト単位でモデルアクセスが制限される場合がある
- 403エラーが出たらまずモデル単位でテストする
- 設定変更後、反映に10秒程度のラグがある（特にdall-e-3）
- バックエンドでOpenAIエラーをラップしている場合、本来の403がアプリの403と区別しにくくなる

### バグ修正③: 認証ミドルウェアの403

OpenAIモデルを有効化した後もフロントエンドで403が継続。

**調査:** バックエンド全コードでgrepし、403を返す箇所が `auth.ts` の認証ミドルウェアのみであることを特定。OpenAIの403はサービス層で `OpenAIError`（502）に変換されるため、クライアントに403が届くのは認証ミドルウェアからしかあり得ない。

**解決:** サーバー再起動で.env変更が反映され、`NODE_ENV=development` + `API_KEYS=空` の条件で認証スキップが正常動作。

---

## 成果サマリー

### 2日間で達成したこと

- v1.0 MVP完成（バックエンド5サービス + フロントエンド2ページ + 14 APIエンドポイント）
- テストカバレッジ: Backend 9 suites/45 tests + Frontend 3 suites/22 tests
- Docker + CI/CD パイプライン
- React無限ループバグの根本修正
- OpenAI APIプロジェクト設定の問題解決
- 全20+コミット、2 PR merged

### 開発ワークフローの知見

**マルチエージェント開発の所感:**

- KAMUI-4Dの並列実行は、独立性の高いタスク（バックエンド各サービス、フロントエンド各コンポーネント）には非常に効果的
- ただし、エージェント間の整合性（インターフェース不一致、import漏れ等）は人間のレビューが必須
- Claude Codeの逐次実行は、相互依存のあるタスク（Zustand + 既存ページ接続）に向いている
- 「設計はClaudeと対話 → 実装はエージェントに委任 → レビューは人間+Codex」の分担が効率的だった

---

## 技術的な詳細メモ

### ファイル変更一覧（Day 2）

| ファイル | 変更内容 |
|----------|----------|
| `frontend/src/hooks/useMangaGeneration.ts` | 完全リライト（無限ループ修正） |
| `frontend/src/components/ImageUploader.tsx` | useRefパターン導入 |
| `frontend/src/pages/PreviewPage.tsx` | useCallback依存配列修正 |
| `.env` | VISION_MODEL, PROMPT_MODEL追加 |
| `backend/src/config/constants.ts` | PORT/BASE_URLデフォルト修正 |

### 使用したAIモデル

| 用途 | モデル | 備考 |
|------|--------|------|
| 画像分析 | gpt-4o-mini | コスト削減のためmini採用 |
| プロンプト生成 | gpt-4o-mini | 同上 |
| 画像生成 | dall-e-3 | プロジェクトで有効化後に利用可能に |

---

*このドキュメントは2026年2月14日の開発セッション終了時にまとめたものです。Note記事化する際の素材として使用できます。*
