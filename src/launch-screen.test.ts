import { describe, expect, it, vi } from 'vitest';

import { revealHubAfterPaint } from './launch-screen';
import type { HubRuntime } from './runtime';

describe('launch screen', () => {
  it('hides only after Hub initialization has received two animation frames', async () => {
    const callbacks: FrameRequestCallback[] = [];
    const targetWindow = {
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    } as unknown as Window;
    const root = document.documentElement;
    const hideLaunchScreen = vi.fn(async () => true);
    const runtime = { hideLaunchScreen } as unknown as HubRuntime;

    const reveal = revealHubAfterPaint({ root, runtime, targetWindow });
    expect(root.classList.contains('is-hub-ready')).toBe(false);
    expect(hideLaunchScreen).not.toHaveBeenCalled();

    callbacks.shift()?.(0);
    await Promise.resolve();
    expect(hideLaunchScreen).not.toHaveBeenCalled();

    callbacks.shift()?.(16);
    await reveal;
    expect(root.classList.contains('is-hub-ready')).toBe(true);
    expect(hideLaunchScreen).toHaveBeenCalledOnce();
    root.classList.remove('is-hub-ready');
  });
});
