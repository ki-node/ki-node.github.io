export const PORTFOLIO_BRIDGE = {
  projectId: 'portfolio',
  protocolVersion: 1,
  openExternalLinkType: 'ki-node:open-external-link',
} as const;

export const POSTER_BRIDGE = {
  channel: 'orbit-project-bridge',
  version: 1,
  projectId: 'poster',
  projectReadyType: 'project-ready',
  hostReadyType: 'host-ready',
  fileExportType: 'file-export',
  fileExportResultType: 'file-export-result',
  mimeType: 'image/png',
  maxExportBytes: 48 * 1024 * 1024,
} as const;

export const BLACKBOX_BRIDGE = {
  channel: 'ki-node.project-bridge',
  type: 'haptic',
  protocolVersion: 1,
  project: 'blackbox',
  events: ['light', 'medium', 'heavy', 'success', 'warning', 'error'],
} as const;

export type BlackboxHapticEvent = (typeof BLACKBOX_BRIDGE.events)[number];

export interface BlackboxHapticMessage {
  readonly channel: typeof BLACKBOX_BRIDGE.channel;
  readonly type: typeof BLACKBOX_BRIDGE.type;
  readonly protocolVersion: typeof BLACKBOX_BRIDGE.protocolVersion;
  readonly project: typeof BLACKBOX_BRIDGE.project;
  readonly event: BlackboxHapticEvent;
}

export interface PortfolioExternalLinkMessage {
  readonly projectId: typeof PORTFOLIO_BRIDGE.projectId;
  readonly protocolVersion: typeof PORTFOLIO_BRIDGE.protocolVersion;
  readonly type: typeof PORTFOLIO_BRIDGE.openExternalLinkType;
  readonly url: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

export interface PosterFileExportMessage {
  readonly channel: typeof POSTER_BRIDGE.channel;
  readonly version: typeof POSTER_BRIDGE.version;
  readonly projectId: typeof POSTER_BRIDGE.projectId;
  readonly type: typeof POSTER_BRIDGE.fileExportType;
  readonly requestId: string;
  readonly filename: string;
  readonly mimeType: typeof POSTER_BRIDGE.mimeType;
  readonly size: number;
  readonly data: ArrayBuffer;
}

export type PosterExportResultStatus = 'shared' | 'cancelled' | 'error';

/** Accepts only Blackbox's fixed, parameter-free semantic haptic envelope. */
export function parseBlackboxHapticMessage(
  value: unknown,
): BlackboxHapticMessage | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'channel',
      'type',
      'protocolVersion',
      'project',
      'event',
    ]) ||
    value.channel !== BLACKBOX_BRIDGE.channel ||
    value.type !== BLACKBOX_BRIDGE.type ||
    value.protocolVersion !== BLACKBOX_BRIDGE.protocolVersion ||
    value.project !== BLACKBOX_BRIDGE.project ||
    typeof value.event !== 'string' ||
    !BLACKBOX_BRIDGE.events.some((event) => event === value.event)
  ) {
    return undefined;
  }

  return {
    channel: BLACKBOX_BRIDGE.channel,
    type: BLACKBOX_BRIDGE.type,
    protocolVersion: BLACKBOX_BRIDGE.protocolVersion,
    project: BLACKBOX_BRIDGE.project,
    event: value.event as BlackboxHapticEvent,
  };
}

const hasPngSignature = (data: ArrayBuffer): boolean => {
  if (data.byteLength < 8) return false;
  const signature = new Uint8Array(data, 0, 8);
  return [137, 80, 78, 71, 13, 10, 26, 10].every(
    (byte, index) => signature[index] === byte,
  );
};

const hasPosterEnvelope = (value: Record<string, unknown>): boolean =>
  value.channel === POSTER_BRIDGE.channel &&
  value.version === POSTER_BRIDGE.version &&
  value.projectId === POSTER_BRIDGE.projectId;

export const isPosterProjectReadyMessage = (value: unknown): boolean =>
  isRecord(value) &&
  hasPosterEnvelope(value) &&
  value.type === POSTER_BRIDGE.projectReadyType;

/** Accepts only the bounded PNG payload supported by the native exporter. */
export const parsePosterFileExportMessage = (
  value: unknown,
): PosterFileExportMessage | undefined => {
  if (
    !isRecord(value) ||
    !hasPosterEnvelope(value) ||
    value.type !== POSTER_BRIDGE.fileExportType ||
    typeof value.requestId !== 'string' ||
    !/^[\w-]{1,100}$/u.test(value.requestId) ||
    typeof value.filename !== 'string' ||
    value.filename.length < 1 ||
    value.filename.length > 200 ||
    value.mimeType !== POSTER_BRIDGE.mimeType ||
    typeof value.size !== 'number' ||
    !Number.isSafeInteger(value.size) ||
    value.size < 1 ||
    value.size > POSTER_BRIDGE.maxExportBytes ||
    !(value.data instanceof ArrayBuffer) ||
    value.data.byteLength !== value.size ||
    !hasPngSignature(value.data)
  ) {
    return undefined;
  }

  return {
    channel: POSTER_BRIDGE.channel,
    version: POSTER_BRIDGE.version,
    projectId: POSTER_BRIDGE.projectId,
    type: POSTER_BRIDGE.fileExportType,
    requestId: value.requestId,
    filename: value.filename,
    mimeType: POSTER_BRIDGE.mimeType,
    size: value.size,
    data: value.data,
  };
};

export const createPosterHostReadyMessage = () => ({
  channel: POSTER_BRIDGE.channel,
  version: POSTER_BRIDGE.version,
  projectId: POSTER_BRIDGE.projectId,
  type: POSTER_BRIDGE.hostReadyType,
  capabilities: ['file-export'] as const,
});

export const createPosterExportResultMessage = (
  requestId: string,
  status: PosterExportResultStatus,
) => ({
  channel: POSTER_BRIDGE.channel,
  version: POSTER_BRIDGE.version,
  projectId: POSTER_BRIDGE.projectId,
  type: POSTER_BRIDGE.fileExportResultType,
  requestId,
  status,
});

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
