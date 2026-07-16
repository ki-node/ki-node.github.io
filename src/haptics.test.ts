import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

import { triggerMediumHaptic, triggerSemanticHaptic } from './haptics';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}));

describe('native haptics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not invoke the plugin in a regular browser', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await expect(triggerMediumHaptic()).resolves.toBe(false);
    expect(Haptics.impact).not.toHaveBeenCalled();
    expect(Haptics.notification).not.toHaveBeenCalled();
  });

  it.each([
    ['light', ImpactStyle.Light],
    ['medium', ImpactStyle.Medium],
    ['heavy', ImpactStyle.Heavy],
  ] as const)('maps %s to one semantic impact', async (event, style) => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Haptics.impact).mockResolvedValue();

    await expect(triggerSemanticHaptic(event)).resolves.toBe(true);
    expect(Haptics.impact).toHaveBeenCalledOnce();
    expect(Haptics.impact).toHaveBeenCalledWith({ style });
    expect(Haptics.notification).not.toHaveBeenCalled();
  });

  it.each([
    ['success', NotificationType.Success],
    ['warning', NotificationType.Warning],
    ['error', NotificationType.Error],
  ] as const)('maps %s to one semantic notification', async (event, type) => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Haptics.notification).mockResolvedValue();

    await expect(triggerSemanticHaptic(event)).resolves.toBe(true);
    expect(Haptics.notification).toHaveBeenCalledOnce();
    expect(Haptics.notification).toHaveBeenCalledWith({ type });
    expect(Haptics.impact).not.toHaveBeenCalled();
  });

  it('requests medium impact on a native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Haptics.impact).mockResolvedValue();

    await expect(triggerMediumHaptic()).resolves.toBe(true);
    expect(Haptics.impact).toHaveBeenCalledWith({
      style: ImpactStyle.Medium,
    });
  });

  it('handles an unavailable native haptics implementation', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Haptics.impact).mockRejectedValue(new Error('Unavailable'));

    await expect(triggerMediumHaptic()).resolves.toBe(false);
  });

  it('handles an unavailable native notification implementation', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Haptics.notification).mockRejectedValue(new Error('Unavailable'));

    await expect(triggerSemanticHaptic('success')).resolves.toBe(false);
  });
});
