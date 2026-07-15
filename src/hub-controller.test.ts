import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HubController } from './hub-controller';
import { createHubRuntime } from './runtime';
import type { HubRuntime } from './runtime';
import { PORTFOLIO_BRIDGE } from './bridge-protocol';

const fixture = `
  <div data-runtime-label></div>
  <main data-catalog-view><h1 id="hub-title" tabindex="-1">Hub</h1><div data-project-list></div></main>
  <section data-project-view hidden>
    <button data-close-project>Close</button>
    <p data-active-project-kicker></p>
    <h2 data-active-project-title></h2>
    <div data-frame-host></div>
    <div data-load-state><span data-load-title></span></div>
    <div data-error-state hidden></div>
    <button data-retry-project>Retry</button>
  </section>
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
});
