import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { ESLint } from 'eslint';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..');
const derivedDataRoot = path.join(repositoryRoot, 'ios', 'DerivedData');
const regressionDirectory = path.join(
    derivedDataRoot,
    'orbit-eslint-regression',
);
const generatedFile = path.join(regressionDirectory, 'generated.js');

try {
    await mkdir(regressionDirectory, { recursive: true });
    await writeFile(generatedFile, 'const staleXcodeOutput = ;\n');

    const eslint = new ESLint({ cwd: repositoryRoot });
    if (!(await eslint.isPathIgnored(generatedFile))) {
        throw new Error('ESLint must ignore files below ios/DerivedData/.');
    }
    if (
        await eslint.isPathIgnored(
            path.join(repositoryRoot, 'ios', 'App', 'source-regression.ts'),
        )
    ) {
        throw new Error(
            'ESLint must continue to inspect source files below ios/.',
        );
    }

    await execFileAsync(
        process.execPath,
        [
            path.join(
                repositoryRoot,
                'node_modules',
                'eslint',
                'bin',
                'eslint.js',
            ),
            '.',
        ],
        { cwd: repositoryRoot },
    );
    console.log(
        'ESLint ignores DerivedData while keeping iOS source paths eligible.',
    );
} finally {
    await rm(regressionDirectory, { recursive: true, force: true });
    await rm(derivedDataRoot, { force: true }).catch(() => undefined);
}
