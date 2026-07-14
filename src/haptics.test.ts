import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

import { triggerMediumHaptic } from './haptics';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
  },
  ImpactStyle: {
    Medium: 'MEDIUM',
  },
}));

describe('triggerMediumHaptic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not invoke the plugin in a regular browser', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await expect(triggerMediumHaptic()).resolves.toBe(false);
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
});
