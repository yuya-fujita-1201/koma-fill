/**
 * ImageUploader - キー画像アップロードコンポーネント
 *
 * 担当: Agent E
 *
 * Props:
 * - onImagesChange: (images: UploadedImage[]) => void
 * - maxImages: number (default: 2)
 *
 * 機能:
 * - ドラッグ&ドロップでアップロード
 * - クリックでファイル選択
 * - 各画像に position (start/end/number) を設定可能
 * - プレビュー表示
 * - 削除ボタン
 *
 * 使用ライブラリ: react-dropzone
 *
 * 実装ガイド:
 * 1. useDropzone() でドロップゾーンを設定
 * 2. accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] }
 * 3. maxFiles: maxImages
 * 4. onDrop で File → UploadedImage に変換
 * 5. URL.createObjectURL() でプレビュー生成
 * 6. position セレクターを各画像に表示
 */

import { UploadedImage } from '../types';

interface ImageUploaderProps {
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}

export default function ImageUploader({ onImagesChange, maxImages = 2 }: ImageUploaderProps) {
  // TODO: [Agent E] react-dropzone で実装
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center
                    hover:border-blue-400 transition-colors cursor-pointer">
      <p className="text-gray-500">
        ここに画像をドラッグ＆ドロップ、またはクリックしてファイルを選択
      </p>
      <p className="text-sm text-gray-400 mt-2">
        JPEG, PNG, WebP（最大{maxImages}枚、各20MBまで）
      </p>
    </div>
  );
}
