import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectFilename = 'project.pbxproj';

export function findConcreteDevelopmentTeams(content) {
    const findings = [];
    const pattern =
        /^\s*DEVELOPMENT_TEAM(?:\[[^\]]+\])?\s*=\s*(.*?)\s*;\s*$/gmu;

    for (const match of content.matchAll(pattern)) {
        const rawValue = match[1] ?? '';
        const value = rawValue.replace(/^"(.*)"$/u, '$1').trim();

        if (value === '' || value.startsWith('$(') || value.startsWith('${')) {
            continue;
        }

        const line = content.slice(0, match.index).split('\n').length;
        findings.push({ line, value });
    }

    return findings;
}

async function findProjectFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...(await findProjectFiles(entryPath)));
        } else if (entry.name === projectFilename) {
            files.push(entryPath);
        }
    }

    return files;
}

async function checkIosSigning() {
    const iosDirectory = path.resolve('ios');
    const projectFiles = await findProjectFiles(iosDirectory);
    const violations = [];

    for (const file of projectFiles) {
        const content = await readFile(file, 'utf8');

        for (const finding of findConcreteDevelopmentTeams(content)) {
            violations.push({ file, ...finding });
        }
    }

    if (violations.length === 0) {
        console.log(
            'No concrete DEVELOPMENT_TEAM values found in Xcode projects.',
        );
        return;
    }

    console.error(
        'Concrete DEVELOPMENT_TEAM values must not be committed to Xcode project files:',
    );

    for (const violation of violations) {
        console.error(
            `- ${path.relative(process.cwd(), violation.file)}:${violation.line}`,
        );
    }

    process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await checkIosSigning();
}
