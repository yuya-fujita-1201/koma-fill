import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import CreateMangaPage from './pages/CreateMangaPage';
import PreviewPage from './pages/PreviewPage';

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
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                コマフィル
                <span className="text-sm font-normal text-gray-500 ml-2">
                  漫画コマ補填ツール
                </span>
              </h1>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<CreateMangaPage />} />
              <Route path="/preview/:projectId" element={<PreviewPage />} />
            </Routes>
          </main>

          <Toaster position="bottom-right" />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
