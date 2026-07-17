import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemInformationDialog } from './system-information-dialog';

const fixture = `
  <button data-open-system-dialog>Systeminformationen</button>
  <dialog data-system-dialog aria-labelledby="system-title">
    <h2 id="system-title">Systeminformationen</h2>
    <span data-system-product></span>
    <span data-system-version></span>
    <span data-system-runtime></span>
    <ul data-system-projects></ul>
    <button data-close-system-dialog>Schließen</button>
  </dialog>
`;

describe('SystemInformationDialog', () => {
  let dialogController: SystemInformationDialog;
  let dialog: HTMLDialogElement;

  beforeEach(() => {
    document.body.innerHTML = fixture;
    const dialogElement = document.querySelector<HTMLDialogElement>('dialog');
    if (!dialogElement) throw new Error('Dialog fixture is missing.');
    dialog = dialogElement;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    });
    dialogController = new SystemInformationDialog({
      document,
      runtimeKind: 'native',
    });
    dialogController.init();
  });

  afterEach(() => {
    dialogController.destroy();
    document.body.replaceChildren();
  });

  it('renders the runtime, version, repositories and complete pins', () => {
    expect(document.querySelector('[data-system-product]')?.textContent).toBe(
      'Orbit',
    );
    expect(document.querySelector('[data-system-version]')?.textContent).toBe(
      '1.0.0',
    );
    expect(document.querySelector('[data-system-runtime]')?.textContent).toBe(
      'Native iOS-App',
    );
    expect(document.querySelectorAll('[data-system-projects] li')).toHaveLength(
      3,
    );
    expect(
      document.querySelector('[data-system-projects]')?.textContent,
    ).toContain('ki-node/portfolio');
    for (const code of document.querySelectorAll('code')) {
      expect(code.textContent).toMatch(/^[0-9a-f]{40}$/u);
    }
  });

  it('opens once, closes by button and restores focus to the trigger', () => {
    const opener = document.querySelector<HTMLButtonElement>(
      '[data-open-system-dialog]',
    );
    if (!opener) throw new Error('Dialog opener fixture is missing.');
    opener.focus();
    opener.click();
    opener.click();

    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(
      document.querySelector('[data-close-system-dialog]'),
    );

    document
      .querySelector<HTMLButtonElement>('[data-close-system-dialog]')
      ?.click();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('does not duplicate handlers across repeated lifecycle calls', () => {
    dialogController.init();
    dialogController.destroy();
    dialogController.destroy();
    dialogController.init();

    document
      .querySelector<HTMLButtonElement>('[data-open-system-dialog]')
      ?.click();
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });
});
