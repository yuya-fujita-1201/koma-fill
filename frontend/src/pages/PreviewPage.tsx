import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import ExportOptions from '../components/ExportOptions';
import PanelGrid from '../components/PanelGrid';
import { deletePanel, deleteProject, getProject, regeneratePanel, reorderPanels } from '../services/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MangaLayoutViewer } from '../components/MangaLayoutViewer';
import { useExport } from '../hooks/useExport';
import { MangaProject } from '../types';

export default function PreviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<MangaProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [layoutPath, setLayoutPath] = useState<string | null>(null);
  const { composeLayout: composeLayoutAction, exportManga: exportMangaAction, exporting } = useExport();

  const loadProject = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setLoading(true);
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'プロジェクト取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const handleRegenerate = async (panelIndex: number) => {
    if (!projectId) {
      return;
    }

    try {
      await regeneratePanel(projectId, panelIndex);
      toast.success(`パネル ${panelIndex + 1} の再生成を開始しました`);
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'パネル再生成に失敗しました');
    }
  };

  const handleReorder = async (newOrder: number[]) => {
    if (!projectId) {
      return;
    }

    try {
      await reorderPanels(projectId, newOrder);
      toast.success('パネル順を更新しました');
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '並び替えに失敗しました');
    }
  };

  const handleDelete = async (panelIndex: number) => {
    if (!projectId) {
      return;
    }

    if (!window.confirm(`パネル ${panelIndex + 1} を削除しますか？`)) {
      return;
    }

    try {
      await deletePanel(projectId, panelIndex);
      toast.success(`パネル ${panelIndex + 1} を削除しました`);
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'パネル削除に失敗しました');
    }
  };

  const handleLayout = async () => {
    if (!projectId) {
      return;
    }

    try {
      const result = await composeLayoutAction(projectId);
      setLayoutPath(`${result.layoutPath}?t=${Date.now()}`);
      toast.success('レイアウトを更新しました');
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'レイアウト生成に失敗しました');
    }
  };

  const handleExport = async (options: {
    format: 'png' | 'jpg' | 'pdf';
    compression: 'low' | 'medium' | 'high';
    resolution: 'web' | 'print';
  }) => {
    if (!projectId) {
      return;
    }

    try {
      const result = await exportMangaAction(projectId, {
        format: options.format,
        compression: options.compression,
        resolution: options.resolution,
      });
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      toast.success('エクスポートが完了しました');
      await loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'エクスポートに失敗しました');
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-gray-500">読み込み中...</div>;
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">プロジェクトが見つかりません。</p>
        <button
          type="button"
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => navigate('/')}
        >
          作成ページへ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="text-sm text-gray-500">
            status: {project.status} / total cost: ${project.totalCost.toFixed(3)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => navigate('/')}
          >
            新規作成
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={async () => {
              if (!projectId) return;
              if (!window.confirm('このプロジェクトを削除しますか？この操作は取り消せません。')) return;
              try {
                await deleteProject(projectId);
                toast.success('プロジェクトを削除しました');
                navigate('/');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'プロジェクト削除に失敗しました');
              }
            }}
          >
            プロジェクト削除
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">パネル一覧</h3>
        <PanelGrid
          panels={project.panels}
          onRegenerate={handleRegenerate}
          onReorder={handleReorder}
          onDelete={handleDelete}
        />
      </section>

      <section className="flex gap-3">
        <button
          type="button"
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          onClick={() => {
            const failed = project.panels.filter((p) => p.status === 'failed');
            if (failed.length === 0) {
              toast('再生成対象の失敗パネルはありません', { icon: 'ℹ️' });
              return;
            }
            void Promise.all(failed.map((panel) => regeneratePanel(project.id, panel.panelIndex)))
              .then(() => {
                toast.success('失敗パネルの再生成を開始しました');
                return loadProject();
              })
              .catch((err) => {
                toast.error(err instanceof Error ? err.message : '再生成に失敗しました');
              });
          }}
        >
          失敗パネルを再生成
        </button>

        <button
          type="button"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          onClick={handleLayout}
        >
          レイアウトを生成
        </button>
      </section>

      {layoutPath && (
      <section className="space-y-2">
        <h3 className="text-lg font-semibold">レイアウトプレビュー</h3>
        <MangaLayoutViewer
          imageUrl={layoutPath}
          dimensions={
            project
              ? { width: project.layoutConfig.pageWidth, height: project.layoutConfig.pageHeight }
              : undefined
          }
        />
        {exporting && <LoadingSpinner size="sm" message="処理中..." />}
        </section>
      )}

      <section>
        <h3 className="text-lg font-semibold mb-4">エクスポート</h3>
        <ExportOptions onExport={handleExport} isExporting={exporting} />
      </section>
    </div>
  );
}
