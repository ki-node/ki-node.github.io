import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Triggers a medium native haptic impact when the app runs on iOS.
 *
 * @returns Whether native haptic feedback was triggered successfully.
 */
export async function triggerMediumHaptic(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    await Haptics.impact({ style: ImpactStyle.Medium });

    return true;
  } catch {
    return false;
  }
}
