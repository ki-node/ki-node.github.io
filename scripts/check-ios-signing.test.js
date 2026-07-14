import { describe, expect, it } from 'vitest';

import { findConcreteDevelopmentTeams } from './check-ios-signing.mjs';

describe('iOS signing guard', () => {
  it('rejects literal Apple team IDs', () => {
    const content = [
      'DEVELOPMENT_TEAM = EXAMPLETEAM;',
      'DEVELOPMENT_TEAM[sdk=iphoneos*] = DEVICEEXAMPLE;',
    ].join('\n');

    expect(findConcreteDevelopmentTeams(content)).toEqual([
      { line: 1, value: 'EXAMPLETEAM' },
      { line: 2, value: 'DEVICEEXAMPLE' },
    ]);
  });

  it('allows absent, empty and variable-based team settings', () => {
    const content = [
      'PRODUCT_NAME = App;',
      'DEVELOPMENT_TEAM = ;',
      'DEVELOPMENT_TEAM = "";',
      'DEVELOPMENT_TEAM = $(inherited);',
      'DEVELOPMENT_TEAM = ${APPLE_TEAM_ID};',
    ].join('\n');

    expect(findConcreteDevelopmentTeams(content)).toEqual([]);
  });
});
