import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const activeLinkRelations = new Set([
    'apple-touch-icon',
    'icon',
    'modulepreload',
    'preload',
    'stylesheet',
]);
const networkProtocolPattern = /^(?:https?:)?\/\//iu;

const getAttribute = (tag, name) => {
    const match = tag.match(
        new RegExp(
            `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
            'iu',
        ),
    );
    return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
};

const splitSrcset = (value) =>
    value
        .split(',')
        .map((candidate) => candidate.trim().split(/\s+/u)[0])
        .filter(Boolean);

export function extractActiveHtmlReferences(html) {
    const references = [];
    const tags = html.match(/<[^>]+>/gu) ?? [];

    for (const tag of tags) {
        const name = tag.match(/^<\s*([a-z0-9-]+)/iu)?.[1]?.toLowerCase();
        if (!name) continue;

        const add = (attribute) => {
            const value = getAttribute(tag, attribute);
            if (value) references.push(value);
        };
        const addSrcset = () => {
            const value = getAttribute(tag, 'srcset');
            if (value) references.push(...splitSrcset(value));
        };

        if (name === 'link') {
            const relations = (getAttribute(tag, 'rel') ?? '')
                .toLowerCase()
                .split(/\s+/u);
            if (
                relations.some((relation) => activeLinkRelations.has(relation))
            ) {
                add('href');
                const imageSrcset = getAttribute(tag, 'imagesrcset');
                if (imageSrcset) {
                    references.push(...splitSrcset(imageSrcset));
                }
            }
        } else if (name === 'script' || name === 'iframe' || name === 'embed') {
            add('src');
        } else if (name === 'img' || name === 'source') {
            add('src');
            addSrcset();
        } else if (name === 'audio' || name === 'video') {
            add('src');
            if (name === 'video') add('poster');
        } else if (name === 'track') {
            add('src');
        } else if (name === 'object') {
            add('data');
        } else if (name === 'input' && getAttribute(tag, 'type') === 'image') {
            add('src');
        }
    }

    return references;
}

export function extractCssReferences(css) {
    const references = [];

    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/giu)) {
        if (match[1]) references.push(match[1].trim());
    }
    for (const match of css.matchAll(
        /@import\s+(?:url\()?\s*["']([^"']+)["']/giu,
    )) {
        if (match[1]) references.push(match[1].trim());
    }

    return references;
}

const collectFiles = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const filename = path.join(directory, entry.name);
        const stats = await lstat(filename);
        if (stats.isSymbolicLink()) {
            throw new Error(
                `Embedded output must not contain symlinks: ${filename}`,
            );
        }
        if (entry.isDirectory()) files.push(...(await collectFiles(filename)));
        else if (entry.isFile()) files.push(filename);
    }

    return files;
};

const isEmbeddedReference = (reference) =>
    reference.startsWith('data:') || reference.startsWith('blob:');

const assertLocalReference = async (reference, sourceFile, outputDirectory) => {
    const decodedReference = decodeURIComponent(reference);
    if (
        reference === '' ||
        decodedReference.startsWith('#') ||
        isEmbeddedReference(reference)
    ) {
        return;
    }
    if (networkProtocolPattern.test(reference)) {
        throw new Error(
            `Active network resource in ${path.relative(outputDirectory, sourceFile)}: ${reference}`,
        );
    }
    if (/^[a-z][a-z0-9+.-]*:/iu.test(reference)) {
        throw new Error(
            `Unsupported active resource protocol in ${path.relative(outputDirectory, sourceFile)}: ${reference}`,
        );
    }
    if (reference.startsWith('/')) {
        throw new Error(
            `Absolute active asset path in ${path.relative(outputDirectory, sourceFile)}: ${reference}`,
        );
    }

    const pathname = decodeURIComponent(reference.split(/[?#]/u)[0] ?? '');
    const resolved = path.resolve(path.dirname(sourceFile), pathname);
    const relative = path.relative(outputDirectory, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(
            `Active asset escapes embedded output in ${path.relative(outputDirectory, sourceFile)}: ${reference}`,
        );
    }

    const stats = await lstat(resolved).catch(() => null);
    if (!stats?.isFile()) {
        throw new Error(
            `Missing active asset in ${path.relative(outputDirectory, sourceFile)}: ${reference}`,
        );
    }
};

const assertNoNetworkApis = (javascript, filename, outputDirectory) => {
    const patterns = [
        /\bfetch\s*\(\s*["'](?:https?:)?\/\//iu,
        /\b(?:EventSource|WebSocket)\s*\(\s*["'](?:https?:)?\/\//iu,
        /\bnavigator\.sendBeacon\s*\(\s*["'](?:https?:)?\/\//iu,
        /\bimport\s*\(\s*["'](?:https?:)?\/\//iu,
        /\.(?:href|src)\s*=\s*["'](?:https?:)?\/\//iu,
    ];
    if (patterns.some((pattern) => pattern.test(javascript))) {
        throw new Error(
            `Active network API in ${path.relative(outputDirectory, filename)}.`,
        );
    }
};

export async function validateEmbeddedProject(outputDirectory) {
    const root = path.resolve(outputDirectory);
    const indexStats = await lstat(path.join(root, 'index.html')).catch(
        () => null,
    );
    if (!indexStats?.isFile()) {
        throw new Error(
            `Embedded project is missing ${path.join(root, 'index.html')}.`,
        );
    }

    const files = await collectFiles(root);
    for (const filename of files) {
        const extension = path.extname(filename).toLowerCase();
        if (!['.css', '.html', '.js', '.mjs'].includes(extension)) continue;

        const content = await readFile(filename, 'utf8');
        let references = [];
        if (extension === '.html') {
            references = extractActiveHtmlReferences(content);
            assertNoNetworkApis(content, filename, root);
            for (const match of content.matchAll(
                /<style\b[^>]*>([\s\S]*?)<\/style>/giu,
            )) {
                if (match[1]) {
                    references.push(...extractCssReferences(match[1]));
                }
            }
            for (const match of content.matchAll(
                /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/giu,
            )) {
                const style = match[1] ?? match[2];
                if (style) references.push(...extractCssReferences(style));
            }
        }
        if (extension === '.css') references = extractCssReferences(content);
        if (extension === '.js' || extension === '.mjs') {
            assertNoNetworkApis(content, filename, root);
        }

        if (
            extension !== '.html' &&
            /(^|["'`(=:\s])\/(?:portfolio|poster|blackbox)\//u.test(content)
        ) {
            throw new Error(
                `Absolute public project dependency in ${path.relative(root, filename)}.`,
            );
        }

        for (const reference of references) {
            await assertLocalReference(reference, filename, root);
        }
    }

    return { files: files.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const outputDirectory = process.argv[2];
    if (!outputDirectory) {
        console.error(
            'Usage: node scripts/validate-embedded-project.mjs <directory>',
        );
        process.exitCode = 1;
    } else {
        try {
            const result = await validateEmbeddedProject(outputDirectory);
            console.log(
                `Validated ${String(result.files)} embedded project files in ${outputDirectory}.`,
            );
        } catch (error) {
            console.error(error instanceof Error ? error.message : error);
            process.exitCode = 1;
        }
    }
}
