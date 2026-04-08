import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

function maskKey(value: string): string {
  if (!value) {
    return '未設定';
  }
  if (value.length <= 8) {
    return '登録済み';
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        configured
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
      }`}
    >
      {configured ? '✓ 設定済み' : '未設定'}
    </span>
  );
}

function SummaryItem({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-200">
      <span>{label}</span>
      <StatusBadge configured={configured} />
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const desktopAPI = window.desktopAPI;
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [exportDirectory, setExportDirectory] = useState('');
  const [currentOpenAI, setCurrentOpenAI] = useState('');
  const [currentGemini, setCurrentGemini] = useState('');
  const [currentExportDirectory, setCurrentExportDirectory] = useState('');
  const [effectiveExportDirectory, setEffectiveExportDirectory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isDesktop = Boolean(desktopAPI);

  useEffect(() => {
    if (!desktopAPI) {
      setLoading(false);
      return;
    }

    void Promise.all([desktopAPI.getApiConfig(), desktopAPI.getApiConfigStatus()])
      .then(([config, status]) => {
        setCurrentOpenAI(config.openaiApiKey);
        setCurrentGemini(config.geminiApiKey);
        setCurrentExportDirectory(config.exportDirectory);
        setEffectiveExportDirectory(status.effectiveExportDirectory);
      })
      .finally(() => setLoading(false));
  }, [desktopAPI]);

  const hasOpenAI = Boolean(currentOpenAI);
  const hasGemini = Boolean(currentGemini);
  const hasCustomExportDirectory = Boolean(currentExportDirectory);
  const nextOpenAI = openaiApiKey.trim();
  const nextGemini = geminiApiKey.trim();
  const nextExportDirectory = exportDirectory.trim();
  const hasOpenAIChange = Boolean(nextOpenAI && nextOpenAI !== currentOpenAI);
  const hasGeminiChange = Boolean(nextGemini && nextGemini !== currentGemini);
  const hasExportDirectoryChange = Boolean(
    nextExportDirectory && nextExportDirectory !== currentExportDirectory
  );
  const canSave = useMemo(
    () => hasOpenAIChange || hasGeminiChange || hasExportDirectoryChange,
    [hasExportDirectoryChange, hasGeminiChange, hasOpenAIChange]
  );

  const handleChooseExportDirectory = async () => {
    if (!desktopAPI) {
      return;
    }

    try {
      const selected = await desktopAPI.chooseExportDirectory();
      if (selected) {
        setExportDirectory(selected);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存先フォルダを選択できませんでした');
    }
  };

  const handleSave = async () => {
    if (!desktopAPI) {
      return;
    }

    setSaving(true);
    try {
      const result = await desktopAPI.saveApiConfig({
        openaiApiKey: openaiApiKey.trim() || currentOpenAI,
        geminiApiKey: geminiApiKey.trim() || currentGemini,
        exportDirectory: exportDirectory.trim() || currentExportDirectory,
      });
      setCurrentOpenAI(result.openaiApiKey);
      setCurrentGemini(result.geminiApiKey);
      setCurrentExportDirectory(result.exportDirectory);
      setEffectiveExportDirectory(result.status.effectiveExportDirectory);
      setOpenaiApiKey('');
      setGeminiApiKey('');
      setExportDirectory('');

      if (result.status.missing.length > 0) {
        toast.error(`未設定: ${result.status.missing.join(', ')}`);
        return;
      }

      toast.success('設定を保存し、バックエンドを再起動しました');
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900">API設定</h2>
        <p className="mt-2 text-sm text-gray-600">
          OpenAI と Gemini の API Key をこのMac内に保存します。保存後はアプリ内バックエンドを再起動します。
        </p>
        {!loading && (
          <div className="mt-4 flex flex-wrap gap-3">
            <SummaryItem label="OpenAI" configured={hasOpenAI} />
            <SummaryItem label="Gemini" configured={hasGemini} />
            <SummaryItem label="原稿保存先" configured={hasCustomExportDirectory} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        {!isDesktop && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ブラウザ表示では保存できません。デスクトップ版の Koma Fill から開いてください。
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-gray-800">OpenAI API Key</label>
                <StatusBadge configured={hasOpenAI} />
              </div>
              <input
                type="password"
                value={openaiApiKey}
                onChange={(event) => setOpenaiApiKey(event.target.value)}
                placeholder="sk-..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">
                現在: {maskKey(currentOpenAI)}
                {hasOpenAI && ' / 空欄のままなら現在のキーを維持します'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-gray-800">Gemini API Key</label>
                <StatusBadge configured={hasGemini} />
              </div>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(event) => setGeminiApiKey(event.target.value)}
                placeholder="AIza..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">
                現在: {maskKey(currentGemini)}
                {hasGemini && ' / 空欄のままなら現在のキーを維持します'}
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              保存されているキーは上に表示されます。更新したい項目だけ入力してください。未入力の項目は上書きされません。
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">漫画原稿の保存先</p>
                  <p className="mt-1 text-xs text-gray-500">
                    エクスポートした PNG / JPG / PDF を保存するフォルダです。
                  </p>
                </div>
                <StatusBadge configured={hasCustomExportDirectory} />
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium text-gray-900">現在の保存先</p>
                <p className="mt-1 break-all">
                  {effectiveExportDirectory || '未設定'}
                </p>
                {!hasCustomExportDirectory && (
                  <p className="mt-2 text-xs text-gray-500">
                    まだ明示設定はありません。現在はデフォルト保存先を使用します。
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleChooseExportDirectory}
                  disabled={!isDesktop || saving}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  保存先フォルダを選ぶ
                </button>
                {nextExportDirectory && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    次回保存先: {nextExportDirectory}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDesktop || !canSave || saving}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving ? '保存中...' : '保存して再起動'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                戻る
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
