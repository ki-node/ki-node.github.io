import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import type {
  PosterExportResultStatus,
  PosterFileExportMessage,
} from './bridge-protocol';

export interface PosterExporter {
  exportPng(
    message: PosterFileExportMessage,
  ): Promise<PosterExportResultStatus>;
}

interface PosterExportEnvironment {
  readonly writeFile: typeof Filesystem.writeFile;
  readonly deleteFile: typeof Filesystem.deleteFile;
  readonly share: typeof Share.share;
  readonly createTemporaryId: () => string;
}

const defaultEnvironment = (): PosterExportEnvironment => ({
  writeFile: (options) => Filesystem.writeFile(options),
  deleteFile: (options) => Filesystem.deleteFile(options),
  share: (options) => Share.share(options),
  createTemporaryId: () => crypto.randomUUID(),
});

export const sanitizePosterFilename = (value: string): string => {
  const basename = value.split(/[\\/]/u).at(-1) ?? '';
  const stem = basename
    .replace(/\.png$/iu, '')
    .normalize('NFKD')
    .replace(/[^a-z\d._-]+/giu, '-')
    .replace(/^[._-]+|[._-]+$/gu, '')
    .slice(0, 80);
  return `${stem || 'poster-forge'}.png`;
};

const encodeBase64 = (data: ArrayBuffer): string => {
  const bytes = new Uint8Array(data);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
};

const isShareCancellation = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return /cancel(?:led|ed)?|abgebrochen/iu.test(message);
};

/** Writes a validated PNG to an app-owned cache path, shares it once, then removes it. */
export const createPosterExporter = (
  environment: PosterExportEnvironment = defaultEnvironment(),
): PosterExporter => ({
  async exportPng(message) {
    const filename = sanitizePosterFilename(message.filename);
    const temporaryId = environment
      .createTemporaryId()
      .replace(/[^a-z\d-]/giu, '')
      .slice(0, 64);
    const path = `orbit-exports/${temporaryId || 'export'}-${filename}`;
    let written = false;

    try {
      const result = await environment.writeFile({
        path,
        data: encodeBase64(message.data),
        directory: Directory.Cache,
        recursive: true,
      });
      written = true;
      await environment.share({
        title: 'Poster exportieren',
        text: filename,
        url: result.uri,
        dialogTitle: 'Poster exportieren',
      });
      return 'shared';
    } catch (error) {
      return isShareCancellation(error) ? 'cancelled' : 'error';
    } finally {
      if (written) {
        try {
          await environment.deleteFile({ path, directory: Directory.Cache });
        } catch {
          // A failed best-effort cache cleanup must not reopen or duplicate the export.
        }
      }
    }
  },
});
