import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { SplashScreen } from '@capacitor/splash-screen';

import { triggerMediumHaptic } from './haptics';
import type { HubProject, ProjectCapability } from './projects';

export type RuntimeKind = 'native' | 'web';

export interface HubRuntime {
  readonly kind: RuntimeKind;
  readonly label: string;
  resolveProjectSource(project: HubProject): string;
  supports(capability: ProjectCapability): boolean;
  triggerOpenFeedback(): Promise<boolean>;
  openExternalUrl(url: string): Promise<boolean>;
  hideLaunchScreen(): Promise<boolean>;
}

export const detectRuntimeKind = (): RuntimeKind =>
  Capacitor.isNativePlatform() ? 'native' : 'web';

/** Creates the single runtime boundary used by the shared Hub UI. */
export function createHubRuntime(
  kind: RuntimeKind = detectRuntimeKind(),
): HubRuntime {
  return {
    kind,
    label: kind === 'native' ? 'Native iOS' : 'Web Hub',
    resolveProjectSource: (project) =>
      kind === 'native' ? project.embeddedUrl : project.webUrl,
    supports: (capability) => capability === 'haptics' && kind === 'native',
    triggerOpenFeedback: async () =>
      kind === 'native' ? triggerMediumHaptic() : Promise.resolve(false),
    openExternalUrl: async (url) => {
      if (kind !== 'native') return false;

      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'mailto:' && parsed.protocol !== 'https:')
          return false;
        const result = await AppLauncher.openUrl({ url: parsed.href });
        return result.completed;
      } catch {
        return false;
      }
    },
    hideLaunchScreen: async () => {
      if (kind !== 'native') return false;

      try {
        await SplashScreen.hide();
        return true;
      } catch {
        return false;
      }
    },
  };
}
