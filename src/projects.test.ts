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

  it('integrates Portfolio and Poster while Blackbox remains a mock', () => {
    const [portfolio, poster, blackbox] = PROJECT_CATALOG;

    expect(portfolio).toMatchObject({
      id: 'portfolio',
      embeddedUrl: './projects/portfolio/index.html',
      webUrl: 'https://ki-node.github.io/portfolio/',
      status: 'active',
    });
    expect(poster).toMatchObject({
      id: 'poster',
      embeddedUrl: './projects/poster/index.html',
      webUrl: 'https://ki-node.github.io/poster/',
      framePermissions: ['downloads', 'clipboard-write'],
      status: 'active',
    });
    expect(blackbox.embeddedUrl).toContain('mock-project/index.html');
    expect(blackbox.webUrl).toContain('mock-project/index.html');
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
