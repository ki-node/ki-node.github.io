import { describe, expect, it } from 'vitest';

import {
  PROJECT_CATALOG,
  validateProjectCatalog,
  type HubProject,
} from './projects';

describe('project catalog', () => {
  it('accepts the configured catalog', () => {
    expect(validateProjectCatalog(PROJECT_CATALOG)).toEqual([]);
  });

  it('reports duplicate ids and unsafe project sources', () => {
    const duplicate = {
      ...PROJECT_CATALOG[0],
      embeddedUrl: 'javascript:alert(1)',
    } satisfies HubProject;
    const catalog = [PROJECT_CATALOG[0], duplicate];

    expect(validateProjectCatalog(catalog)).toEqual(
      expect.arrayContaining([
        'project[1]: duplicate id "portfolio"',
        'project[1]: embeddedUrl is not safe',
      ]),
    );
  });
});
