import { describe, expect, it } from 'vitest';

import { parsePortfolioLinkMessage, PORTFOLIO_BRIDGE } from './bridge-protocol';

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
