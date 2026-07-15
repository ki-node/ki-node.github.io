import { describe, expect, it, vi } from 'vitest';

import { POSTER_BRIDGE, type PosterFileExportMessage } from './bridge-protocol';
import { createPosterExporter, sanitizePosterFilename } from './poster-export';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]).buffer;

const message: PosterFileExportMessage = {
  channel: POSTER_BRIDGE.channel,
  version: POSTER_BRIDGE.version,
  projectId: POSTER_BRIDGE.projectId,
  type: POSTER_BRIDGE.fileExportType,
  requestId: 'request-1',
  filename: '../../My unsafe Poster?.png',
  mimeType: POSTER_BRIDGE.mimeType,
  size: png.byteLength,
  data: png,
};

const createHarness = () => {
  const writeFile = vi
    .fn()
    .mockResolvedValue({ uri: 'file:///cache/poster.png' });
  const share = vi.fn().mockResolvedValue({ activityType: 'saveToFiles' });
  const deleteFile = vi.fn().mockResolvedValue(undefined);
  const exporter = createPosterExporter({
    writeFile,
    share,
    deleteFile,
    createTemporaryId: () => 'host-generated-id',
  });
  return { deleteFile, exporter, share, writeFile };
};

describe('native Poster exporter', () => {
  it('strictly reduces untrusted names to a local PNG basename', () => {
    expect(sanitizePosterFilename('../../My unsafe Poster?.PNG')).toBe(
      'My-unsafe-Poster.png',
    );
    expect(sanitizePosterFilename('/.../')).toBe('poster-forge.png');
  });

  it('writes one host-owned temporary file, shares it once and removes it', async () => {
    const { deleteFile, exporter, share, writeFile } = createHarness();

    await expect(exporter.exportPng(message)).resolves.toBe('shared');
    expect(writeFile).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'orbit-exports/host-generated-id-My-unsafe-Poster.png',
        recursive: true,
      }),
    );
    expect(share).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'file:///cache/poster.png' }),
    );
    expect(deleteFile).toHaveBeenCalledOnce();
    expect(deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'orbit-exports/host-generated-id-My-unsafe-Poster.png',
      }),
    );
  });

  it('treats Share cancellation as controlled and still removes the file', async () => {
    const { deleteFile, exporter, share } = createHarness();
    share.mockRejectedValueOnce(new Error('User cancelled'));

    await expect(exporter.exportPng(message)).resolves.toBe('cancelled');
    expect(deleteFile).toHaveBeenCalledOnce();
  });

  it('reports native failures without sharing or duplicating files', async () => {
    const { deleteFile, exporter, share, writeFile } = createHarness();
    writeFile.mockRejectedValueOnce(new Error('No cache space'));

    await expect(exporter.exportPng(message)).resolves.toBe('error');
    expect(share).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
