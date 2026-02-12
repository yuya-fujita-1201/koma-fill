/**
 * PanelGrid - 生成パネルのグリッド表示コンポーネント
 *
 * 担当: Agent E
 *
 * Props:
 * - panels: Panel[]
 * - onRegenerate: (panelIndex: number) => void
 * - onReorder: (newOrder: number[]) => void
 * - onDelete: (panelIndex: number) => void
 *
 * 機能:
 * - パネルのグリッド表示
 * - ドラッグ&ドロップで並び替え (@dnd-kit/sortable)
 * - 各パネルに再生成/削除ボタン
 * - ステータス表示 (pending, generated, failed)
 * - 失敗パネルにはリトライボタン表示
 */

import { Panel } from '../types';

interface PanelGridProps {
  panels: Panel[];
  onRegenerate: (panelIndex: number) => void;
  onReorder: (newOrder: number[]) => void;
  onDelete: (panelIndex: number) => void;
}

export default function PanelGrid({
  panels,
  onRegenerate,
  onReorder,
  onDelete,
}: PanelGridProps) {
  // TODO: [Agent E] @dnd-kit/sortable でドラッグ&ドロップを実装
  // TODO: [Agent E] 各パネルカードの表示
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {panels.map((panel) => (
        <div
          key={panel.id}
          className="relative border rounded-lg overflow-hidden bg-white shadow-sm"
        >
          {/* パネル画像 */}
          {panel.imageUrl ? (
            <img
              src={panel.imageUrl}
              alt={`Panel ${panel.panelIndex + 1}`}
              className="w-full aspect-square object-cover"
            />
          ) : (
            <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400">
              {panel.status === 'pending' && '⏳ 待機中'}
              {panel.status === 'failed' && '❌ 失敗'}
              {panel.status === 'placeholder' && '📋 プレースホルダー'}
            </div>
          )}

          {/* パネルインデックス */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
            #{panel.panelIndex + 1}
          </div>

          {/* アクションボタン */}
          <div className="p-2 flex gap-2">
            <button
              onClick={() => onRegenerate(panel.panelIndex)}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              再生成
            </button>
            <button
              onClick={() => onDelete(panel.panelIndex)}
              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              削除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
