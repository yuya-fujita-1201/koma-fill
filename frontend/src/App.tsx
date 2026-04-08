import { useEffect, type CSSProperties } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import CreateMangaPage from './pages/CreateMangaPage';
import PreviewPage from './pages/PreviewPage';
import SettingsPage from './pages/SettingsPage';

function AppShell() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.desktopAPI) {
      return;
    }

    return window.desktopAPI.onOpenSettings(() => {
      navigate('/settings');
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="border-b bg-white shadow-sm"
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            コマフィル
            <span className="text-sm font-normal text-gray-500 ml-2">
              漫画コマ補填ツール
            </span>
          </h1>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            API設定
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<CreateMangaPage />} />
          <Route path="/preview/:projectId" element={<PreviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

/**
 * koma-fill メインアプリケーション
 *
 * ルーティング:
 * - / : 漫画作成ページ（メインワークフロー）
 * - /preview/:projectId : プレビュー＆エクスポートページ
 */
function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
