import { spawn } from 'node:child_process';
import {
    cp,
    mkdir,
    mkdtemp,
    readFile,
    rename,
    rm,
    writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createProjectProvenance, loadProjectLock } from './project-lock.mjs';
import { validateEmbeddedProject } from './validate-embedded-project.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const commandDefinitions = new Map([
    [
        'npm run build:embedded',
        { command: 'npm', args: ['run', 'build:embedded'] },
    ],
]);

const run = (command, args, options = {}) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: {
                ...process.env,
                CI: 'true',
                npm_config_audit: 'false',
                npm_config_cache:
                    process.env.npm_config_cache ??
                    path.join(os.tmpdir(), 'ki-node-project-sync-npm-cache'),
                npm_config_fund: 'false',
            },
            stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
            shell: false,
        });
        let stdout = '';
        child.stdout?.setEncoding('utf8');
        child.stdout?.on('data', (chunk) => {
            stdout += chunk;
        });
        child.once('error', (error) => reject(error));
        child.once('exit', (code, signal) => {
            if (code === 0) resolve(stdout.trim());
            else {
                reject(
                    new Error(
                        `${command} failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}.`,
                    ),
                );
            }
        });
    });

const replaceDirectory = async (source, target) => {
    const parent = path.dirname(target);
    const staging = path.join(
        parent,
        `.sync-${path.basename(target)}-${String(process.pid)}`,
    );
    const backup = `${staging}-backup`;
    await mkdir(parent, { recursive: true });
    await rm(staging, { recursive: true, force: true });
    await rm(backup, { recursive: true, force: true });

    try {
        await cp(source, staging, { recursive: true, force: true });
        await validateEmbeddedProject(staging);

        const hadTarget = await rename(target, backup)
            .then(() => true)
            .catch((error) => {
                if (error?.code === 'ENOENT') return false;
                throw error;
            });

        try {
            await rename(staging, target);
            if (hadTarget) await rm(backup, { recursive: true, force: true });
        } catch (error) {
            if (hadTarget) await rename(backup, target);
            throw error;
        }
    } finally {
        await rm(staging, { recursive: true, force: true });
        await rm(backup, { recursive: true, force: true });
    }
};

const syncProject = async (project, temporaryRoot) => {
    const sourceDirectory = path.join(temporaryRoot, project.id, 'source');
    const remoteUrl = `https://github.com/${project.repository}.git`;
    console.log(
        `\nSyncing ${project.id} from ${project.repository}@${project.commit}`,
    );

    await mkdir(path.dirname(sourceDirectory), { recursive: true });
    await run('git', ['init', '--quiet', sourceDirectory], {
        cwd: temporaryRoot,
    });
    await run('git', [
        '-C',
        sourceDirectory,
        'remote',
        'add',
        'origin',
        remoteUrl,
    ]);
    await run('git', [
        '-C',
        sourceDirectory,
        'fetch',
        '--quiet',
        '--depth=1',
        'origin',
        project.commit,
    ]);
    await run('git', [
        '-C',
        sourceDirectory,
        'checkout',
        '--quiet',
        '--detach',
        'FETCH_HEAD',
    ]);

    const checkedOutCommit = await run(
        'git',
        ['-C', sourceDirectory, 'rev-parse', 'HEAD'],
        { capture: true },
    );
    if (checkedOutCommit !== project.commit) {
        throw new Error(
            `Expected ${project.commit}, but Git checked out ${checkedOutCommit}.`,
        );
    }

    await run('npm', ['ci'], { cwd: sourceDirectory });
    const build = commandDefinitions.get(project.buildCommand);
    if (!build)
        throw new Error(`Unsupported build command: ${project.buildCommand}`);
    await run(build.command, build.args, { cwd: sourceDirectory });

    const outputDirectory = path.resolve(sourceDirectory, project.buildOutput);
    await validateEmbeddedProject(outputDirectory);
    await writeFile(
        path.join(outputDirectory, 'ki-node-project.json'),
        `${JSON.stringify(createProjectProvenance(project), null, 2)}\n`,
        'utf8',
    );

    const target = path.resolve(repositoryRoot, project.targetPath);
    await replaceDirectory(outputDirectory, target);

    const provenance = JSON.parse(
        await readFile(path.join(target, 'ki-node-project.json'), 'utf8'),
    );
    if (provenance.commit !== project.commit) {
        throw new Error(
            `Generated provenance for ${project.id} is inconsistent.`,
        );
    }
    console.log(`Updated ${path.relative(repositoryRoot, target)}.`);
};

let temporaryRoot;
try {
    const lock = await loadProjectLock(repositoryRoot);
    temporaryRoot = await mkdtemp(
        path.join(os.tmpdir(), 'ki-node-project-sync-'),
    );
    for (const project of lock.projects) {
        await syncProject(project, temporaryRoot);
    }
    console.log('\nAll locked projects were synchronized successfully.');
} catch (error) {
    console.error('\nProject synchronization failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
} finally {
    if (temporaryRoot) {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
}
