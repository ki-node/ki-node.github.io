import { describe, expect, it, vi } from 'vitest';

import { ApplicationLifecycle } from './application-lifecycle';

describe('ApplicationLifecycle', () => {
  it('initializes and destroys idempotently without duplicating listeners', () => {
    const application = { init: vi.fn(), destroy: vi.fn() };
    const reveal = vi.fn();
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const lifecycle = new ApplicationLifecycle({
      application,
      reveal,
      targetWindow: window,
    });

    lifecycle.init();
    lifecycle.init();
    expect(application.init).toHaveBeenCalledOnce();
    expect(reveal).toHaveBeenCalledOnce();
    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'pagehide'),
    ).toHaveLength(1);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'pageshow'),
    ).toHaveLength(1);

    lifecycle.destroy();
    lifecycle.destroy();
    expect(application.destroy).toHaveBeenCalledOnce();
    expect(
      removeEventListener.mock.calls.filter(([type]) => type === 'pagehide'),
    ).toHaveLength(1);
    expect(
      removeEventListener.mock.calls.filter(([type]) => type === 'pageshow'),
    ).toHaveLength(1);
  });

  it('suspends on pagehide and restores on pageshow without replaying launch UI', () => {
    const application = { init: vi.fn(), destroy: vi.fn() };
    const reveal = vi.fn();
    const lifecycle = new ApplicationLifecycle({ application, reveal });
    lifecycle.init();

    window.dispatchEvent(
      new PageTransitionEvent('pagehide', { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent('pagehide', { persisted: true }),
    );
    expect(application.destroy).toHaveBeenCalledOnce();

    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
    expect(application.init).toHaveBeenCalledTimes(2);
    expect(reveal).toHaveBeenCalledOnce();

    document.dispatchEvent(new Event('visibilitychange'));
    expect(application.destroy).toHaveBeenCalledOnce();
    lifecycle.destroy();
  });
});
