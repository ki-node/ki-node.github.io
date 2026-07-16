export const PROJECT_CAPABILITIES = ['haptics'] as const;
export const PROJECT_FRAME_PERMISSIONS = [
  'downloads',
  'clipboard-write',
] as const;

export type ProjectCapability = (typeof PROJECT_CAPABILITIES)[number];
export type ProjectFramePermission = (typeof PROJECT_FRAME_PERMISSIONS)[number];
export type ProjectId = 'portfolio' | 'poster' | 'blackbox';
export type ProjectStatus = 'preview' | 'active' | 'disabled';

export interface HubProject {
  readonly id: ProjectId;
  readonly title: string;
  readonly description: string;
  readonly embeddedUrl: string;
  readonly webUrl: string;
  readonly capabilities: readonly ProjectCapability[];
  readonly framePermissions: readonly ProjectFramePermission[];
  readonly status: ProjectStatus;
}

/**
 * Central project catalog. Native and web sources are resolved only by the
 * runtime boundary; UI components consume the selected URL without branching.
 */
export const PROJECT_CATALOG = [
  {
    id: 'portfolio',
    title: 'Portfolio',
    description:
      'Digitale Arbeiten, Systeme und Ideen in einer interaktiven Präsentation.',
    embeddedUrl: './projects/portfolio/index.html',
    webUrl: 'https://ki-node.github.io/portfolio/',
    capabilities: ['haptics'],
    framePermissions: [],
    status: 'active',
  },
  {
    id: 'poster',
    title: 'Poster',
    description:
      'Ein generatives Designinstrument für reproduzierbare visuelle Kompositionen.',
    embeddedUrl: './projects/poster/index.html',
    webUrl: 'https://ki-node.github.io/poster/',
    capabilities: ['haptics'],
    framePermissions: ['downloads', 'clipboard-write'],
    status: 'active',
  },
  {
    id: 'blackbox',
    title: 'Blackbox',
    description:
      'Eine kompakte, atmosphärische Rätselmaschine mit lokalem Fortschritt.',
    embeddedUrl: './projects/blackbox/index.html',
    webUrl: 'https://ki-node.github.io/blackbox/',
    capabilities: ['haptics'],
    framePermissions: [],
    status: 'active',
  },
] as const satisfies readonly HubProject[];

const hasSafeUrl = (value: string) => {
  try {
    const url = new URL(value, 'https://ki-node.github.io/');
    return (
      url.protocol === 'https:' || url.origin === 'https://ki-node.github.io'
    );
  } catch {
    return false;
  }
};

export function validateProjectCatalog(
  catalog: readonly HubProject[],
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  catalog.forEach((project, index) => {
    const path = `project[${String(index)}]`;

    if (!project.id.trim()) errors.push(`${path}: id is required`);
    if (ids.has(project.id))
      errors.push(`${path}: duplicate id "${project.id}"`);
    ids.add(project.id);

    if (!project.title.trim()) errors.push(`${path}: title is required`);
    if (!project.description.trim())
      errors.push(`${path}: description is required`);
    if (!hasSafeUrl(project.embeddedUrl))
      errors.push(`${path}: embeddedUrl is not safe`);
    if (!hasSafeUrl(project.webUrl)) errors.push(`${path}: webUrl is not safe`);

    const capabilities = new Set<ProjectCapability>();
    project.capabilities.forEach((capability) => {
      if (!PROJECT_CAPABILITIES.includes(capability)) {
        errors.push(`${path}: unsupported capability "${capability}"`);
      }
      if (capabilities.has(capability)) {
        errors.push(`${path}: duplicate capability "${capability}"`);
      }
      capabilities.add(capability);
    });

    const framePermissions = new Set<ProjectFramePermission>();
    project.framePermissions.forEach((permission) => {
      if (!PROJECT_FRAME_PERMISSIONS.includes(permission)) {
        errors.push(`${path}: unsupported frame permission "${permission}"`);
      }
      if (framePermissions.has(permission)) {
        errors.push(`${path}: duplicate frame permission "${permission}"`);
      }
      framePermissions.add(permission);
    });
  });

  return errors;
}

export function assertValidProjectCatalog(
  catalog: readonly HubProject[],
): void {
  const errors = validateProjectCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`Invalid project catalog:\n${errors.join('\n')}`);
  }
}

export const isProjectAvailable = (project: HubProject) =>
  project.status !== 'disabled';
