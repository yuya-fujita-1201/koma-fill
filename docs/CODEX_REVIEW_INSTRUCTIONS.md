# Codex コードレビュー指示書

## 目的

`docs/CLAUDE_CODE_FINAL_FIXES.md` に記載された4件の修正が正しく適用されたかレビューする。

---

## レビュー手順

### 1. コミット履歴確認

```bash
git log --oneline -6
```

以下の4コミットが新しい順に存在すること:
- `docs: README のエンドポイント説明を正確化`
- `docs: PROGRESS_LOG のテスト結果記載を実態に合わせて修正`
- `fix: Production SPA フォールバックから /api パスを除外`
- `fix: vitest include 設定を追加してバックエンドテストの誤検出を防止`

### 2. Fix 1 検証: vitest include

```bash
grep -A 5 'test:' frontend/vite.config.ts
```

確認ポイント:
- `include: ['src/**/*.{test,spec}.{ts,tsx}']` が存在すること
- `globals: true`, `environment: 'jsdom'`, `setupFiles` も維持されていること

**テスト実行**:
```bash
cd frontend && npx vitest run
```
- 3 suites, 22 tests が全パスすること

### 3. Fix 2 検証: SPA フォールバック

```bash
grep -A 5 'production' backend/src/app.ts
```

確認ポイント:
- `app.get('*', ...)` ではなく正規表現 `/^(?!\/api\/).*$/` でルーティングされていること
- `/api/` で始まるパスがフォールバック対象から除外されること
- `express.static` は変更なし
- errorHandler ミドルウェアがこのブロックの後にあること

### 4. Fix 3 検証: PROGRESS_LOG

```bash
head -10 docs/PROGRESS_LOG.md
```

確認ポイント:
- backend テスト結果が `6/9 suites パス` と記載されていること
- `better-sqlite3 ネイティブバイナリ環境依存` の注記があること
- `44 passed` という不正確な数値が残っていないこと

### 5. Fix 4 検証: README

```bash
grep -n 'エンドポイント' README.md
```

確認ポイント:
- 「すべてのエンドポイントは `/api/manga` 配下です」が削除されていること
- `/api/health` が `/api/manga` 配下ではないことが明記されていること

### 6. 統合テスト

```bash
# TypeScript コンパイル
cd backend && npx tsc --noEmit && echo "Backend tsc: OK"
cd ../frontend && npx tsc --noEmit && echo "Frontend tsc: OK"

# テスト
cd ../backend && npm test 2>&1 | tail -3
cd ../frontend && npx vitest run 2>&1 | tail -3

# Lint
cd .. && npm run lint 2>&1 | tail -3
```

全項目がエラーなしで通ること。

### 7. 判定

全チェック項目がパスしたら、以下をコミット:

```bash
git add -A && git commit -m "chore: Codex レビュー完了 - 全修正確認済み"
```

問題が見つかった場合は、その場で修正してからコミット。修正内容をコミットメッセージに記載すること。
