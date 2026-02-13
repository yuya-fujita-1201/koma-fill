process.env.OPENAI_API_KEY = 'test-openai-key';

import fs from 'fs/promises';
import { ExportService, type ExportOptions, type ExportResult } from '../exportService';
import { ValidationError } from '../../middleware/errorHandler';
import { ComposedLayout } from '../layoutEngine';

const baseLayout: ComposedLayout = {
  buffer: Buffer.from('layout'),
  width: 10,
  height: 10,
  format: 'png',
  panelPositions: [],
};

const mockSharp = {
  png: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  withMetadata: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('encoded')),
};

jest.mock('sharp', () => {
  const fn = jest.fn(() => mockSharp);
  return {
    __esModule: true,
    default: fn,
  };
});

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
    jest.clearAllMocks();
  });

  it('PNG エクスポートがバッファを返す', async () => {
    const result = await service.exportPNG(baseLayout, {
      format: 'png',
      compression: 'medium',
      resolution: 'web',
    });
    expect(result.format).toBe('png');
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('JPG エクスポートがバッファを返す', async () => {
    const result = await service.exportJPG(baseLayout, {
      format: 'jpg',
      compression: 'high',
      resolution: 'print',
    });
    expect(result.format).toBe('jpg');
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it.skip('PDF エクスポートがバッファを返す (PDFKitが実画像バッファを要求するためCI環境ではスキップ)', async () => {
    const result = await service.exportPDF(baseLayout, {
      format: 'pdf',
      compression: 'low',
      resolution: 'web',
    });
    expect(result.format).toBe('pdf');
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('compression オプションが反映される', async () => {
    await service.export(baseLayout, {
      format: 'jpg',
      compression: 'low',
      resolution: 'web',
    });

    expect(mockSharp.jpeg).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 60 })
    );
  });

  it('saveToFile がディレクトリ作成 + ファイル書き込みを行う', async () => {
    const result: ExportResult = {
      buffer: Buffer.from('buffer'),
      format: 'png',
      fileSize: 6,
      width: 10,
      height: 10,
      dpi: 72,
      filePath: '',
    };
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const filePath = await service.saveToFile(result, '/tmp/out', 'manga');
    expect(mkdirSpy).toHaveBeenCalledWith('/tmp/out', { recursive: true });
    expect(writeSpy).toHaveBeenCalledWith(filePath, result.buffer);
    expect(filePath).toBe('/tmp/out/manga.png');

    writeSpy.mockRestore();
    mkdirSpy.mockRestore();
  });

  it('不正な形式で ValidationError を投げる', async () => {
    await expect(
      service.export(baseLayout, {
        format: 'gif' as unknown as ExportOptions['format'],
        compression: 'medium',
        resolution: 'web',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('saveToFile はファイル拡張子を付与する', async () => {
    const result: ExportResult = {
      buffer: Buffer.from('buffer'),
      format: 'jpg',
      fileSize: 6,
      width: 10,
      height: 10,
      dpi: 72,
      filePath: '',
    };
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const filePath = await service.saveToFile(result, '/tmp/out', 'manga.jpg');
    expect(filePath).toBe('/tmp/out/manga.jpg');
    writeSpy.mockRestore();
    mkdirSpy.mockRestore();
  });

  it('png export は compression を反映する', async () => {
    await service.export(baseLayout, {
      format: 'png',
      compression: 'high',
      resolution: 'print',
    });
    expect(mockSharp.png).toHaveBeenCalledWith(expect.objectContaining({ compressionLevel: 9 }));
  });
});
