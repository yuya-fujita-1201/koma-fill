import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExport } from '../useExport';

vi.mock('../../services/apiClient', () => ({
  composeLayout: vi.fn(),
  exportManga: vi.fn(),
}));

import { composeLayout, exportManga } from '../../services/apiClient';

const mockComposeLayout = composeLayout as ReturnType<typeof vi.fn>;
const mockExportManga = exportManga as ReturnType<typeof vi.fn>;

describe('useExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with initial state', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.exporting).toBe(false);
    expect(result.current.exportResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('composeLayout calls API and returns result', async () => {
    const layoutResult = {
      layoutPath: '/output/layout.png',
      panelPositions: [],
      dimensions: { width: 800, height: 1200 },
    };
    mockComposeLayout.mockResolvedValueOnce(layoutResult);

    const { result } = renderHook(() => useExport());

    let response;
    await act(async () => {
      response = await result.current.composeLayout('proj-1');
    });

    expect(mockComposeLayout).toHaveBeenCalledWith('proj-1', undefined);
    expect(response).toEqual(layoutResult);
    expect(result.current.exporting).toBe(false);
  });

  it('composeLayout sets error on failure', async () => {
    mockComposeLayout.mockRejectedValueOnce(new Error('Layout failed'));

    const { result } = renderHook(() => useExport());

    await act(async () => {
      try {
        await result.current.composeLayout('proj-1');
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBe('Layout failed');
    expect(result.current.exporting).toBe(false);
  });

  it('exportManga calls API and sets result', async () => {
    const exportResult = {
      downloadUrl: '/download/manga.png',
      format: 'png',
      fileSize: 1024,
      message: 'Export complete',
      projectId: 'proj-1',
    };
    mockExportManga.mockResolvedValueOnce(exportResult);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportManga('proj-1', {
        format: 'png',
        compression: 'medium',
        resolution: 'web',
      });
    });

    expect(result.current.exportResult).toEqual(exportResult);
    expect(result.current.exporting).toBe(false);
  });

  it('exportManga sets error on failure', async () => {
    mockExportManga.mockRejectedValueOnce(new Error('Export failed'));

    const { result } = renderHook(() => useExport());

    await act(async () => {
      try {
        await result.current.exportManga('proj-1');
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBe('Export failed');
  });

  it('clearExportState resets result and error', async () => {
    const exportResult = {
      downloadUrl: '/download/manga.png',
      format: 'png',
      fileSize: 1024,
      message: 'Done',
      projectId: 'proj-1',
    };
    mockExportManga.mockResolvedValueOnce(exportResult);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportManga('proj-1');
    });
    expect(result.current.exportResult).not.toBeNull();

    act(() => {
      result.current.clearExportState();
    });

    expect(result.current.exportResult).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
