import type { HubRuntime } from './runtime';

interface LaunchScreenOptions {
  readonly root?: HTMLElement;
  readonly runtime: HubRuntime;
  readonly targetWindow?: Window;
}

const nextFrame = (targetWindow: Window) =>
  new Promise<void>((resolve) =>
    targetWindow.requestAnimationFrame(() => resolve()),
  );

/** Reveals the initialized Hub only after it has had a complete visible paint opportunity. */
export async function revealHubAfterPaint({
  root = document.documentElement,
  runtime,
  targetWindow = window,
}: LaunchScreenOptions): Promise<void> {
  await nextFrame(targetWindow);
  await nextFrame(targetWindow);
  root.classList.add('is-hub-ready');
  await runtime.hideLaunchScreen();
}
