// @vitest-environment node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const readRepositoryFile = (file) =>
  readFile(path.join(repositoryRoot, file), 'utf8');

describe('generated iOS plugin configuration', () => {
  it('contains only the consciously added local Capacitor plugins', async () => {
    const manifest = await readRepositoryFile(
      'ios/App/CapApp-SPM/Package.swift',
    );

    expect(manifest).toContain('capacitor-swift-pm.git", exact: "8.4.1"');
    expect(manifest).toContain('node_modules/@capacitor/app-launcher');
    expect(manifest).toContain('node_modules/@capacitor/haptics');
    expect(manifest).toContain('node_modules/@capacitor/splash-screen');
    expect(manifest.match(/node_modules\/@capacitor\//gu)).toHaveLength(3);
  });

  it('keeps the remote Swift resolution pinned only to Capacitor 8.4.1', async () => {
    const lock = JSON.parse(
      await readRepositoryFile(
        'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved',
      ),
    );

    expect(lock.pins).toEqual([
      expect.objectContaining({
        identity: 'capacitor-swift-pm',
        location: 'https://github.com/ionic-team/capacitor-swift-pm.git',
        state: expect.objectContaining({
          revision: '2231987d85b8b0b289320b1d0947b4ae8345cde4',
          version: '8.4.1',
        }),
      }),
    ]);
  });

  it('uses the branded static iOS launch screen', async () => {
    const storyboard = await readRepositoryFile(
      'ios/App/App/Base.lproj/LaunchScreen.storyboard',
    );

    expect(storyboard).toContain('text="ki-node"');
    expect(storyboard).toContain('id="launch-mark"');
    expect(storyboard).not.toContain('systemBackgroundColor');
  });
});
