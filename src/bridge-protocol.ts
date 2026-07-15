export const PORTFOLIO_BRIDGE = {
  projectId: 'portfolio',
  protocolVersion: 1,
  openExternalLinkType: 'ki-node:open-external-link',
} as const;

export interface PortfolioExternalLinkMessage {
  readonly projectId: typeof PORTFOLIO_BRIDGE.projectId;
  readonly protocolVersion: typeof PORTFOLIO_BRIDGE.protocolVersion;
  readonly type: typeof PORTFOLIO_BRIDGE.openExternalLinkType;
  readonly url: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Validates the complete cross-repository contract before any native action. */
export function parsePortfolioLinkMessage(
  value: unknown,
): PortfolioExternalLinkMessage | undefined {
  if (
    !isRecord(value) ||
    value.projectId !== PORTFOLIO_BRIDGE.projectId ||
    value.protocolVersion !== PORTFOLIO_BRIDGE.protocolVersion ||
    value.type !== PORTFOLIO_BRIDGE.openExternalLinkType ||
    typeof value.url !== 'string'
  ) {
    return undefined;
  }

  try {
    const url = new URL(value.url);
    if (url.protocol !== 'mailto:' && url.protocol !== 'https:')
      return undefined;

    return {
      projectId: PORTFOLIO_BRIDGE.projectId,
      protocolVersion: PORTFOLIO_BRIDGE.protocolVersion,
      type: PORTFOLIO_BRIDGE.openExternalLinkType,
      url: url.href,
    };
  } catch {
    return undefined;
  }
}
