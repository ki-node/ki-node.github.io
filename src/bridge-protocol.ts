/**
 * Reserved protocol metadata for the later iframe message bridge.
 * No message handler or native project capability is implemented in this PR.
 */
export const HUB_BRIDGE_PROTOCOL = 'ki-node.host' as const;
export const HUB_BRIDGE_VERSION = 1 as const;

export interface HubBridgeEnvelope<Payload = unknown> {
  readonly protocol: typeof HUB_BRIDGE_PROTOCOL;
  readonly version: typeof HUB_BRIDGE_VERSION;
  readonly projectId: string;
  readonly requestId: string;
  readonly type: string;
  readonly payload: Payload;
}
