# Claude Code 最終修正タスク

## 概要

v1.0 MVP レビューで見つかった残存問題を修正する。全4件。
各修正後にコミット。最後に tsc + テスト + lint で整合性確認。

---

## 共通ルール

- 1修正 = 1コミット (Conventional Commits: `fix:`, `docs:`)
- TypeScript コンパイルエラーを出さないこと
- 既存テストを壊さないこと
- コミット後に `cd backend && npx tsc --noEmit` と `cd frontend && npx tsc --noEmit` を実行して確認

---

## Fix 1: Vitest の include 設定追加

**問題**: ルートディレクトリから `npx vitest run` を実行すると、backend の Jest テストファイルも拾ってしまい `jest is not defined` で 18 件失敗する。`frontend/vite.config.ts` の test 設定に `include` がないため。

**ファイル**: `frontend/vite.config.ts`

**修正**: `test` ブロックに `include` を追加して、frontend の src 配下のみに限定する:

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
},
```

**検証**:
```bash
cd frontend && npx vitest run
# → 3 passed (mangaStore, apiClient, useExport)
```

**コミット**: `fix: vitest include 設定を追加してバックエンドテストの誤検出を防止`

---

## Fix 2: Production SPA フォールバックの API パス除外

**問題**: `backend/src/app.ts` の本番用 SPA フォールバック (`app.get('*', ...)`) が `/api/*` パスも含めてキャッチしてしまう。本番環境で存在しない API エンドポイント (例: `GET /api/nonexistent`) にリクエストすると、JSON エラーではなく `index.html` が返される。

**ファイル**: `backend/src/app.ts`

**現在のコード** (問題あり):
```typescript
if (CONFIG.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'));
  });
}
```

**修正**: SPA フォールバックを `/api` 以外のパスに限定する:

```typescript
if (CONFIG.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  // SPA fallback: /api 以外のパスに限定
  app.get(/^(?!\/api\/).*$/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}
```

**重要**: この SPA フォールバックブロックは、`app.use(errorHandler)` の **前** にある位置のままで OK。`/api/*` パスはこの正規表現にマッチしないので、未定義 API パスは errorHandler まで到達して適切な 404 JSON レスポンスを返す。

**コミット**: `fix: Production SPA フォールバックから /api パスを除外`

---

## Fix 3: PROGRESS_LOG のテスト結果を正確な記載に修正

**問題**: `docs/PROGRESS_LOG.md` の行 8 に `(9 suites, 44 passed, 1 skipped)` とあるが、実際はバックエンドテストは `6 suites passed / 3 failed (better-sqlite3 環境依存), 36 passed, 1 skipped`。ローカルで repository テストが通る前提の数値だが、どの環境でも再現可能な正確な情報に修正すべき。

**ファイル**: `docs/PROGRESS_LOG.md`

**修正**: 行 8 を以下に変更:

```
- [x] `cd backend && npm test` が 6/9 suites パス (36 passed, 1 skipped, 3 suites は better-sqlite3 ネイティブバイナリ環境依存で CI/ローカル環境では通る)
```

**コミット**: `docs: PROGRESS_LOG のテスト結果記載を実態に合わせて修正`

---

## Fix 4: README.md エンドポイント説明の正確化

**問題**: `README.md` 行 61 に「すべてのエンドポイントは `/api/manga` 配下です。」とあるが、`/api/health` は `/api/manga` 配下ではなくルート直下。

**ファイル**: `README.md`

**修正**: 行 61 を以下に変更:

```
マンガ API は `/api/manga` 配下、ヘルスチェックは `/api/health` です。
```

**コミット**: `docs: README のエンドポイント説明を正確化`

---

## 最終検証 (Fix 4 の後に実行)

```bash
# TypeScript
cd backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit

# Backend テスト
cd ../backend && npm test

# Frontend テスト
cd ../frontend && npx vitest run

# Lint
cd .. && npm run lint
```

すべてパスしたら完了。問題があればその場で修正してコミット。

---

## 完了後

すべての修正とコミットが終わったら、以下のコマンドで最終状態を出力:

```bash
echo "=== Final Commit Log ==="
git log --oneline -10
echo ""
echo "=== Backend tsc ==="
cd backend && npx tsc --noEmit && echo "OK" || echo "FAIL"
echo ""
echo "=== Frontend tsc ==="
cd ../frontend && npx tsc --noEmit && echo "OK" || echo "FAIL"
echo ""
echo "=== Backend tests ==="
cd ../backend && npm test 2>&1 | tail -5
echo ""
echo "=== Frontend tests ==="
cd ../frontend && npx vitest run 2>&1 | tail -5
```
