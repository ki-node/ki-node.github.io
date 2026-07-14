import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HubController } from './hub-controller';
import { createHubRuntime } from './runtime';

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

  beforeEach(() => {
    document.body.innerHTML = fixture;
    window.history.replaceState({}, '', '/');
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
    expect(frame?.getAttribute('src')).toContain('source=web');
    expect(frame?.getAttribute('sandbox')).not.toContain(
      'allow-top-navigation',
    );
    expect(
      document.querySelector('[data-project-view]')?.hasAttribute('hidden'),
    ).toBe(false);
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
    expect(document.querySelector('iframe')?.hasAttribute('hidden')).toBe(true);
  });
});
