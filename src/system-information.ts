import packageMetadata from '../package.json';
import projectLock from '../projects.lock.json';

import type { ProjectId } from './projects';
import type { RuntimeKind } from './runtime';

export interface SystemProjectInformation {
  readonly id: ProjectId;
  readonly title: string;
  readonly repository: string;
  readonly commit: string;
}

export interface SystemInformation {
  readonly product: 'Orbit';
  readonly version: string;
  readonly runtime: 'Web-Hub' | 'Native iOS-App';
  readonly projects: readonly SystemProjectInformation[];
}

const projectTitles = {
  portfolio: 'Portfolio',
  poster: 'Poster',
  blackbox: 'Blackbox',
} as const satisfies Record<ProjectId, string>;

const projectIds = Object.keys(projectTitles) as ProjectId[];

/** Builds non-personal diagnostics from the package and project lock files. */
export function createSystemInformation(
  runtimeKind: RuntimeKind,
): SystemInformation {
  const projects = projectLock.projects.map((project) => {
    if (!projectIds.includes(project.id as ProjectId)) {
      throw new Error(
        `Unknown project id in projects.lock.json: ${project.id}`,
      );
    }
    if (!/^[0-9a-f]{40}$/u.test(project.commit)) {
      throw new Error(
        `Invalid project pin in projects.lock.json: ${project.id}`,
      );
    }
    const id = project.id as ProjectId;
    return {
      id,
      title: projectTitles[id],
      repository: project.repository,
      commit: project.commit,
    };
  });

  if (
    projects.length !== projectIds.length ||
    projects.some((project, index) => project.id !== projectIds[index])
  ) {
    throw new Error(
      'projects.lock.json must contain the three Orbit projects in catalog order.',
    );
  }

  return {
    product: 'Orbit',
    version: packageMetadata.version,
    runtime: runtimeKind === 'native' ? 'Native iOS-App' : 'Web-Hub',
    projects,
  };
}
