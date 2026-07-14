import { describe, expect, it } from 'vitest';

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
});
