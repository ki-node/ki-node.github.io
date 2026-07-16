import { describe, expect, it } from 'vitest';

import {
  parsePortfolioLinkMessage,
  parsePosterFileExportMessage,
  PORTFOLIO_BRIDGE,
  POSTER_BRIDGE,
} from './bridge-protocol';

describe('Portfolio bridge protocol', () => {
  const message = {
    projectId: PORTFOLIO_BRIDGE.projectId,
    protocolVersion: PORTFOLIO_BRIDGE.protocolVersion,
    type: PORTFOLIO_BRIDGE.openExternalLinkType,
    url: 'mailto:test@example.com',
  };

  it('accepts only the supported project, version and message type', () => {
    expect(parsePortfolioLinkMessage(message)).toEqual(message);
    expect(
      parsePortfolioLinkMessage({ ...message, projectId: 'poster' }),
    ).toBeUndefined();
    expect(
      parsePortfolioLinkMessage({ ...message, protocolVersion: 2 }),
    ).toBeUndefined();
    expect(
      parsePortfolioLinkMessage({ ...message, type: 'unknown' }),
    ).toBeUndefined();
  });

  it('accepts mailto and HTTPS while rejecting dangerous or local schemes', () => {
    expect(
      parsePortfolioLinkMessage({ ...message, url: 'https://example.com/path' })
        ?.url,
    ).toBe('https://example.com/path');
    expect(
      parsePortfolioLinkMessage({ ...message, url: 'javascript:alert(1)' }),
    ).toBeUndefined();
    expect(
      parsePortfolioLinkMessage({ ...message, url: 'data:text/plain,no' }),
    ).toBeUndefined();
    expect(
      parsePortfolioLinkMessage({ ...message, url: 'file:///tmp/no' }),
    ).toBeUndefined();
    expect(
      parsePortfolioLinkMessage({ ...message, url: '/relative' }),
    ).toBeUndefined();
  });
});

describe('Poster export bridge protocol', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]).buffer;
  const message = {
    channel: POSTER_BRIDGE.channel,
    version: POSTER_BRIDGE.version,
    projectId: POSTER_BRIDGE.projectId,
    type: POSTER_BRIDGE.fileExportType,
    requestId: 'request-1',
    filename: '../../poster.png',
    mimeType: POSTER_BRIDGE.mimeType,
    size: png.byteLength,
    data: png,
  };

  it('accepts one bounded PNG payload with the exact protocol envelope', () => {
    expect(parsePosterFileExportMessage(message)).toEqual(message);
  });

  it('rejects foreign projects, versions, message types and MIME types', () => {
    expect(
      parsePosterFileExportMessage({ ...message, projectId: 'portfolio' }),
    ).toBeUndefined();
    expect(
      parsePosterFileExportMessage({ ...message, version: 2 }),
    ).toBeUndefined();
    expect(
      parsePosterFileExportMessage({ ...message, type: 'open-link' }),
    ).toBeUndefined();
    expect(
      parsePosterFileExportMessage({ ...message, mimeType: 'text/html' }),
    ).toBeUndefined();
  });

  it('rejects mismatched, oversized and non-PNG binary data', () => {
    expect(
      parsePosterFileExportMessage({ ...message, size: png.byteLength + 1 }),
    ).toBeUndefined();
    expect(
      parsePosterFileExportMessage({
        ...message,
        size: POSTER_BRIDGE.maxExportBytes + 1,
      }),
    ).toBeUndefined();
    const invalid = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    expect(
      parsePosterFileExportMessage({
        ...message,
        size: invalid.byteLength,
        data: invalid,
      }),
    ).toBeUndefined();
  });
});
