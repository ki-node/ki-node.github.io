// @vitest-environment node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const readRepositoryFile = (file) =>
  readFile(path.join(repositoryRoot, file), 'utf8');
const readRepositoryBytes = (file) => readFile(path.join(repositoryRoot, file));

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

    expect(storyboard).toContain('text="Orbit"');
    expect(storyboard).toContain('image="OrbitLaunchMark"');
    expect(storyboard).toContain('id="launch-mark"');
    expect(storyboard).not.toContain('text="ki-node"');
    expect(storyboard).not.toContain('id="bar-one"');
    expect(storyboard).not.toContain('systemBackgroundColor');
  });

  it('uses Orbit consistently as the visible product name', async () => {
    const [capacitorConfig, generatedConfig, infoPlist, hubDocument] =
      await Promise.all([
        readRepositoryFile('capacitor.config.ts'),
        readRepositoryFile('ios/App/App/capacitor.config.json'),
        readRepositoryFile('ios/App/App/Info.plist'),
        readRepositoryFile('index.html'),
      ]);

    expect(capacitorConfig).toContain("appName: 'Orbit'");
    expect(JSON.parse(generatedConfig).appName).toBe('Orbit');
    expect(infoPlist).toContain(
      '<key>CFBundleDisplayName</key>\n\t\t<string>Orbit</string>',
    );
    expect(infoPlist).toContain(
      '<key>CFBundleName</key>\n\t<string>Orbit</string>',
    );
    expect(hubDocument).toContain('<title>Orbit – Projekte</title>');
    expect(hubDocument).toContain('aria-label="Orbit Startseite"');
    expect(hubDocument).not.toContain('>ki-node<');
  });

  it('ships one opaque 1024px Orbit App Store icon', async () => {
    const contents = JSON.parse(
      await readRepositoryFile(
        'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json',
      ),
    );
    const icon = await readRepositoryBytes(
      'ios/App/App/Assets.xcassets/AppIcon.appiconset/Orbit-AppIcon-1024.png',
    );

    expect(contents.images).toEqual([
      expect.objectContaining({
        filename: 'Orbit-AppIcon-1024.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024',
      }),
    ]);
    expect(icon.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(icon.readUInt32BE(16)).toBe(1024);
    expect(icon.readUInt32BE(20)).toBe(1024);
    expect(icon[25]).toBe(2);
    await expect(
      readRepositoryBytes(
        'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
      ),
    ).rejects.toThrow();
  });
});
