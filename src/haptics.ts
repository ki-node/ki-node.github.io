import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

import type { BlackboxHapticEvent } from './bridge-protocol';

/** Maps a validated semantic project event to exactly one native action. */
export async function triggerSemanticHaptic(
  event: BlackboxHapticEvent,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    switch (event) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        break;
      default:
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers a medium native haptic impact when the app runs on iOS.
 *
 * @returns Whether native haptic feedback was triggered successfully.
 */
export async function triggerMediumHaptic(): Promise<boolean> {
  return triggerSemanticHaptic('medium');
}
