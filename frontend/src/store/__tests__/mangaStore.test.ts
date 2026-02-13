import { describe, it, expect, beforeEach } from 'vitest';
import { useMangaStore } from '../mangaStore';
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_GENERATION_SETTINGS } from '../../types';

describe('mangaStore', () => {
  beforeEach(() => {
    useMangaStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useMangaStore.getState();
    expect(state.project).toBeNull();
    expect(state.uploadedImages).toEqual([]);
    expect(state.storyPrompt).toBe('');
    expect(state.layoutConfig).toEqual(DEFAULT_LAYOUT_CONFIG);
    expect(state.generationSettings).toEqual(DEFAULT_GENERATION_SETTINGS);
    expect(state.progress.stage).toBe('idle');
    expect(state.error).toBeNull();
  });

  it('setStoryPrompt updates storyPrompt', () => {
    useMangaStore.getState().setStoryPrompt('テストストーリー');
    expect(useMangaStore.getState().storyPrompt).toBe('テストストーリー');
  });

  it('addUploadedImage adds image to array', () => {
    const image = {
      file: new File(['test'], 'test.png', { type: 'image/png' }),
      previewUrl: 'blob:test',
      position: 'start' as const,
    };
    useMangaStore.getState().addUploadedImage(image);
    expect(useMangaStore.getState().uploadedImages).toHaveLength(1);
    expect(useMangaStore.getState().uploadedImages[0].previewUrl).toBe('blob:test');
  });

  it('removeUploadedImage removes image at index', () => {
    const image1 = {
      file: new File(['1'], 'a.png', { type: 'image/png' }),
      previewUrl: 'blob:a',
      position: 'start' as const,
    };
    const image2 = {
      file: new File(['2'], 'b.png', { type: 'image/png' }),
      previewUrl: 'blob:b',
      position: 'end' as const,
    };
    useMangaStore.getState().addUploadedImage(image1);
    useMangaStore.getState().addUploadedImage(image2);
    expect(useMangaStore.getState().uploadedImages).toHaveLength(2);

    useMangaStore.getState().removeUploadedImage(0);
    expect(useMangaStore.getState().uploadedImages).toHaveLength(1);
    expect(useMangaStore.getState().uploadedImages[0].previewUrl).toBe('blob:b');
  });

  it('updateLayoutConfig partially updates config', () => {
    useMangaStore.getState().updateLayoutConfig({ totalPanels: 8, format: 'horizontal' });
    const config = useMangaStore.getState().layoutConfig;
    expect(config.totalPanels).toBe(8);
    expect(config.format).toBe('horizontal');
    // Other values should remain default
    expect(config.readingOrder).toBe(DEFAULT_LAYOUT_CONFIG.readingOrder);
    expect(config.gutterSize).toBe(DEFAULT_LAYOUT_CONFIG.gutterSize);
  });

  it('updateGenerationSettings partially updates settings', () => {
    useMangaStore.getState().updateGenerationSettings({ aspectRatio: 'wide' });
    const settings = useMangaStore.getState().generationSettings;
    expect(settings.aspectRatio).toBe('wide');
    expect(settings.imageStyle).toBe(DEFAULT_GENERATION_SETTINGS.imageStyle);
  });

  it('setProgress updates progress', () => {
    useMangaStore.getState().setProgress({ stage: 'uploading', percentage: 50 });
    const progress = useMangaStore.getState().progress;
    expect(progress.stage).toBe('uploading');
    expect(progress.percentage).toBe(50);
  });

  it('setError sets and clears error', () => {
    useMangaStore.getState().setError('テストエラー');
    expect(useMangaStore.getState().error).toBe('テストエラー');

    useMangaStore.getState().setError(null);
    expect(useMangaStore.getState().error).toBeNull();
  });

  it('setProject sets project', () => {
    const project = {
      id: 'test-id',
      name: 'Test Project',
      status: 'draft' as const,
      layoutConfig: DEFAULT_LAYOUT_CONFIG,
      generationSettings: DEFAULT_GENERATION_SETTINGS,
      panels: [],
      keyImages: [],
      totalCost: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    useMangaStore.getState().setProject(project);
    expect(useMangaStore.getState().project).toEqual(project);
  });

  it('reset restores initial state', () => {
    useMangaStore.getState().setStoryPrompt('test');
    useMangaStore.getState().setError('error');
    useMangaStore.getState().updateLayoutConfig({ totalPanels: 10 });

    useMangaStore.getState().reset();

    const state = useMangaStore.getState();
    expect(state.storyPrompt).toBe('');
    expect(state.error).toBeNull();
    expect(state.layoutConfig.totalPanels).toBe(DEFAULT_LAYOUT_CONFIG.totalPanels);
    expect(state.project).toBeNull();
    expect(state.uploadedImages).toEqual([]);
  });
});
