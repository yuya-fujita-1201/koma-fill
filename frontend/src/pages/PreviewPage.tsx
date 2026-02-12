/**
 * PreviewPage - 生成結果プレビュー＆エクスポートページ
 *
 * 担当: Agent E
 *
 * 機能:
 * - 生成されたパネルのグリッド表示
 * - 個別パネルの再生成
 * - ドラッグ＆ドロップで並び替え
 * - レイアウト合成プレビュー
 * - エクスポート (PNG/JPG/PDF)
 */

// import { useParams } from 'react-router-dom';
// import PanelGrid from '../components/PanelGrid';
// import ExportOptions from '../components/ExportOptions';

export default function PreviewPage() {
  // const { projectId } = useParams<{ projectId: string }>();

  // TODO: [Agent E] プロジェクトデータの取得
  // TODO: [Agent E] パネル再生成ハンドラー
  // TODO: [Agent E] ドラッグ&ドロップ並び替えハンドラー
  // TODO: [Agent E] レイアウト合成プレビュー
  // TODO: [Agent E] エクスポート機能

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">プレビュー</h2>

      {/* パネルグリッド */}
      <section>
        {/* TODO: <PanelGrid /> */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-400">
          PanelGrid コンポーネント（未実装）
        </div>
      </section>

      {/* コントロールパネル */}
      <section className="flex gap-4">
        <button className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
          失敗パネルを再生成
        </button>
        <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          レイアウトをプレビュー
        </button>
      </section>

      {/* エクスポート */}
      <section>
        <h3 className="text-lg font-semibold mb-4">エクスポート</h3>
        {/* TODO: <ExportOptions /> */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
          ExportOptions コンポーネント（未実装）
        </div>
      </section>
    </div>
  );
}
