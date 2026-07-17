import { describe, expect, it } from 'vitest';

import projectLock from '../projects.lock.json';
import { createSystemInformation } from './system-information';

describe('system information', () => {
  it('uses version 1.0.0 and every full pin directly from projects.lock.json', () => {
    const information = createSystemInformation('web');

    expect(information).toMatchObject({
      product: 'Orbit',
      version: '1.0.0',
      runtime: 'Web-Hub',
    });
    expect(
      information.projects.map(({ id, repository, commit }) => ({
        id,
        repository,
        commit,
      })),
    ).toEqual(
      projectLock.projects.map(({ id, repository, commit }) => ({
        id,
        repository,
        commit,
      })),
    );
    expect(
      information.projects.every(({ commit }) => commit.length === 40),
    ).toBe(true);
    expect(JSON.stringify(information)).not.toMatch(
      /timestamp|device|user|signing|development_team|\/Users\//iu,
    );
  });

  it('labels the native runtime without exposing device information', () => {
    expect(createSystemInformation('native').runtime).toBe('Native iOS-App');
  });
});
