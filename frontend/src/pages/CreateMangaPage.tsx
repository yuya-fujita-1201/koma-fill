import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ImageUploader from '../components/ImageUploader';
import LayoutSelector from '../components/LayoutSelector';
import { MangaLayoutViewer } from '../components/MangaLayoutViewer';
import ProgressBar from '../components/ProgressBar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import StoryPromptEditor from '../components/StoryPromptEditor';
import { useMangaGeneration } from '../hooks/useMangaGeneration';
import { getLayoutTemplate, type Panel } from '../types';
import {
  RECOMMENDED_BUBBLE_LENGTH,
  RECOMMENDED_BUBBLES_PER_PANEL,
  getDraftCoverageSummary,
  getPanelFitSummary,
  getPanelDraftSummary,
} from '../utils/nameDraft';

type SidebarSectionKey = 'project' | 'images' | 'story' | 'template' | 'name';

function EmptyPagePreview({
  layoutTemplateId,
  storyPrompt,
  projectName,
  panelStatuses,
}: {
  layoutTemplateId: Parameters<typeof getLayoutTemplate>[0];
  storyPrompt: string;
  projectName: string;
  panelStatuses: Array<{ panelIndex: number; isReady: boolean; bubbleCount: number; fitRisk: 'safe' | 'watch' | 'tight' }>;
}) {
  const template = getLayoutTemplate(layoutTemplateId);
  const statusByPanelIndex = new Map(panelStatuses.map((status) => [status.panelIndex, status]));

  return (
    <div className="flex h-full items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,#f5f7fb_0%,#e9eef7_100%)] p-4 shadow-inner">
      <div
        className="mx-auto aspect-[210/297] h-full max-h-full w-auto max-w-full rounded-[22px] border border-gray-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
        aria-label={`${projectName.trim() || '新しい漫画ページ'} ${template.label} ${template.totalPanels}コマ ${storyPrompt.trim() ? 'ストーリー入力済み' : 'ストーリー未入力'}`}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[12px] bg-white">
          {template.preview.map((rect, index) => {
            const status = statusByPanelIndex.get(index);

            return (
            <div
              key={`${template.id}-${index}`}
              className="absolute overflow-hidden rounded-[6px] border-2 border-black bg-[repeating-linear-gradient(135deg,#f8fafc_0,#f8fafc_18px,#eef2f7_18px,#eef2f7_36px)]"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
              }}
            >
              <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                #{index + 1}
              </div>
              {status && (
                <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
                  <div className="rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold text-gray-700 shadow-sm">
                    {status.isReady ? `ネーム済み / ${status.bubbleCount}吹` : '未入力'}
                  </div>
                  {status.fitRisk !== 'safe' && status.isReady && (
                    <div
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm ${
                        status.fitRisk === 'tight'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {status.fitRisk === 'tight' ? '収まり要調整' : '収まり注意'}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SidebarSection({
  sectionKey,
  title,
  summary,
  openSections,
  setOpenSections,
  children,
}: {
  sectionKey: SidebarSectionKey;
  title: string;
  summary: string;
  openSections: Record<SidebarSectionKey, boolean>;
  setOpenSections: Dispatch<SetStateAction<Record<SidebarSectionKey, boolean>>>;
  children: ReactNode;
}) {
  const isOpen = openSections[sectionKey];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() =>
          setOpenSections((prev) => ({
            ...prev,
            [sectionKey]: !prev[sectionKey],
          }))
        }
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 truncate text-xs text-gray-500">{summary}</p>
        </div>
        <span className="shrink-0 rounded-full border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-500">
          {isOpen ? '閉じる' : '開く'}
        </span>
      </button>
      {isOpen && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </section>
  );
}

function NamePanelEditor({
  panel,
  templateRect,
  onSave,
}: {
  panel: Panel;
  templateRect?: ReturnType<typeof getLayoutTemplate>['preview'][number];
  onSave: (panelIndex: number, updates: Partial<Pick<Panel, 'prompt' | 'storyBeat' | 'speechBubbleText'>>) => Promise<void>;
}) {
  const [storyBeat, setStoryBeat] = useState(panel.storyBeat ?? '');
  const [speechBubbleText, setSpeechBubbleText] = useState(panel.speechBubbleText ?? '');
  const [prompt, setPrompt] = useState(panel.prompt ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStoryBeat(panel.storyBeat ?? '');
    setSpeechBubbleText(panel.speechBubbleText ?? '');
    setPrompt(panel.prompt ?? '');
  }, [panel.storyBeat, panel.speechBubbleText, panel.prompt]);

  const draftSummary = useMemo(() => getPanelDraftSummary({
    panelIndex: panel.panelIndex,
    storyBeat,
    speechBubbleText,
  }), [panel.panelIndex, speechBubbleText, storyBeat]);
  const fitSummary = useMemo(() => getPanelFitSummary({
    panelIndex: panel.panelIndex,
    storyBeat,
    speechBubbleText,
  }, templateRect), [panel.panelIndex, speechBubbleText, storyBeat, templateRect]);

  const isDirty = storyBeat !== (panel.storyBeat ?? '')
    || speechBubbleText !== (panel.speechBubbleText ?? '')
    || prompt !== (panel.prompt ?? '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(panel.panelIndex, { storyBeat, speechBubbleText, prompt });
      toast.success(`コマ ${panel.panelIndex + 1} のネームを保存しました`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ネーム保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">コマ {panel.panelIndex + 1}</p>
          <p className="mt-1 text-[11px] text-gray-500">
            ここで出来事とセリフを固めてから画像生成します。現在 {draftSummary.bubbleCount} 吹き出し / 最長 {draftSummary.longestBubbleLength} 文字。
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-white disabled:opacity-50"
          disabled={!isDirty || saving}
          onClick={handleSave}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">出来事</label>
          <textarea
            value={storyBeat}
            onChange={(e) => setStoryBeat(e.target.value)}
            className="h-20 w-full rounded-xl border border-gray-300 p-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">セリフ</label>
          <textarea
            value={speechBubbleText}
            onChange={(e) => setSpeechBubbleText(e.target.value)}
            className="h-24 w-full rounded-xl border border-gray-300 p-3 text-sm"
            placeholder="このコマのセリフやモノローグ。改行ごとに別吹き出し"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            1行ごとに別吹き出しとして配置します。`ナレーション:` は矩形、`（...）` は思考寄りとして扱います。
          </p>
          {draftSummary.longBubbleCount > 0 && (
            <p className="mt-2 text-[11px] text-amber-700">
              長い吹き出しがあります。読みやすさ優先なら改行して 2 吹き出しへ分ける方が安全です。
            </p>
          )}
          {draftSummary.hasNarration && draftSummary.bubbleCount > 1 && (
            <p className="mt-2 text-[11px] text-sky-700">
              ナレーションがあるコマです。自動配置ではナレーションを上、会話を中段以降へ逃がします。
            </p>
          )}
          {draftSummary.isDense && (
            <p className="mt-2 text-[11px] text-amber-700">
              1コマに {RECOMMENDED_BUBBLES_PER_PANEL} 吹き出し以上あります。読みやすさ優先なら別コマ化も検討してください。
            </p>
          )}
          {fitSummary.risk !== 'safe' && (
            <p className={`mt-2 text-[11px] ${fitSummary.risk === 'tight' ? 'text-amber-700' : 'text-sky-700'}`}>
              {fitSummary.risk === 'tight' ? 'このテンプレ形状だと文字が詰まりやすいコマです。' : 'このテンプレ形状では少し窮屈になりやすい量です。'}{' '}
              目安は {fitSummary.estimatedLineUsage} 行ぶん / 許容量 {fitSummary.estimatedLineBudget} 行です。
            </p>
          )}
        </div>

        <details className="rounded-xl border border-gray-200 bg-white" open={false}>
          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            生成プロンプト
          </summary>
          <div className="border-t border-gray-100 px-3 py-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="h-28 w-full rounded-xl border border-gray-300 p-3 text-xs leading-5"
            />
          </div>
        </details>
      </div>
    </div>
  );
}

export default function CreateMangaPage() {
  const navigate = useNavigate();
  const desktopAPI = window.desktopAPI;
  const [projectName, setProjectName] = useState('');
  const [exportDirectory, setExportDirectory] = useState('');
  const [loadingExportDirectory, setLoadingExportDirectory] = useState(Boolean(desktopAPI));
  const [generatedProjectId, setGeneratedProjectId] = useState<string | null>(null);
  const [generatedLayoutPath, setGeneratedLayoutPath] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<SidebarSectionKey, boolean>>({
    project: true,
    images: false,
    story: true,
    template: true,
    name: true,
  });

  const {
    project,
    uploadedImages,
    storyPrompt,
    layoutConfig,
    generationSettings,
    progress,
    error,
    isGenerating,
    setUploadedImages,
    setStoryPrompt,
    updateLayout,
    updateGenerationSettings,
    prepareManualDraft,
    prepareNameDraft,
    savePanelDraft,
    startGeneration,
  } = useMangaGeneration();
  const pageLoading = isGenerating;
  const pageError = error;
  const selectedTemplate = getLayoutTemplate(layoutConfig.layoutTemplate);
  const editablePanels = useMemo(
    () => [...(project?.panels ?? [])].sort((a, b) => a.panelIndex - b.panelIndex),
    [project?.panels]
  );
  const draftCoverage = useMemo(
    () => getDraftCoverageSummary(editablePanels, selectedTemplate.preview),
    [editablePanels, selectedTemplate.preview]
  );
  const emptyPreviewStatuses = useMemo(
    () => editablePanels.map((panel) => {
      const summary = getPanelDraftSummary(panel);
      const fitSummary = getPanelFitSummary(panel, selectedTemplate.preview[panel.panelIndex]);
      return {
        panelIndex: panel.panelIndex,
        isReady: summary.isReady,
        bubbleCount: summary.bubbleCount,
        fitRisk: fitSummary.risk,
      };
    }),
    [editablePanels, selectedTemplate.preview]
  );

  useEffect(() => {
    if (!desktopAPI) {
      setLoadingExportDirectory(false);
      return;
    }

    void desktopAPI.getApiConfigStatus()
      .then((status) => setExportDirectory(status.effectiveExportDirectory))
      .finally(() => setLoadingExportDirectory(false));
  }, [desktopAPI]);

  const missingRequirements = [
    !storyPrompt.trim() ? 'ストーリー' : null,
  ].filter(Boolean) as string[];
  const canSubmit = missingRequirements.length === 0;

  const handleChooseExportDirectory = async () => {
    if (!desktopAPI) {
      return;
    }

    try {
      const selected = await desktopAPI.chooseExportDirectory();
      if (!selected) {
        return;
      }

      const currentConfig = await desktopAPI.getApiConfig();
      const result = await desktopAPI.saveApiConfig({
        ...currentConfig,
        exportDirectory: selected,
      });
      setExportDirectory(result.status.effectiveExportDirectory);
      toast.success('原稿の保存先を更新しました');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存先の更新に失敗しました');
    }
  };

  const handleGenerate = async () => {
    try {
      const id = await startGeneration(projectName, {
        existingProjectId: project?.id,
        regeneratePrompts: editablePanels.length === 0,
      });
      setGeneratedProjectId(id);
      setGeneratedLayoutPath(`/uploads/${id}/layout.png?t=${Date.now()}`);
      toast.success('生成が完了しました。右側に完成ページを表示します。');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成に失敗しました');
    }
  };

  const handlePrepareNameDraft = async () => {
    try {
      const draft = await prepareNameDraft(projectName, project?.id);
      setOpenSections((prev) => ({ ...prev, name: true }));
      toast.success(`${draft.panels.length}コマ分のネーム案を作成しました`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ネーム案の作成に失敗しました');
    }
  };

  const handlePrepareManualDraft = async () => {
    try {
      const draft = await prepareManualDraft(projectName, project?.id);
      setOpenSections((prev) => ({ ...prev, name: true }));
      toast.success(`${draft.panels.length}コマ分の手動ネームを開始できます`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '手動ネームの開始に失敗しました');
    }
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <aside className="space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-132px)] xl:overflow-y-auto xl:pr-1">
        <SidebarSection
          sectionKey="project"
          title="0. プロジェクト情報"
          summary={`${projectName.trim() || '名称未設定'} / ${loadingExportDirectory ? '保存先読込中' : exportDirectory || '保存先未設定'}`}
          openSections={openSections}
          setOpenSections={setOpenSections}
        >
          <div className="space-y-3">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="プロジェクト名を入力（任意）"
              className="w-full rounded-xl border border-gray-300 p-3 text-sm"
            />
            <p className="text-xs text-gray-500">
              未入力の場合は、ストーリー内容と日時から自動で名前を付けます。
            </p>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">保存先</p>
                  <p className="mt-2 break-all text-sm text-gray-700">
                    {loadingExportDirectory ? '読み込み中...' : exportDirectory || '未設定'}
                  </p>
                </div>
                {desktopAPI && (
                  <button
                    type="button"
                    onClick={handleChooseExportDirectory}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                  >
                    保存先を変更
                  </button>
                )}
              </div>
            </div>
          </div>
        </SidebarSection>

        <SidebarSection
          sectionKey="images"
          title="1. キー画像"
          summary={uploadedImages.length > 0 ? `${uploadedImages.length}枚を参照中` : '未設定でも生成できます'}
          openSections={openSections}
          setOpenSections={setOpenSections}
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              キャラや服装の一貫性を強めたいときだけ、参照画像を1〜2枚指定します。
            </p>
            <ImageUploader onImagesChange={setUploadedImages} />
          </div>
        </SidebarSection>

        <SidebarSection
          sectionKey="story"
          title="2. ストーリー"
          summary={storyPrompt.trim() ? `${storyPrompt.length}文字 / ページ全体の要約` : 'ページ全体で何が起こるかを書く'}
          openSections={openSections}
          setOpenSections={setOpenSections}
        >
          <StoryPromptEditor
            value={storyPrompt}
            onChange={setStoryPrompt}
            imageStyle={generationSettings.imageStyle}
            onStyleChange={(imageStyle) => updateGenerationSettings({ imageStyle })}
            imageModel={generationSettings.imageModel}
            onModelChange={(imageModel) =>
              updateGenerationSettings({
                imageModel: imageModel as typeof generationSettings.imageModel,
                outputResolution: imageModel === 'gemini-2.5-flash-image' ? '1K' : generationSettings.outputResolution,
              })}
            outputResolution={generationSettings.outputResolution}
            onResolutionChange={(outputResolution) => updateGenerationSettings({ outputResolution })}
            useReferenceImages={generationSettings.useReferenceImages}
            onReferenceModeChange={(useReferenceImages) => updateGenerationSettings({ useReferenceImages })}
          />
        </SidebarSection>

        <SidebarSection
          sectionKey="template"
          title="3. ページテンプレート"
          summary={`${selectedTemplate.label} / ${selectedTemplate.totalPanels}コマ / ${layoutConfig.readingOrder === 'japanese' ? '右→左' : '左→右'}`}
          openSections={openSections}
          setOpenSections={setOpenSections}
        >
          <LayoutSelector config={layoutConfig} onChange={updateLayout} />
        </SidebarSection>

        <SidebarSection
          sectionKey="name"
          title="4. コマ別ネーム"
          summary={editablePanels.length > 0 ? `${draftCoverage.readyPanels}/${draftCoverage.totalPanels}コマ入力済み / ${draftCoverage.totalBubbles}吹き出し` : 'コマごとの出来事とセリフを作る'}
          openSections={openSections}
          setOpenSections={setOpenSections}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                disabled={!storyPrompt.trim() || pageLoading}
                onClick={handlePrepareManualDraft}
              >
                {editablePanels.length > 0 ? 'コマ別編集を続ける' : '空欄からコマ別入力'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                disabled={!storyPrompt.trim() || pageLoading}
                onClick={handlePrepareNameDraft}
              >
                {editablePanels.length > 0 ? 'AIでコマ案を更新' : 'AIでコマ案を作る'}
              </button>
            </div>

            <p className="text-xs text-gray-600">
              2. ストーリーはページ全体の要約です。ここでは各コマの出来事とセリフを確定します。普段は空欄から手動で埋め、必要なときだけ AI で叩き台を作る想定です。
            </p>

            {editablePanels.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">入力済みコマ</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{draftCoverage.readyPanels} / {draftCoverage.totalPanels}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">出来事あり</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{draftCoverage.storyBeatPanels} コマ</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">吹き出し総数</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{draftCoverage.totalBubbles} 個</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">長文警告</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{draftCoverage.longBubblePanels} コマ</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">過密コマ</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{draftCoverage.densePanels} コマ</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">ナレーション</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{draftCoverage.narrationPanels} コマ</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">収まり警告</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{draftCoverage.tightFitPanels} コマ</p>
                </div>
              </div>
            )}
            {editablePanels.length > 0 && (draftCoverage.longBubblePanels > 0 || draftCoverage.densePanels > 0 || draftCoverage.tightFitPanels > 0) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                {draftCoverage.longBubblePanels > 0
                  ? `長い吹き出しが ${draftCoverage.longBubblePanels} コマあります。目安は 1 吹き出し ${RECOMMENDED_BUBBLE_LENGTH} 文字以内です。`
                  : '長い吹き出しはありません。'}{' '}
                {draftCoverage.densePanels > 0
                  ? `吹き出しが多いコマが ${draftCoverage.densePanels} コマあります。生成前に分割すると読みやすくなります。`
                  : ''}
                {draftCoverage.tightFitPanels > 0
                  ? ` テンプレ形状に対して文字が詰まりやすいコマが ${draftCoverage.tightFitPanels} コマあります。短いコマから先にセリフ量を削ってください。`
                  : ''}
              </div>
            )}

            {editablePanels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                空欄から始める場合は「空欄からコマ別入力」、要約から叩き台を出したい場合は「AIでコマ案を作る」を使います。
              </div>
            ) : (
              <div className="space-y-3">
                {editablePanels.map((panel) => (
                  <NamePanelEditor
                    key={panel.id}
                    panel={panel}
                    templateRect={selectedTemplate.preview[panel.panelIndex]}
                    onSave={async (panelIndex, updates) => {
                      if (!project?.id) {
                        throw new Error('プロジェクトが見つかりません');
                      }
                      await savePanelDraft(project.id, panelIndex, updates);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </SidebarSection>

        {pageLoading && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <ProgressBar progress={progress} />
            <LoadingSpinner size="sm" message="処理中..." />
          </section>
        )}

        {pageError && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {pageError}
          </section>
        )}

        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {!pageLoading && missingRequirements.length > 0 && (
            <p className="text-xs text-gray-500">
              生成を開始するには {missingRequirements.join('・')} を入力してください。
            </p>
          )}
          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={!canSubmit || pageLoading}
            onClick={handleGenerate}
          >
            {pageLoading ? '生成中...' : '漫画を生成する'}
          </button>
          {generatedProjectId && (
            <button
              type="button"
              className="w-full rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              onClick={() => navigate(`/preview/${generatedProjectId}`)}
            >
              詳細画面を開く
            </button>
          )}
        </section>
      </aside>

      <section className="xl:sticky xl:top-4 xl:self-start">
        <div className="flex h-[calc(100vh-132px)] min-h-[620px] flex-col rounded-[28px] border border-gray-200 bg-white p-3 shadow-sm">
          {generatedLayoutPath ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1">
                <MangaLayoutViewer
                  imageUrl={generatedLayoutPath}
                  dimensions={{ width: layoutConfig.pageWidth, height: layoutConfig.pageHeight }}
                  showControls={false}
                  enableWheelZoom={false}
                  align="top"
                />
              </div>
            </div>
          ) : (
            <EmptyPagePreview
              layoutTemplateId={layoutConfig.layoutTemplate}
              storyPrompt={storyPrompt}
              projectName={projectName}
              panelStatuses={emptyPreviewStatuses}
            />
          )}
        </div>
      </section>
    </div>
  );
}
