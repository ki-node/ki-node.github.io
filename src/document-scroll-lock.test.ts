import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentScrollLock } from './document-scroll-lock';

describe('DocumentScrollLock', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    document.body.className = '';
    Object.defineProperty(window, 'scrollX', {
      configurable: true,
      value: 23,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 417,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 385,
    });
  });

  it('reference-counts locks and restores the exact position and styles', () => {
    document.documentElement.setAttribute('style', 'color: red');
    document.body.setAttribute('style', 'padding-right: 7px; color: blue');
    document.body.className = 'existing-state';
    const originalRootStyle = document.documentElement.getAttribute('style');
    const originalBodyStyle = document.body.getAttribute('style');
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    const lock = new DocumentScrollLock({ document, window });

    lock.lock();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-417px');
    expect(document.body.style.left).toBe('-23px');
    expect(document.body.style.paddingRight).toBe('calc(22px)');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.className).toBe('existing-state');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 900,
    });
    lock.lock();
    lock.unlock();
    expect(document.body.style.position).toBe('fixed');
    expect(scrollTo).not.toHaveBeenCalled();

    lock.unlock();
    expect(document.documentElement.getAttribute('style')).toBe(
      originalRootStyle,
    );
    expect(document.body.getAttribute('style')).toBe(originalBodyStyle);
    expect(document.body.className).toBe('existing-state');
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith(23, 417);

    lock.unlock();
    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('destroy releases an active lock without leaving inline state', () => {
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    const lock = new DocumentScrollLock({ document, window });

    lock.lock();
    lock.destroy();
    lock.destroy();

    expect(document.body.hasAttribute('style')).toBe(false);
    expect(document.documentElement.hasAttribute('style')).toBe(false);
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith(23, 417);
  });
});
