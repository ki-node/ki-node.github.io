import './style.css';

import { triggerMediumHaptic } from './haptics';

/**
 * Returns a required app-shell element or fails fast for invalid markup.
 *
 * @param selector CSS selector for the required element.
 * @returns The matching element.
 */
function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(
      `The app shell is missing the required "${selector}" element.`,
    );
  }

  return element;
}

const hapticsButton = requireElement<HTMLButtonElement>(
  '[data-haptics-button]',
);
const status = requireElement<HTMLElement>('[data-status]');

/**
 * Handles a haptics request and announces the result to assistive technology.
 */
async function handleHapticsRequest(): Promise<void> {
  hapticsButton.disabled = true;
  hapticsButton.setAttribute('aria-busy', 'true');

  const wasTriggered = await triggerMediumHaptic();

  status.textContent = wasTriggered
    ? 'Mittleres haptisches Feedback ausgelöst.'
    : 'Haptik ist nur in der nativen App verfügbar.';
  hapticsButton.disabled = false;
  hapticsButton.removeAttribute('aria-busy');
}

hapticsButton.addEventListener('click', () => {
  void handleHapticsRequest();
});
