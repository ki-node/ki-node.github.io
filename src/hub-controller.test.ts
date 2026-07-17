import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HubController } from './hub-controller';
import { createHubRuntime } from './runtime';
import type { HubRuntime } from './runtime';
import {
  BLACKBOX_BRIDGE,
  PORTFOLIO_BRIDGE,
  POSTER_BRIDGE,
} from './bridge-protocol';
import type { PosterExporter } from './poster-export';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]).buffer;

const posterExportMessage = {
  channel: POSTER_BRIDGE.channel,
  version: POSTER_BRIDGE.version,
  projectId: POSTER_BRIDGE.projectId,
  type: POSTER_BRIDGE.fileExportType,
  requestId: 'request-1',
  filename: 'poster.png',
  mimeType: POSTER_BRIDGE.mimeType,
  size: png.byteLength,
  data: png,
};

const blackboxHapticMessage = {
  channel: BLACKBOX_BRIDGE.channel,
  type: BLACKBOX_BRIDGE.type,
  protocolVersion: BLACKBOX_BRIDGE.protocolVersion,
  project: BLACKBOX_BRIDGE.project,
  event: 'light',
} as const;

const fixture = `
  <div data-runtime-label></div>
  <main data-catalog-view><h1 id="hub-title" tabindex="-1">Hub</h1><div data-project-list></div><button data-open-system-dialog>Systeminformationen</button></main>
  <section data-project-view hidden>
    <button data-close-project>Close</button>
    <p data-active-project-kicker></p>
    <h2 data-active-project-title></h2>
    <div data-frame-host></div>
    <div data-load-state><span data-load-title></span></div>
    <div data-error-state hidden>
      <h3 data-error-title tabindex="-1"></h3>
      <p data-error-description></p>
      <button data-retry-project>Retry</button>
      <button data-error-close-project>Back</button>
    </div>
  </section>
  <dialog data-system-dialog>
    <span data-system-product></span>
    <span data-system-version></span>
    <span data-system-runtime></span>
    <ul data-system-projects></ul>
    <button data-close-system-dialog>Close</button>
  </dialog>
  <p data-announcer></p>
  <template data-project-card>
    <article>
      <button data-project-button>
        <span data-project-index></span>
        <span data-project-status></span>
        <strong data-project-title></strong>
        <span data-project-description></span>
      </button>
    </article>
  </template>
`;

describe('HubController', () => {
  let controller: HubController;
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = fixture;
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    controller = new HubController({
      document,
      window,
      runtime: createHubRuntime('web'),
      loadTimeoutMs: 60_000,
    });
    controller.init();
  });

  afterEach(() => {
    vi.useRealTimers();
    controller.destroy();
    document.body.replaceChildren();
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('opens a project with one accessible iframe and the web source', () => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-project-button][data-project-id="portfolio"]',
    );
    button?.click();

    const frame = document.querySelector<HTMLIFrameElement>(
      '[data-project-frame]',
    );
    expect(controller.getActiveProjectId()).toBe('portfolio');
    expect(frame?.title).toContain('Portfolio');
    expect(frame?.title).toContain('Orbit');
    expect(frame?.getAttribute('src')).toBe(
      'https://ki-node.github.io/portfolio/',
    );
    expect(frame?.getAttribute('sandbox')).not.toContain(
      'allow-top-navigation',
    );
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-downloads');
    expect(frame?.hasAttribute('allow')).toBe(false);
    expect(
      document.querySelector('[data-project-view]')?.hasAttribute('hidden'),
    ).toBe(false);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(frame?.hasAttribute('hidden')).toBe(false);
    expect(frame?.dataset.frameState).toBe('loading');
    expect(frame?.getAttribute('aria-hidden')).toBe('true');
    expect(frame?.hasAttribute('inert')).toBe(true);
    expect(frame?.tabIndex).toBe(-1);
    expect(
      document.querySelector('[data-frame-host]')?.getAttribute('aria-busy'),
    ).toBe('true');
    expect(
      document.querySelector('[data-load-state]')?.hasAttribute('hidden'),
    ).toBe(false);
    expect(document.activeElement).toBe(
      document.querySelector('[data-close-project]'),
    );
  });

  it('grants only Poster the sandbox and Permissions Policy needed by browser fallbacks', () => {
    controller.openProject('poster', null, 'none');
    const posterFrame = document.querySelector<HTMLIFrameElement>('iframe');

    expect(posterFrame?.getAttribute('sandbox')).toContain('allow-downloads');
    expect(posterFrame?.getAttribute('sandbox')).not.toContain(
      'allow-top-navigation',
    );
    expect(posterFrame?.getAttribute('allow')).toBe('clipboard-write');
    expect(posterFrame?.dataset.frameState).toBe('loading');
    expect(posterFrame?.getAttribute('aria-hidden')).toBe('true');
    expect(posterFrame?.hasAttribute('inert')).toBe(true);
    expect(posterFrame?.tabIndex).toBe(-1);
    posterFrame?.dispatchEvent(new Event('load'));
    expect(posterFrame?.dataset.frameState).toBe('ready');
    expect(posterFrame?.hasAttribute('aria-hidden')).toBe(false);
    expect(posterFrame?.hasAttribute('inert')).toBe(false);

    controller.openProject('blackbox', null, 'none');
    const blackboxFrame = document.querySelector<HTMLIFrameElement>('iframe');
    expect(blackboxFrame?.getAttribute('sandbox')).not.toContain(
      'allow-downloads',
    );
    expect(blackboxFrame?.hasAttribute('allow')).toBe(false);
  });

  it('makes the laid-out iframe accessible only after load', () => {
    controller.openProject('portfolio', null, 'none');
    const frame = document.querySelector<HTMLIFrameElement>('iframe');

    frame?.dispatchEvent(new Event('load'));

    expect(frame?.dataset.frameState).toBe('ready');
    expect(frame?.hasAttribute('aria-hidden')).toBe(false);
    expect(frame?.hasAttribute('inert')).toBe(false);
    expect(frame?.hasAttribute('tabindex')).toBe(false);
    expect(
      document.querySelector('[data-frame-host]')?.hasAttribute('aria-busy'),
    ).toBe(false);
    expect(
      document.querySelector('[data-load-state]')?.hasAttribute('hidden'),
    ).toBe(true);
  });

  it('opens, closes and reopens the native Portfolio build', () => {
    controller.destroy();
    controller = new HubController({
      document,
      window,
      runtime: createHubRuntime('native'),
      loadTimeoutMs: 60_000,
    });
    controller.init();

    const button = document.querySelector<HTMLElement>(
      '[data-project-button][data-project-id="portfolio"]',
    );
    controller.openProject('portfolio', button, 'none');
    const firstFrame = document.querySelector<HTMLIFrameElement>('iframe');

    expect(firstFrame?.getAttribute('src')).toBe(
      './projects/portfolio/index.html',
    );
    controller.closeProject('none');
    expect(firstFrame?.isConnected).toBe(false);
    expect(document.activeElement).toBe(button);

    controller.openProject('portfolio', button, 'none');
    const secondFrame = document.querySelector<HTMLIFrameElement>('iframe');
    expect(secondFrame).not.toBe(firstFrame);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('opens, closes and reopens the native Poster build without retaining its iframe', () => {
    controller.destroy();
    controller = new HubController({
      document,
      window,
      runtime: createHubRuntime('native'),
      loadTimeoutMs: 60_000,
    });
    controller.init();

    const button = document.querySelector<HTMLElement>(
      '[data-project-button][data-project-id="poster"]',
    );
    controller.openProject('poster', button, 'none');
    const firstFrame = document.querySelector<HTMLIFrameElement>('iframe');

    expect(firstFrame?.getAttribute('src')).toBe(
      './projects/poster/index.html',
    );
    expect(firstFrame?.getAttribute('sandbox')).not.toContain(
      'allow-downloads',
    );
    expect(firstFrame?.getAttribute('allow')).toBe('clipboard-write');
    controller.closeProject('none');
    expect(firstFrame?.isConnected).toBe(false);
    expect(document.activeElement).toBe(button);

    controller.openProject('poster', button, 'none');
    const secondFrame = document.querySelector<HTMLIFrameElement>('iframe');
    expect(secondFrame).not.toBe(firstFrame);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('switches Portfolio to Poster and back with exactly one fresh iframe', () => {
    controller.openProject('portfolio', null, 'none');
    const portfolioFrame = document.querySelector<HTMLIFrameElement>('iframe');
    controller.openProject('poster', null, 'none');
    const posterFrame = document.querySelector<HTMLIFrameElement>('iframe');
    controller.openProject('portfolio', null, 'none');
    const nextPortfolioFrame =
      document.querySelector<HTMLIFrameElement>('iframe');

    expect(portfolioFrame?.isConnected).toBe(false);
    expect(posterFrame?.isConnected).toBe(false);
    expect(nextPortfolioFrame).not.toBe(portfolioFrame);
    expect(nextPortfolioFrame?.dataset.projectFrame).toBe('portfolio');
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('closes a project, removes its iframe and resets the view', () => {
    controller.openProject('portfolio', null, 'none');
    document.querySelector<HTMLButtonElement>('[data-close-project]')?.click();

    expect(controller.getActiveProjectId()).toBeNull();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(
      document.querySelector('[data-project-view]')?.hasAttribute('hidden'),
    ).toBe(true);
    expect(
      document.querySelector('[data-catalog-view]')?.hasAttribute('hidden'),
    ).toBe(false);
  });

  it('restores focus to the project card after closing', () => {
    const button = document.querySelector<HTMLElement>(
      '[data-project-button][data-project-id="poster"]',
    );
    expect(button).not.toBeNull();
    controller.openProject('poster', button, 'none');
    controller.closeProject();

    expect(document.activeElement).toBe(button);
  });

  it('restores the catalog scroll position after closing a project', () => {
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 12 });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 840,
    });
    const button = document.querySelector<HTMLElement>(
      '[data-project-button][data-project-id="portfolio"]',
    );

    controller.openProject('portfolio', button, 'none');
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    controller.closeProject('none');

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: 'auto',
      left: 12,
      top: 840,
    });
    expect(document.activeElement).toBe(button);
  });

  it('closes the project when browser history returns to the catalog URL', () => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-project-button][data-project-id="blackbox"]',
    );
    button?.click();
    expect(controller.getActiveProjectId()).toBe('blackbox');

    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));

    expect(controller.getActiveProjectId()).toBeNull();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(document.activeElement).toBe(button);
  });

  it('removes the old iframe before switching projects', () => {
    controller.openProject('portfolio', null, 'none');
    const firstFrame = document.querySelector('iframe');
    controller.openProject('poster', null, 'none');

    expect(firstFrame?.isConnected).toBe(false);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(document.querySelector('iframe')?.dataset.projectFrame).toBe(
      'poster',
    );
  });

  it('can initialize directly from a project query', () => {
    controller.destroy();
    window.history.replaceState({}, '', '/?project=portfolio');
    controller = new HubController({
      document,
      window,
      runtime: createHubRuntime('web'),
      loadTimeoutMs: 60_000,
    });
    controller.init();

    expect(controller.getActiveProjectId()).toBe('portfolio');
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('shows the accessible error state when the iframe reports a failure', () => {
    controller.openProject('poster', null, 'none');
    document.querySelector('iframe')?.dispatchEvent(new Event('error'));

    expect(
      document.querySelector('[data-error-state]')?.hasAttribute('hidden'),
    ).toBe(false);
    expect(document.querySelector('iframe')?.hasAttribute('hidden')).toBe(
      false,
    );
    expect(
      document.querySelector('iframe')?.getAttribute('data-frame-state'),
    ).toBe('error');
    expect(document.querySelector('iframe')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(document.querySelector('iframe')?.hasAttribute('inert')).toBe(true);
  });

  it('retries an error with a new laid-out but initially inaccessible iframe', () => {
    controller.openProject('portfolio', null, 'none');
    const failedFrame = document.querySelector<HTMLIFrameElement>('iframe');
    failedFrame?.dispatchEvent(new Event('error'));

    document.querySelector<HTMLButtonElement>('[data-retry-project]')?.click();
    const retryFrame = document.querySelector<HTMLIFrameElement>('iframe');

    expect(retryFrame).not.toBe(failedFrame);
    expect(failedFrame?.isConnected).toBe(false);
    expect(retryFrame?.hasAttribute('hidden')).toBe(false);
    expect(retryFrame?.dataset.frameState).toBe('loading');
    expect(retryFrame?.getAttribute('aria-hidden')).toBe('true');
    expect(retryFrame?.hasAttribute('inert')).toBe(true);
    expect(
      document.querySelector('[data-load-state]')?.hasAttribute('hidden'),
    ).toBe(false);
    expect(document.activeElement).toBe(
      document.querySelector('[data-close-project]'),
    );
  });

  it('keeps an error terminal when the failed iframe reports a late load', () => {
    controller.openProject('portfolio', null, 'none');
    const failedFrame = document.querySelector<HTMLIFrameElement>('iframe');
    failedFrame?.dispatchEvent(new Event('error'));
    failedFrame?.dispatchEvent(new Event('load'));

    expect(controller.getFrameSessionState()).toBe('error');
    expect(failedFrame?.dataset.frameState).toBe('error');
    expect(
      document.querySelector('[data-error-state]')?.hasAttribute('hidden'),
    ).toBe(false);
    expect(document.activeElement).toBe(
      document.querySelector('[data-error-title]'),
    );
    expect(document.querySelector('[data-announcer]')?.textContent).toBe(
      'Portfolio konnte nicht geladen werden.',
    );
  });

  it('creates only one new session for repeated retry requests', () => {
    controller.openProject('portfolio', null, 'none');
    document.querySelector('iframe')?.dispatchEvent(new Event('error'));
    const retry = document.querySelector<HTMLButtonElement>(
      '[data-retry-project]',
    );

    retry?.click();
    const retryFrame = document.querySelector('iframe');
    retry?.click();

    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(document.querySelector('iframe')).toBe(retryFrame);
    expect(controller.getFrameSessionState()).toBe('loading');
  });

  it('ignores late load and error events from a replaced iframe', () => {
    controller.openProject('poster', null, 'none');
    const oldFrame = document.querySelector<HTMLIFrameElement>('iframe');
    oldFrame?.dispatchEvent(new Event('error'));
    document.querySelector<HTMLButtonElement>('[data-retry-project]')?.click();
    const currentFrame = document.querySelector<HTMLIFrameElement>('iframe');

    oldFrame?.dispatchEvent(new Event('load'));
    oldFrame?.dispatchEvent(new Event('error'));

    expect(oldFrame?.isConnected).toBe(false);
    expect(currentFrame).not.toBe(oldFrame);
    expect(controller.getFrameSessionState()).toBe('loading');
    expect(currentFrame?.dataset.frameState).toBe('loading');
  });

  it('enters the error state when the current loading session times out', () => {
    vi.useFakeTimers();
    controller.destroy();
    controller = new HubController({
      document,
      window,
      runtime: createHubRuntime('web'),
      loadTimeoutMs: 20,
    });
    controller.init();
    controller.openProject('blackbox', null, 'none');

    vi.advanceTimersByTime(20);

    expect(controller.getFrameSessionState()).toBe('error');
    expect(document.querySelector('iframe')?.dataset.frameState).toBe('error');
  });

  it('uses the shared close path from the error view and restores focus', () => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-project-button][data-project-id="portfolio"]',
    );
    button?.click();
    document.querySelector('iframe')?.dispatchEvent(new Event('error'));

    document
      .querySelector<HTMLButtonElement>('[data-error-close-project]')
      ?.click();

    expect(controller.getActiveProjectId()).toBeNull();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(document.activeElement).toBe(button);
  });

  it('reinitializes from the URL without duplicate cards or listeners', () => {
    window.history.replaceState({}, '', '/?project=blackbox');
    controller.destroy();
    controller.destroy();
    controller.init();
    controller.init();

    expect(controller.getActiveProjectId()).toBe('blackbox');
    expect(document.querySelectorAll('[data-project-list] > *')).toHaveLength(
      3,
    );
    expect(document.querySelectorAll('iframe')).toHaveLength(1);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.getActiveProjectId()).toBe('blackbox');
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('accepts allowed links only from the active native Portfolio iframe', () => {
    controller.destroy();
    const openExternalUrl = vi.fn(async () => true);
    const runtime = {
      ...createHubRuntime('native'),
      openExternalUrl,
    } satisfies HubRuntime;
    controller = new HubController({
      document,
      window,
      runtime,
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('portfolio', null, 'none');
    const frame = document.querySelector<HTMLIFrameElement>('iframe');
    const message = {
      projectId: PORTFOLIO_BRIDGE.projectId,
      protocolVersion: PORTFOLIO_BRIDGE.protocolVersion,
      type: PORTFOLIO_BRIDGE.openExternalLinkType,
      url: 'mailto:test@example.com',
    };

    window.dispatchEvent(
      new MessageEvent('message', { data: message, source: window }),
    );
    expect(openExternalUrl).not.toHaveBeenCalled();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        source: frame?.contentWindow ?? null,
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...message, url: 'https://example.com/path' },
        source: frame?.contentWindow ?? null,
      }),
    );

    expect(openExternalUrl).toHaveBeenNthCalledWith(
      1,
      'mailto:test@example.com',
    );
    expect(openExternalUrl).toHaveBeenNthCalledWith(
      2,
      'https://example.com/path',
    );
  });

  it('rejects invalid bridge payloads and removes the listener when closing', () => {
    controller.destroy();
    const openExternalUrl = vi.fn(async () => true);
    const runtime = {
      ...createHubRuntime('native'),
      openExternalUrl,
    } satisfies HubRuntime;
    controller = new HubController({
      document,
      window,
      runtime,
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('portfolio', null, 'none');
    const firstFrame = document.querySelector<HTMLIFrameElement>('iframe');
    const message = {
      projectId: PORTFOLIO_BRIDGE.projectId,
      protocolVersion: PORTFOLIO_BRIDGE.protocolVersion,
      type: PORTFOLIO_BRIDGE.openExternalLinkType,
      url: 'javascript:alert(1)',
    };

    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        source: firstFrame?.contentWindow ?? null,
      }),
    );
    expect(openExternalUrl).not.toHaveBeenCalled();

    controller.closeProject('none');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...message, url: 'https://example.com' },
        source: firstFrame?.contentWindow ?? null,
      }),
    );
    expect(openExternalUrl).not.toHaveBeenCalled();

    controller.openProject('portfolio', null, 'none');
    const secondFrame = document.querySelector<HTMLIFrameElement>('iframe');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...message, url: 'https://example.com' },
        source: secondFrame?.contentWindow ?? null,
      }),
    );
    expect(openExternalUrl).toHaveBeenCalledOnce();
  });

  it('dispatches every valid Blackbox semantic event exactly once', () => {
    controller.destroy();
    const triggerProjectHaptic = vi
      .fn<HubRuntime['triggerProjectHaptic']>()
      .mockResolvedValue(true);
    const runtime = {
      ...createHubRuntime('native'),
      triggerProjectHaptic,
    } satisfies HubRuntime;
    controller = new HubController({
      document,
      window,
      runtime,
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('blackbox', null, 'none');
    const frame = document.querySelector<HTMLIFrameElement>('iframe');

    for (const event of BLACKBOX_BRIDGE.events) {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { ...blackboxHapticMessage, event },
          source: frame?.contentWindow ?? null,
        }),
      );
    }

    expect(triggerProjectHaptic).toHaveBeenCalledTimes(6);
    expect(triggerProjectHaptic.mock.calls.map(([event]) => event)).toEqual(
      BLACKBOX_BRIDGE.events,
    );
  });

  it('rejects invalid Blackbox messages and foreign window sources', () => {
    controller.destroy();
    const triggerProjectHaptic = vi
      .fn<HubRuntime['triggerProjectHaptic']>()
      .mockResolvedValue(true);
    const runtime = {
      ...createHubRuntime('native'),
      triggerProjectHaptic,
    } satisfies HubRuntime;
    controller = new HubController({
      document,
      window,
      runtime,
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('blackbox', null, 'none');
    const frame = document.querySelector<HTMLIFrameElement>('iframe');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: blackboxHapticMessage,
        source: window,
      }),
    );
    for (const data of [
      { ...blackboxHapticMessage, channel: 'orbit-project-bridge' },
      { ...blackboxHapticMessage, type: 'file-export' },
      { ...blackboxHapticMessage, protocolVersion: 2 },
      { ...blackboxHapticMessage, project: 'poster' },
      { ...blackboxHapticMessage, event: 'custom' },
      { ...blackboxHapticMessage, event: 42 },
      { ...blackboxHapticMessage, nativeDuration: 100 },
      { channel: BLACKBOX_BRIDGE.channel },
    ]) {
      window.dispatchEvent(
        new MessageEvent('message', {
          data,
          source: frame?.contentWindow ?? null,
        }),
      );
    }

    expect(triggerProjectHaptic).not.toHaveBeenCalled();
  });

  it('drops old Blackbox sources after close and does not duplicate listeners', () => {
    controller.destroy();
    const triggerProjectHaptic = vi
      .fn<HubRuntime['triggerProjectHaptic']>()
      .mockResolvedValue(true);
    const runtime = {
      ...createHubRuntime('native'),
      triggerProjectHaptic,
    } satisfies HubRuntime;
    controller = new HubController({
      document,
      window,
      runtime,
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('blackbox', null, 'none');
    const firstFrame = document.querySelector<HTMLIFrameElement>('iframe');
    const firstSource = firstFrame?.contentWindow ?? null;
    controller.closeProject('none');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: blackboxHapticMessage,
        source: firstSource,
      }),
    );
    controller.openProject('portfolio', null, 'none');
    const portfolioFrame = document.querySelector<HTMLIFrameElement>('iframe');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: blackboxHapticMessage,
        source: portfolioFrame?.contentWindow ?? null,
      }),
    );
    controller.openProject('blackbox', null, 'none');
    const secondFrame = document.querySelector<HTMLIFrameElement>('iframe');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: blackboxHapticMessage,
        source: secondFrame?.contentWindow ?? null,
      }),
    );

    expect(firstFrame?.isConnected).toBe(false);
    expect(portfolioFrame?.isConnected).toBe(false);
    expect(secondFrame).not.toBe(firstFrame);
    expect(triggerProjectHaptic).toHaveBeenCalledOnce();
    expect(triggerProjectHaptic).toHaveBeenCalledWith('light');
  });

  it('contains rejected native Blackbox haptic promises', async () => {
    controller.destroy();
    const triggerProjectHaptic = vi
      .fn<HubRuntime['triggerProjectHaptic']>()
      .mockRejectedValue(new Error('Unavailable'));
    const runtime = {
      ...createHubRuntime('native'),
      triggerProjectHaptic,
    } satisfies HubRuntime;
    controller = new HubController({
      document,
      window,
      runtime,
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('blackbox', null, 'none');
    const frame = document.querySelector<HTMLIFrameElement>('iframe');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: blackboxHapticMessage,
        source: frame?.contentWindow ?? null,
      }),
    );
    await Promise.resolve();

    expect(triggerProjectHaptic).toHaveBeenCalledOnce();
  });

  it('accepts one PNG export only from the active native Poster iframe', async () => {
    controller.destroy();
    const exportPng = vi
      .fn<PosterExporter['exportPng']>()
      .mockResolvedValue('shared');
    controller = new HubController({
      document,
      window,
      runtime: createHubRuntime('native'),
      posterExporter: { exportPng },
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('poster', null, 'none');
    const frame = document.querySelector<HTMLIFrameElement>('iframe');
    const postMessage = frame?.contentWindow
      ? vi.spyOn(frame.contentWindow, 'postMessage')
      : undefined;

    window.dispatchEvent(
      new MessageEvent('message', {
        data: posterExportMessage,
        source: window,
      }),
    );
    expect(exportPng).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: posterExportMessage,
        source: frame?.contentWindow ?? null,
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: posterExportMessage,
        source: frame?.contentWindow ?? null,
      }),
    );
    await vi.waitFor(() => expect(exportPng).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: POSTER_BRIDGE.fileExportResultType,
          requestId: 'request-1',
          status: 'shared',
        }),
        '*',
      ),
    );
  });

  it('rejects invalid Poster envelopes, MIME types and oversized files', async () => {
    controller.destroy();
    const exportPng = vi
      .fn<PosterExporter['exportPng']>()
      .mockResolvedValue('shared');
    controller = new HubController({
      document,
      window,
      runtime: createHubRuntime('native'),
      posterExporter: { exportPng },
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('poster', null, 'none');
    const frame = document.querySelector<HTMLIFrameElement>('iframe');

    for (const data of [
      { ...posterExportMessage, projectId: 'portfolio' },
      { ...posterExportMessage, version: 2 },
      { ...posterExportMessage, mimeType: 'text/html' },
      { ...posterExportMessage, size: POSTER_BRIDGE.maxExportBytes + 1 },
    ]) {
      window.dispatchEvent(
        new MessageEvent('message', {
          data,
          source: frame?.contentWindow ?? null,
        }),
      );
    }

    await Promise.resolve();
    expect(exportPng).not.toHaveBeenCalled();
  });

  it('announces Poster capability and removes its export listener on close', () => {
    controller.destroy();
    const exportPng = vi
      .fn<PosterExporter['exportPng']>()
      .mockResolvedValue('shared');
    controller = new HubController({
      document,
      window,
      runtime: createHubRuntime('native'),
      posterExporter: { exportPng },
      loadTimeoutMs: 60_000,
    });
    controller.init();
    controller.openProject('poster', null, 'none');
    const frame = document.querySelector<HTMLIFrameElement>('iframe');
    const postMessage = frame?.contentWindow
      ? vi.spyOn(frame.contentWindow, 'postMessage')
      : undefined;
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: POSTER_BRIDGE.channel,
          version: POSTER_BRIDGE.version,
          projectId: POSTER_BRIDGE.projectId,
          type: POSTER_BRIDGE.projectReadyType,
        },
        source: frame?.contentWindow ?? null,
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: POSTER_BRIDGE.hostReadyType,
        capabilities: ['file-export'],
      }),
      '*',
    );

    controller.closeProject('none');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: posterExportMessage,
        source: frame?.contentWindow ?? null,
      }),
    );
    expect(exportPng).not.toHaveBeenCalled();
  });
});
