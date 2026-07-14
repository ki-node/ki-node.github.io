// @vitest-environment node

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkProjects } from './check-projects.mjs';
import {
  createProjectProvenance,
  loadProjectLock,
  validateProjectLock,
} from './project-lock.mjs';
import { validateEmbeddedProject } from './validate-embedded-project.mjs';

const lockedProject = {
  id: 'portfolio',
  repository: 'ki-node/portfolio',
  commit: 'b4a89e534ee00f723468c5d6dfec4e83efddbdc7',
  buildCommand: 'npm run build:embedded',
  buildOutput: 'dist-embedded',
  targetPath: 'public/projects/portfolio',
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
  it('pins the checked-in Portfolio build to the requested source commit', async () => {
    const repositoryRoot = path.resolve(import.meta.dirname, '..');
    const lock = await loadProjectLock(repositoryRoot);

    expect(lock.projects).toEqual([lockedProject]);
    await expect(checkProjects(repositoryRoot)).resolves.toBe(1);
  });

  it('accepts the pinned Portfolio commit and rejects abbreviated SHAs', () => {
    expect(
      validateProjectLock({ version: 1, projects: [lockedProject] }),
    ).toEqual([]);
    expect(
      validateProjectLock({
        version: 1,
        projects: [{ ...lockedProject, commit: 'f34ca2d9' }],
      }),
    ).toContain('lock.projects[0].commit: expected a full 40-character SHA');
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
