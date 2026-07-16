import { AppLauncher } from '@capacitor/app-launcher';
import { SplashScreen } from '@capacitor/splash-screen';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/app-launcher', () => ({
  AppLauncher: { openUrl: vi.fn() },
}));
vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: vi.fn() },
}));

import { PROJECT_CATALOG } from './projects';
import { createHubRuntime } from './runtime';

describe('Hub runtime', () => {
  const project = PROJECT_CATALOG[0];

  it('selects the public source for the web Hub', () => {
    const runtime = createHubRuntime('web');

    expect(runtime.resolveProjectSource(project)).toBe(
      'https://ki-node.github.io/portfolio/',
    );
    expect(runtime.supports('haptics')).toBe(false);
  });

  it('selects the embedded source for the native app', () => {
    const runtime = createHubRuntime('native');

    expect(runtime.resolveProjectSource(project)).toBe(
      './projects/portfolio/index.html',
    );
    expect(runtime.supports('haptics')).toBe(true);
  });

  it('resolves Poster publicly on the web and locally in the native app', () => {
    const poster = PROJECT_CATALOG[1];

    expect(createHubRuntime('web').resolveProjectSource(poster)).toBe(
      'https://ki-node.github.io/poster/',
    );
    expect(createHubRuntime('native').resolveProjectSource(poster)).toBe(
      './projects/poster/index.html',
    );
  });

  it('resolves Blackbox publicly on the web and locally in the native app', () => {
    const blackbox = PROJECT_CATALOG[2];

    expect(createHubRuntime('web').resolveProjectSource(blackbox)).toBe(
      'https://ki-node.github.io/blackbox/',
    );
    expect(createHubRuntime('native').resolveProjectSource(blackbox)).toBe(
      './projects/blackbox/index.html',
    );
  });

  it('hands allowed native links to the official system app launcher', async () => {
    const openUrl = vi
      .spyOn(AppLauncher, 'openUrl')
      .mockResolvedValue({ completed: true });
    const runtime = createHubRuntime('native');

    await expect(
      runtime.openExternalUrl('mailto:test@example.com'),
    ).resolves.toBe(true);
    await expect(
      runtime.openExternalUrl('https://example.com/path'),
    ).resolves.toBe(true);
    await expect(runtime.openExternalUrl('javascript:alert(1)')).resolves.toBe(
      false,
    );
    expect(openUrl).toHaveBeenCalledTimes(2);
  });

  it('keeps native URL and splash APIs unavailable in the web runtime', async () => {
    const openUrl = vi.spyOn(AppLauncher, 'openUrl');
    const hide = vi.spyOn(SplashScreen, 'hide');
    const runtime = createHubRuntime('web');

    await expect(runtime.openExternalUrl('https://example.com')).resolves.toBe(
      false,
    );
    await expect(runtime.hideLaunchScreen()).resolves.toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
  });

  it('hides the native splash through the official plugin', async () => {
    const hide = vi.spyOn(SplashScreen, 'hide').mockResolvedValue();

    await expect(createHubRuntime('native').hideLaunchScreen()).resolves.toBe(
      true,
    );
    expect(hide).toHaveBeenCalledOnce();
  });
});
