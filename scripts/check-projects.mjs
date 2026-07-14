import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createProjectProvenance, loadProjectLock } from './project-lock.mjs';
import { validateEmbeddedProject } from './validate-embedded-project.mjs';

export async function checkProjects(repositoryRoot = process.cwd()) {
    const lock = await loadProjectLock(repositoryRoot);

    for (const project of lock.projects) {
        const target = path.resolve(repositoryRoot, project.targetPath);
        await validateEmbeddedProject(target);

        const filename = path.join(target, 'ki-node-project.json');
        let provenance;
        try {
            provenance = JSON.parse(await readFile(filename, 'utf8'));
        } catch (error) {
            throw new Error(
                `Could not read ${path.relative(repositoryRoot, filename)}.`,
                {
                    cause: error,
                },
            );
        }

        const expected = createProjectProvenance(project);
        if (JSON.stringify(provenance) !== JSON.stringify(expected)) {
            throw new Error(
                `${path.relative(repositoryRoot, filename)} does not match projects.lock.json.`,
            );
        }
    }

    return lock.projects.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const count = await checkProjects();
        console.log(
            `Validated ${String(count)} locked embedded project build(s).`,
        );
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
