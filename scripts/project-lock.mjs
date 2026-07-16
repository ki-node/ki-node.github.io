import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const PROJECT_LOCK_FILENAME = 'projects.lock.json';

const projectDefinitions = new Map([
    [
        'portfolio',
        {
            repository: 'ki-node/portfolio',
            buildCommand: 'npm run build:embedded',
            buildOutput: 'dist-embedded',
            targetPath: 'public/projects/portfolio',
        },
    ],
    [
        'poster',
        {
            repository: 'ki-node/poster',
            buildCommand: 'npm run build:embedded',
            buildOutput: 'dist-embedded',
            targetPath: 'public/projects/poster',
            sourceProvenance: {
                formatVersion: 1,
                projectId: 'poster',
                buildContext: 'embedded',
            },
        },
    ],
    [
        'blackbox',
        {
            repository: 'ki-node/blackbox',
            buildCommand: 'npm run build:embedded',
            buildOutput: 'dist-embedded',
            targetPath: 'public/projects/blackbox',
            sourceProvenance: {
                project: 'blackbox',
                context: 'embedded',
                formatVersion: 1,
            },
        },
    ],
]);
const repositoryPattern = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/u;
const commitPattern = /^[0-9a-f]{40}$/u;

const isSafeRelativePath = (value) => {
    if (typeof value !== 'string' || value === '') return false;

    const normalized = path.posix.normalize(value);
    return (
        normalized === value &&
        !path.posix.isAbsolute(value) &&
        value !== '..' &&
        !value.startsWith('../')
    );
};

export function validateProjectLock(value) {
    const errors = [];

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return ['lock: expected an object'];
    }

    if (value.version !== 1) errors.push('lock.version: expected 1');
    if (!Array.isArray(value.projects) || value.projects.length === 0) {
        errors.push('lock.projects: expected at least one project');
        return errors;
    }

    const ids = new Set();

    value.projects.forEach((project, index) => {
        const field = (name) => `lock.projects[${String(index)}].${name}`;

        if (typeof project !== 'object' || project === null) {
            errors.push(`lock.projects[${String(index)}]: expected an object`);
            return;
        }

        const definition = projectDefinitions.get(project.id);
        if (!definition) {
            errors.push(`${field('id')}: unsupported project id`);
        } else if (ids.has(project.id)) {
            errors.push(`${field('id')}: duplicate project id`);
        }
        ids.add(project.id);

        if (
            typeof project.repository !== 'string' ||
            !repositoryPattern.test(project.repository)
        ) {
            errors.push(`${field('repository')}: expected owner/repository`);
        } else if (definition && project.repository !== definition.repository) {
            errors.push(`${field('repository')}: unexpected repository`);
        }

        if (
            typeof project.commit !== 'string' ||
            !commitPattern.test(project.commit)
        ) {
            errors.push(`${field('commit')}: expected a full 40-character SHA`);
        }

        if (!definition || project.buildCommand !== definition.buildCommand) {
            errors.push(`${field('buildCommand')}: unsupported build command`);
        }

        if (!isSafeRelativePath(project.buildOutput)) {
            errors.push(
                `${field('buildOutput')}: expected a safe relative path`,
            );
        } else if (
            definition &&
            project.buildOutput !== definition.buildOutput
        ) {
            errors.push(`${field('buildOutput')}: unexpected build output`);
        }

        if (
            !isSafeRelativePath(project.targetPath) ||
            !project.targetPath.startsWith('public/projects/')
        ) {
            errors.push(
                `${field('targetPath')}: expected a path below public/projects`,
            );
        } else if (definition && project.targetPath !== definition.targetPath) {
            errors.push(`${field('targetPath')}: unexpected target path`);
        }
    });

    return errors;
}

export function assertValidProjectLock(value) {
    const errors = validateProjectLock(value);
    if (errors.length > 0) {
        throw new Error(
            `Invalid ${PROJECT_LOCK_FILENAME}:\n${errors.join('\n')}`,
        );
    }

    return value;
}

export async function loadProjectLock(repositoryRoot = process.cwd()) {
    const filename = path.join(repositoryRoot, PROJECT_LOCK_FILENAME);
    let value;

    try {
        value = JSON.parse(await readFile(filename, 'utf8'));
    } catch (error) {
        throw new Error(`Could not read ${PROJECT_LOCK_FILENAME}.`, {
            cause: error,
        });
    }

    return assertValidProjectLock(value);
}

export function createProjectProvenance(project) {
    if (project.id === 'blackbox') {
        return {
            project: 'blackbox',
            repository: project.repository,
            commit: project.commit,
            buildCommand: project.buildCommand,
            context: 'embedded',
            formatVersion: 1,
        };
    }

    return {
        schemaVersion: 1,
        id: project.id,
        repository: project.repository,
        commit: project.commit,
        buildCommand: project.buildCommand,
    };
}

export function expectedSourceProvenance(project) {
    const definition = projectDefinitions.get(project.id);
    if (!definition?.sourceProvenance) return null;

    return {
        ...definition.sourceProvenance,
        repository: project.repository,
        commit: project.commit,
        buildCommand: project.buildCommand,
    };
}
