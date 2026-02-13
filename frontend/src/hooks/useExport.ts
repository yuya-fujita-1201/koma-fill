import { useCallback, useState } from 'react';
import { composeLayout, exportManga } from '../services/apiClient';

interface ExportResult {
  downloadUrl: string;
  format: string;
  fileSize: number;
}

interface UseExportReturn {
  exporting: boolean;
  exportResult: ExportResult | null;
  error: string | null;
  composeLayout: (
    projectId: string,
    speechBubbles?: object[] | undefined
  ) => Promise<{
    layoutPath: string;
    panelPositions: unknown;
    dimensions: { width: number; height: number };
  }>;
  exportManga: (projectId: string, options?: { format?: string; compression?: string; resolution?: string }) => Promise<ExportResult>;
  clearExportState: () => void;
}

export function useExport(): UseExportReturn {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compose = useCallback(async (projectId: string, speechBubbles?: object[]) => {
    setExporting(true);
    setError(null);
    try {
      return await composeLayout(projectId, speechBubbles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compose layout';
      setError(message);
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  const exportAction = useCallback(async (
    projectId: string,
    options?: { format?: string; compression?: string; resolution?: string }
  ) => {
    setExporting(true);
    setError(null);
    try {
      const result = await exportManga(projectId, options as {
        format: 'png' | 'jpg' | 'pdf';
        compression: 'low' | 'medium' | 'high';
        resolution: 'web' | 'print';
      });
      setExportResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  const clearExportState = useCallback(() => {
    setExportResult(null);
    setError(null);
  }, []);

  return { exporting, exportResult, error, composeLayout: compose, exportManga: exportAction, clearExportState };
}
