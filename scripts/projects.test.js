// @vitest-environment node

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkProjects } from './check-projects.mjs';
import {
  createProjectProvenance,
  expectedSourceProvenance,
  loadProjectLock,
  validateProjectLock,
} from './project-lock.mjs';
import { validateEmbeddedProject } from './validate-embedded-project.mjs';

const lockedProject = {
  id: 'portfolio',
  repository: 'ki-node/portfolio',
  commit: '07c6b7eb09bd3d0577d49df657fed2d58097f018',
  buildCommand: 'npm run build:embedded',
  buildOutput: 'dist-embedded',
  targetPath: 'public/projects/portfolio',
};
const lockedPoster = {
  id: 'poster',
  repository: 'ki-node/poster',
  commit: '755de154b6426c912d7af0caab9e45c75aa4fc7b',
  buildCommand: 'npm run build:embedded',
  buildOutput: 'dist-embedded',
  targetPath: 'public/projects/poster',
};
const lockedBlackbox = {
  id: 'blackbox',
  repository: 'ki-node/blackbox',
  commit: '48245e4e93451844317c693f171dc7158deeab26',
  buildCommand: 'npm run build:embedded',
  buildOutput: 'dist-embedded',
  targetPath: 'public/projects/blackbox',
};
const temporaryDirectories = [];

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'ki-node-project-test-'),
  );
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('project lock', () => {
  it('pins Portfolio, Poster and Blackbox in catalog order', async () => {
    const repositoryRoot = path.resolve(import.meta.dirname, '..');
    const lock = await loadProjectLock(repositoryRoot);

    expect(lock.projects).toEqual([
      lockedProject,
      lockedPoster,
      lockedBlackbox,
    ]);
    await expect(checkProjects(repositoryRoot)).resolves.toBe(3);
  });

  it('accepts both pinned commits and rejects abbreviated SHAs', () => {
    expect(
      validateProjectLock({
        version: 1,
        projects: [lockedProject, lockedPoster, lockedBlackbox],
      }),
    ).toEqual([]);
    expect(
      validateProjectLock({
        version: 1,
        projects: [{ ...lockedProject, commit: 'f34ca2d9' }],
      }),
    ).toContain('lock.projects[0].commit: expected a full 40-character SHA');
  });

  it('validates Poster build provenance before Hub normalization', () => {
    expect(expectedSourceProvenance(lockedProject)).toBeNull();
    expect(expectedSourceProvenance(lockedPoster)).toEqual({
      formatVersion: 1,
      projectId: 'poster',
      buildContext: 'embedded',
      repository: 'ki-node/poster',
      commit: '755de154b6426c912d7af0caab9e45c75aa4fc7b',
      buildCommand: 'npm run build:embedded',
    });
  });

  it('preserves Blackbox source provenance in both checked-in copies', () => {
    const provenance = {
      project: 'blackbox',
      repository: 'ki-node/blackbox',
      commit: '48245e4e93451844317c693f171dc7158deeab26',
      buildCommand: 'npm run build:embedded',
      context: 'embedded',
      formatVersion: 1,
    };

    expect(expectedSourceProvenance(lockedBlackbox)).toEqual(provenance);
    expect(createProjectProvenance(lockedBlackbox)).toEqual(provenance);
  });

  it('rejects commands and target paths outside the allowlist', () => {
    const errors = validateProjectLock({
      version: 1,
      projects: [
        {
          ...lockedProject,
          repository: 'someone/else',
          buildCommand: 'npm run build:embedded && echo unsafe',
          buildOutput: 'node_modules',
          targetPath: '../outside',
        },
      ],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        'lock.projects[0].repository: unexpected repository',
        'lock.projects[0].buildCommand: unsupported build command',
        'lock.projects[0].buildOutput: unexpected build output',
        'lock.projects[0].targetPath: expected a path below public/projects',
      ]),
    );
  });
});

describe('embedded output validation', () => {
  it('resolves nested local assets without network access', async () => {
    const directory = await createTemporaryDirectory();
    await mkdir(path.join(directory, 'assets', 'fonts'), { recursive: true });
    await writeFile(
      path.join(directory, 'index.html'),
      '<link rel="stylesheet" href="./assets/app.css"><script src="./assets/app.js"></script>',
    );
    await writeFile(
      path.join(directory, 'assets', 'app.css'),
      '@font-face{src:url("./fonts/local.woff2")}body{background:url("../icon.svg")}',
    );
    await writeFile(
      path.join(directory, 'assets', 'app.js'),
      'document.title="ok";',
    );
    await writeFile(
      path.join(directory, 'assets', 'fonts', 'local.woff2'),
      'font',
    );
    await writeFile(path.join(directory, 'icon.svg'), '<svg></svg>');

    await expect(validateEmbeddedProject(directory)).resolves.toMatchObject({
      files: 5,
    });
  });

  it('rejects network assets, absolute Portfolio paths and missing files', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(
      path.join(directory, 'index.html'),
      '<script src="https://example.com/app.js"></script><img src="/portfolio/missing.png">',
    );

    await expect(validateEmbeddedProject(directory)).rejects.toThrow(
      'Active network resource',
    );

    await writeFile(
      path.join(directory, 'index.html'),
      '<img src="/portfolio/missing.png">',
    );
    await expect(validateEmbeddedProject(directory)).rejects.toThrow(
      'Absolute active asset path',
    );

    await writeFile(
      path.join(directory, 'index.html'),
      '<img src="./missing.png">',
    );
    await expect(validateEmbeddedProject(directory)).rejects.toThrow(
      'Missing active asset',
    );
  });

  it('verifies checked provenance against the lock file', async () => {
    const repository = await createTemporaryDirectory();
    const target = path.join(repository, lockedProject.targetPath);
    await mkdir(target, { recursive: true });
    await writeFile(
      path.join(repository, 'projects.lock.json'),
      `${JSON.stringify({ version: 1, projects: [lockedProject] })}\n`,
    );
    await writeFile(
      path.join(target, 'index.html'),
      '<!doctype html><title>Test</title>',
    );
    await writeFile(
      path.join(target, 'ki-node-project.json'),
      `${JSON.stringify(createProjectProvenance(lockedProject), null, 2)}\n`,
    );

    await expect(checkProjects(repository)).resolves.toBe(1);
  });
});
