# KAMUI-4D Bug Fix & Improvement Prompts for koma-fill
## Post-Implementation Review — Multi-Agent Fix Guide

**Version:** 1.1 (Post-Review Fix)
**Project:** koma-fill - AI-powered manga panel generation system
**Target:** KAMUI-4D Editor (Multi-AI CLI parallel execution)
**Author:** Code Review by Claude (2026-02-13)

---

## Overview

コードレビューで発見された **バグ3件 + セキュリティ問題1件 + 改善4件** を修正するための並列タスクプロンプト集です。

### Issue Summary

| # | 種別 | 重要度 | 内容 | Task |
|---|------|--------|------|------|
| 1 | Bug | 🔴 High | ImageUploader の useEffect がプレビュー画像を破壊 | Task 2 |
| 2 | Bug | 🔴 High | 吹き出しテキストの日本語折り返しが機能しない | Task 1 |
| 3 | Bug | 🟡 Medium | 吹き出しSVGビューポートサイズ不足 | Task 1 |
| 4 | Security | 🔴 High | エクスポートレスポンスにサーバー絶対パス露出 | Task 1 |
| 5 | Cleanup | 🟢 Low | exportService.ts に未使用 import | Task 1 |
| 6 | Cleanup | 🟢 Low | winston 未使用なのに依存に含まれている | Task 1 |
| 7 | Improvement | 🟡 Medium | @dnd-kit/utilities が package.json に未明示 | Task 2 |
| 8 | Improvement | 🟡 Medium | CORS origin を環境変数化 | Task 1 |

---

## Execution Strategy

```
Task 1 (Backend)  — Agent A — バックエンド修正全般（#2,#3,#4,#5,#6,#8）
Task 2 (Frontend) — Agent B — フロントエンド修正全般（#1,#7）
Task 3 (Verify)   — Agent C — ビルド検証 & 動作テスト（Task 1,2 完了後に実行）
```

**並列実行:** Task 1 と Task 2 は同時開始可能。Task 3 は両方の完了後に実行。

```
Timeline:
  ┌──────────────────────┐
  │ Task 1 (Backend)     │ 20-30 min
  │ Agent A              │
  └──────────┬───────────┘
             │              ┌──────────────────┐
             ├──────────────│ Task 3 (Verify)  │ 10-15 min
             │              │ Agent C          │
  ┌──────────┴───────────┐  └──────────────────┘
  │ Task 2 (Frontend)    │ 10-15 min
  │ Agent B              │
  └──────────────────────┘
```

---

## Task 1: バックエンド修正 (Agent A)
### LayoutEngine / Security / Cleanup

**Time Estimate:** 20-30 minutes
**Difficulty:** Intermediate
**Dependencies:** None

### Objective
レイアウトエンジンの吹き出し処理バグ修正、セキュリティ問題の解消、未使用コードのクリーンアップ、CORS設定の改善を行う。

### Target Files

```
backend/src/
├── services/
│   ├── layoutEngine.ts          [MODIFY] 吹き出しバグ修正 (#2, #3)
│   └── exportService.ts         [MODIFY] 未使用import削除 (#5)
├── routes/
│   └── manga.ts                 [MODIFY] ファイルパス露出修正 (#4)
├── app.ts                       [MODIFY] CORS環境変数化 (#8)
└── config/
    └── constants.ts             [MODIFY] ALLOWED_ORIGINS追加 (#8)
backend/package.json             [MODIFY] winston削除 (#6)
```

---

### Fix #2: 吹き出しテキストの日本語折り返し

**File:** `backend/src/services/layoutEngine.ts`
**Lines:** 299-313
**Problem:** `bubble.text.split(' ')` は空白で単語分割しているが、日本語テキストにはスペースがないため、テキスト全体が1行として扱われ、吹き出しからはみ出す。

**Current Code (問題あり):**
```typescript
// テキストを複数行に分割（簡易版）
const words = bubble.text.split(' ');
const lines: string[] = [];
let currentLine = '';
const maxCharsPerLine = 30;

for (const word of words) {
  if ((currentLine + word).length > maxCharsPerLine) {
    if (currentLine) lines.push(currentLine.trim());
    currentLine = word + ' ';
  } else {
    currentLine += word + ' ';
  }
}
if (currentLine) lines.push(currentLine.trim());
```

**Fix: 文字数ベースの折り返しに変更（日本語・英語両対応）**
```typescript
// テキストを複数行に分割（日本語対応: 文字数ベース折り返し）
const maxCharsPerLine = 15; // 日本語は全角なので少なめに
const lines: string[] = [];

// まずスペースで分割を試み、できなければ文字数で折り返す
const hasSpaces = bubble.text.includes(' ');

if (hasSpaces) {
  // 英語テキスト: スペース区切り
  const words = bubble.text.split(' ');
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + word).length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine) lines.push(currentLine.trim());
} else {
  // 日本語テキスト: 文字数で折り返し
  const text = bubble.text;
  for (let i = 0; i < text.length; i += maxCharsPerLine) {
    lines.push(text.slice(i, i + maxCharsPerLine));
  }
}
```

**Adjustment:** テキスト行数に基づいて `bubbleHeight` を動的に計算する。
現在 `const bubbleHeight = 60;` (265行目) を以下に変更:

```typescript
// bubbleHeight を行数に応じて動的計算（テキスト分割ロジックの後に移動）
const lineHeight = 20;
const verticalPadding = 20;
const bubbleHeight = Math.max(50, lines.length * lineHeight + verticalPadding);
```

**注意:** `bubbleHeight` の計算をテキスト分割ロジックの**後**に移動する必要がある。
具体的には、`generateSpeechBubbleSvg` メソッド内の処理順序を:
1. テキスト分割（lines計算）
2. bubbleHeight計算
3. bubbleX/targetY計算
4. shapePath生成
5. textElements生成
の順に再構成すること。

---

### Fix #3: 吹き出しSVGビューポートサイズ

**File:** `backend/src/services/layoutEngine.ts`
**Line:** 320
**Problem:** SVGの `width`/`height` が個別パネルの座標基準で計算されており、ページ全体サイズより小さくなる。`sharp.composite()` で合成する際にクリッピングが起こる可能性がある。

**Current Code (問題あり):**
```typescript
const svg = `<svg width="${panelPos.width + panelPos.x}" height="${panelPos.height + panelPos.y}" xmlns="http://www.w3.org/2000/svg">
```

**Fix: addSpeechBubbles メソッドからレイアウト全体サイズを渡す**

Step 1: `generateSpeechBubbleSvg` のシグネチャを変更:
```typescript
private generateSpeechBubbleSvg(
  bubble: SpeechBubble,
  panelPos: PanelPosition,
  targetY: number,
  layoutWidth: number,   // ← 追加
  layoutHeight: number   // ← 追加
): Buffer {
```

Step 2: SVGビューポートをレイアウト全体サイズに変更:
```typescript
const svg = `<svg width="${layoutWidth}" height="${layoutHeight}" xmlns="http://www.w3.org/2000/svg">
```

Step 3: `addSpeechBubbles` メソッド内の呼び出しを更新 (122行目付近):
```typescript
const bubbleSvg = this.generateSpeechBubbleSvg(
  bubble,
  panelPos,
  targetY,
  layout.width,    // ← 追加
  layout.height    // ← 追加
);
```

---

### Fix #4: エクスポートレスポンスのファイルパス露出

**File:** `backend/src/routes/manga.ts`
**Lines:** 664-673
**Problem:** レスポンスに `filePath: filePath` でサーバーの絶対パス（例: `/app/uploads/xxx/panel.png`）がクライアントに返されている。ディレクトリ構造の露出はセキュリティリスク。

**Current Code (問題あり):**
```typescript
res.json({
  message: 'Export successful',
  projectId,
  format: exportFormat,
  downloadUrl: `/uploads/${projectId}/${path.basename(filePath)}`,
  filePath: filePath,         // ← 絶対パスが露出
  fileSize: result.fileSize,
});
```

**Fix:**
```typescript
res.json({
  message: 'Export successful',
  projectId,
  format: exportFormat,
  downloadUrl: `/uploads/${projectId}/${path.basename(filePath)}`,
  fileSize: result.fileSize,
});
```

`filePath` フィールドを削除するだけでOK。クライアントは `downloadUrl` を使ってアクセスする。

---

### Fix #5: exportService.ts の未使用 import

**File:** `backend/src/services/exportService.ts`
**Line:** 16

**Current Code:**
```typescript
import { Readable } from 'stream';
```

**Fix:** この行を削除する。`Readable` はファイル内のどこでも使用されていない。

---

### Fix #6: 未使用 winston パッケージの削除

**File:** `backend/package.json`

**Action:**
```bash
cd backend
npm uninstall winston
```

`winston` はコード内で一切 import されていない。全てのログは `console.log` / `console.error` で行われている。

**Note:** 将来的にStructured Loggingを導入する場合は、その時点で `pino` や `winston` を再導入すること。現段階では不要な依存を除去する。

---

### Fix #8: CORS origin を環境変数化

**File:** `backend/src/config/constants.ts`

**変更:** CONFIG オブジェクトに `ALLOWED_ORIGINS` を追加:
```typescript
export const CONFIG = {
  // Server
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'],

  // ... 残りは変更なし
```

**File:** `backend/src/app.ts`

**Current Code:**
```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',')
    : ['http://localhost:3000'],
}));
```

**Fix:**
```typescript
import { CONFIG } from './config/constants';

// ... (既存のimportの後に追加、重複に注意)

app.use(cors({
  origin: CONFIG.NODE_ENV === 'production'
    ? CONFIG.ALLOWED_ORIGINS
    : CONFIG.ALLOWED_ORIGINS,
}));
```

**注意:** `app.ts` の先頭で `CONFIG` が既にインポートされていない場合のみ import を追加すること。現在の `app.ts` は `config/constants` を import していないため、追加が必要。

---

### Verification (Task 1)

修正完了後、以下を実行して確認:

```bash
cd backend

# TypeScript コンパイルチェック
npx tsc --noEmit

# 依存パッケージの整合性確認
npm ls --depth=0

# ビルド
npm run build
```

**Expected:** エラーなし、ワーニングなし。

---

## Task 2: フロントエンド修正 (Agent B)
### ImageUploader Bug Fix & Dependency Cleanup

**Time Estimate:** 10-15 minutes
**Difficulty:** Easy
**Dependencies:** None

### Objective
ImageUploader コンポーネントのメモリリークバグ修正と、`package.json` への明示的な依存追加を行う。

### Target Files

```
frontend/
├── src/
│   └── components/
│       └── ImageUploader.tsx    [MODIFY] useEffect修正 (#1)
└── package.json                 [MODIFY] @dnd-kit/utilities追加 (#7)
```

---

### Fix #1: ImageUploader の useEffect クリーンアップバグ

**File:** `frontend/src/components/ImageUploader.tsx`
**Lines:** 25-29
**Problem:** `useEffect` のクリーンアップ関数が `images` を依存配列に含んでいるため、画像が追加・削除されるたびに **前の状態の全画像の ObjectURL が revoke される**。これにより、残っているはずのプレビュー画像が表示されなくなる。

**Current Code (問題あり):**
```typescript
useEffect(() => {
  return () => {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  };
}, [images]);
```

**問題の詳細:**
1. ユーザーが画像Aをアップロード → `images = [A]`
2. ユーザーが画像Bをアップロード → `images` が変更されるため、前の effect のクリーンアップが実行される
3. クリーンアップ内で `images.forEach(URL.revokeObjectURL)` が呼ばれ、画像AのURLが revoke される
4. 結果: 画像Aのプレビューが壊れる（画像Bは新しいURLなのでまだ表示される）

**Fix: コンポーネントのアンマウント時のみ revoke する + 個別削除時に revoke する**

```typescript
// アンマウント時のみ全URLを解放（依存配列を空に）
useEffect(() => {
  return () => {
    // コンポーネント破棄時に残っているURLを全て解放
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run only on unmount
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**追加確認:** `removeImage` 関数（73-81行目）は既に個別の画像削除時に `URL.revokeObjectURL` を呼んでいるため、こちらは問題なし。

**重要:** `eslint-disable` コメントが必要な理由:
- React の `react-hooks/exhaustive-deps` ルールは `images` を依存に含めるよう警告する
- しかし意図的に「アンマウント時のみ実行」したいため、空の依存配列が正しい
- `images` は `useRef` で最新値を追跡するパターンもあるが、このケースでは `removeImage` が個別に revoke しているため、アンマウント時の cleanup は「残っているもの全て」で十分

**Alternative Fix（より堅牢）:**
`useRef` を使って最新の `images` を追跡する方法:

```typescript
const imagesRef = useRef<UploadedImage[]>([]);

// imagesが変わるたびにrefを更新
useEffect(() => {
  imagesRef.current = images;
}, [images]);

// アンマウント時のみ全URLを解放
useEffect(() => {
  return () => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  };
}, []);
```

**推奨:** Alternative Fix（useRef版）の方が ESLint ルール違反なしでクリーンに実装できる。どちらを選んでも動作は同じ。

---

### Fix #7: @dnd-kit/utilities を package.json に明示追加

**File:** `frontend/package.json`

**Action:**
```bash
cd frontend
npm install @dnd-kit/utilities
```

**Reason:** `PanelGrid.tsx` が `@dnd-kit/utilities` から `CSS` をインポートしているが、`package.json` に明示的な依存として記載されていない。`@dnd-kit/sortable` の transitive dependency として間接的にインストールされているだけのため、パッケージのバージョンアップ時に breakする可能性がある。

---

### Verification (Task 2)

修正完了後、以下を実行して確認:

```bash
cd frontend

# TypeScript 型チェック
npx tsc --noEmit

# ビルド
npm run build

# package.json の依存確認
npm ls @dnd-kit/utilities
```

**Expected:** エラーなし。`dist/` が正常に生成される。

---

## Task 3: 統合検証 (Agent C)
### Build Verification & Integration Test

**Time Estimate:** 10-15 minutes
**Difficulty:** Easy
**Dependencies:** Task 1 と Task 2 の両方が完了後に実行

### Objective
Task 1, 2 の修正が正しく統合されていることを確認する。TypeScript のコンパイル、ビルド成功、サーバー起動テストを行う。

### Verification Checklist

#### Step 1: Backend ビルド確認

```bash
cd backend

# 依存の再インストール（winstonが削除されているため）
npm install

# TypeScript コンパイルチェック
npx tsc --noEmit
echo "Backend type check: $?"

# ビルド
npm run build
echo "Backend build: $?"

# ビルド成果物の存在確認
ls -la dist/services/layoutEngine.js
ls -la dist/services/exportService.js
ls -la dist/routes/manga.js
ls -la dist/app.js
```

**Expected:**
- 全コマンドが exit code 0
- `dist/` 配下に `.js` と `.d.ts` ファイルが生成される
- `dist/services/exportService.js` に `Readable` の import がないこと

#### Step 2: Frontend ビルド確認

```bash
cd frontend

# 依存の再インストール（@dnd-kit/utilitiesが追加されているため）
npm install

# TypeScript コンパイルチェック
npx tsc --noEmit
echo "Frontend type check: $?"

# Vite ビルド
npm run build
echo "Frontend build: $?"

# ビルド成果物の確認
ls -la dist/
ls -la dist/assets/
```

**Expected:**
- 全コマンドが exit code 0
- `dist/index.html` と `dist/assets/` 配下に JS/CSS が生成される

#### Step 3: サーバー起動テスト

```bash
cd backend

# サーバーを起動（5秒後に自動終了）
timeout 5 node dist/index.js 2>&1 || true

# ヘルスチェック（サーバーが別プロセスで起動中の場合）
# curl -s http://localhost:5000/api/health | head -1
```

**Expected:**
- `koma-fill server running on http://localhost:5000` のログが出力される
- DB initialized のログが出力される
- 起動時にクラッシュしない

#### Step 4: 修正内容の確認（grep チェック）

```bash
# Fix #4: filePath が export レスポンスから削除されていること
grep -n "filePath:" backend/src/routes/manga.ts | grep -v "downloadUrl\|layoutPath\|imageFilePath\|const filePath\|file_path\|\.filePath"

# Fix #5: Readable が exportService からimportされていないこと
grep -n "Readable" backend/src/services/exportService.ts

# Fix #6: winston が package.json から削除されていること
grep -n "winston" backend/package.json

# Fix #7: @dnd-kit/utilities が frontend/package.json に含まれていること
grep -n "dnd-kit/utilities" frontend/package.json

# Fix #8: CONFIG.ALLOWED_ORIGINS が使用されていること
grep -n "ALLOWED_ORIGINS" backend/src/config/constants.ts
grep -n "ALLOWED_ORIGINS\|CONFIG" backend/src/app.ts
```

**Expected:**
- Fix #4: export レスポンスに `filePath` フィールドがない
- Fix #5: `Readable` の import がない
- Fix #6: `winston` がない
- Fix #7: `@dnd-kit/utilities` がある
- Fix #8: `ALLOWED_ORIGINS` が constants.ts と app.ts の両方にある

#### Step 5: LayoutEngine テキスト分割の手動確認

```bash
# layoutEngine.ts の吹き出しテキスト分割ロジックを確認
grep -A 20 "日本語" backend/src/services/layoutEngine.ts
# または
grep -A 20 "maxCharsPerLine" backend/src/services/layoutEngine.ts
```

**Expected:** 文字数ベースの折り返しロジックが存在する。`.split(' ')` のみに依存していない。

---

### Final Report

全ステップが完了したら、以下の形式で結果を報告:

```
## Fix Verification Report

| # | Fix | Status | Notes |
|---|-----|--------|-------|
| 1 | ImageUploader useEffect | ✅/❌ | |
| 2 | 吹き出し日本語折り返し | ✅/❌ | |
| 3 | SVGビューポートサイズ | ✅/❌ | |
| 4 | ファイルパス露出除去 | ✅/❌ | |
| 5 | 未使用Readable import | ✅/❌ | |
| 6 | winston削除 | ✅/❌ | |
| 7 | @dnd-kit/utilities追加 | ✅/❌ | |
| 8 | CORS環境変数化 | ✅/❌ | |

Backend build: ✅/❌
Frontend build: ✅/❌
Server startup: ✅/❌
```

---

## Appendix: 将来的な改善候補（今回のスコープ外）

以下は今回の修正対象外だが、次フェーズで対応すべき項目:

1. **認証ミドルウェアの実装** — ARCHITECTURE.md に記載の Bearer 認証
2. **winston / pino によるStructured Logging** — 本番環境向け
3. **CONTEXT.md の更新** — 実装完了ステータスの反映
4. **API_SPEC.md の更新** — 実装に合わせた仕様書のリビジョン
5. **テストの追加** — jest による各サービスの単体テスト
6. **`generation_log` テーブルの実装** — API呼び出し監視・課金管理用
7. **キャンセル機能** — 画像生成中のユーザーキャンセル対応
8. **パネル削除API** — PreviewPage で `handleDelete` が未実装通知を出している
