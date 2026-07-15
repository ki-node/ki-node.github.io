import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadProjectLock } from './project-lock.mjs';

const collectFiles = async (directory, prefix = '') => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const relative = path.join(prefix, entry.name);
        if (entry.isDirectory()) {
            files.push(
                ...(await collectFiles(
                    path.join(directory, entry.name),
                    relative,
                )),
            );
        } else if (entry.isFile()) {
            files.push(relative);
        } else {
            throw new Error(
                `Project copies must contain regular files only: ${relative}`,
            );
        }
    }

    return files.sort();
};

export async function assertDirectoriesEqual(source, copy) {
    const sourceFiles = await collectFiles(source);
    const copyFiles = await collectFiles(copy).catch((error) => {
        throw new Error(`Could not read copied project directory ${copy}.`, {
            cause: error,
        });
    });

    if (JSON.stringify(sourceFiles) !== JSON.stringify(copyFiles)) {
        throw new Error(
            `Project file lists differ between ${source} and ${copy}.`,
        );
    }

    for (const filename of sourceFiles) {
        const [sourceContent, copyContent] = await Promise.all([
            readFile(path.join(source, filename)),
            readFile(path.join(copy, filename)),
        ]);
        if (!sourceContent.equals(copyContent)) {
            throw new Error(`Project file differs after copying: ${filename}`);
        }
    }

    return sourceFiles.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const destinationRoot = process.argv[2];
    if (!destinationRoot) {
        console.error(
            'Usage: node scripts/check-project-copy.mjs <projects-destination-root>',
        );
        process.exitCode = 1;
    } else {
        try {
            const lock = await loadProjectLock();
            let total = 0;
            for (const project of lock.projects) {
                const source = path.resolve(project.targetPath);
                const destination = path.resolve(destinationRoot, project.id);
                const count = await assertDirectoriesEqual(source, destination);
                total += count;
                console.log(
                    `Verified ${String(count)} unchanged ${project.id} files in ${destination}.`,
                );
            }
            console.log(
                `Verified ${String(total)} embedded project files across ${String(lock.projects.length)} project(s).`,
            );
        } catch (error) {
            console.error(error instanceof Error ? error.message : error);
            process.exitCode = 1;
        }
    }
}
