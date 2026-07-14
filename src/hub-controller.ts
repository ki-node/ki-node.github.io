import {
  PROJECT_CATALOG,
  assertValidProjectCatalog,
  isProjectAvailable,
  type HubProject,
  type ProjectId,
} from './projects';
import type { HubRuntime } from './runtime';

interface HubControllerOptions {
  readonly document: Document;
  readonly window: Window;
  readonly runtime: HubRuntime;
  readonly catalog?: readonly HubProject[];
  readonly loadTimeoutMs?: number;
}

interface FrameSession {
  readonly element: HTMLIFrameElement;
  readonly onError: () => void;
  readonly onLoad: () => void;
  readonly timeout: number;
}

type HistoryMode = 'none' | 'push' | 'replace';

const HISTORY_MARKER = 'kiNodeHubProject';

/** Owns project rendering, iframe isolation, focus and minimal History API state. */
export class HubController {
  private readonly document: Document;
  private readonly window: Window;
  private readonly runtime: HubRuntime;
  private readonly catalog: readonly HubProject[];
  private readonly loadTimeoutMs: number;
  private readonly catalogView: HTMLElement;
  private readonly projectView: HTMLElement;
  private readonly projectList: HTMLElement;
  private readonly frameHost: HTMLElement;
  private readonly loadState: HTMLElement;
  private readonly errorState: HTMLElement;
  private readonly activeTitle: HTMLElement;
  private readonly activeKicker: HTMLElement;
  private readonly loadTitle: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly retryButton: HTMLButtonElement;
  private readonly runtimeLabel: HTMLElement;
  private readonly announcer: HTMLElement;
  private readonly catalogHeading: HTMLElement;
  private initialized = false;
  private activeProject: HubProject | null = null;
  private frameSession: FrameSession | null = null;
  private returnFocus: HTMLElement | null = null;
  private activeHistoryOwned = false;

  public constructor(options: HubControllerOptions) {
    this.document = options.document;
    this.window = options.window;
    this.runtime = options.runtime;
    this.catalog = options.catalog ?? PROJECT_CATALOG;
    this.loadTimeoutMs = options.loadTimeoutMs ?? 12_000;
    assertValidProjectCatalog(this.catalog);

    this.catalogView = this.requireElement('[data-catalog-view]');
    this.projectView = this.requireElement('[data-project-view]');
    this.projectList = this.requireElement('[data-project-list]');
    this.frameHost = this.requireElement('[data-frame-host]');
    this.loadState = this.requireElement('[data-load-state]');
    this.errorState = this.requireElement('[data-error-state]');
    this.activeTitle = this.requireElement('[data-active-project-title]');
    this.activeKicker = this.requireElement('[data-active-project-kicker]');
    this.loadTitle = this.requireElement('[data-load-title]');
    this.closeButton = this.requireElement('[data-close-project]');
    this.retryButton = this.requireElement('[data-retry-project]');
    this.runtimeLabel = this.requireElement('[data-runtime-label]');
    this.announcer = this.requireElement('[data-announcer]');
    this.catalogHeading = this.requireElement('#hub-title');
  }

  public init(): void {
    if (this.initialized) return;

    this.renderCatalog();
    this.runtimeLabel.textContent = this.runtime.label;
    this.projectList.addEventListener('click', this.handleProjectListClick);
    this.closeButton.addEventListener('click', this.handleCloseClick);
    this.retryButton.addEventListener('click', this.handleRetryClick);
    this.window.addEventListener('popstate', this.handlePopState);
    this.initialized = true;

    const requestedProject = this.projectIdFromLocation();
    if (requestedProject) {
      this.openProject(requestedProject, null, 'none');
    }
  }

  public destroy(): void {
    if (!this.initialized) return;

    this.projectList.removeEventListener('click', this.handleProjectListClick);
    this.closeButton.removeEventListener('click', this.handleCloseClick);
    this.retryButton.removeEventListener('click', this.handleRetryClick);
    this.window.removeEventListener('popstate', this.handlePopState);
    this.removeFrame();
    this.resetProjectState(false);
    this.initialized = false;
  }

  public openProject(
    projectId: ProjectId,
    trigger: HTMLElement | null = null,
    historyMode: HistoryMode = 'push',
  ): void {
    const project = this.catalog.find(
      (candidate) => candidate.id === projectId,
    );
    if (!project || !isProjectAvailable(project)) return;

    const replacesOpenProject = this.activeProject !== null;
    this.removeFrame();
    this.activeProject = project;
    this.returnFocus = trigger ?? this.returnFocus;
    this.catalogView.hidden = true;
    this.projectView.hidden = false;
    this.document.body.classList.add('is-project-open');
    this.activeTitle.textContent = project.title;
    this.activeKicker.textContent =
      this.runtime.kind === 'native' ? 'Lokaler App-Build' : 'Web-Vorschau';
    this.loadTitle.textContent = `${project.title} wird geladen`;
    this.setLoadingState();
    this.createFrame(project);

    const effectiveMode =
      replacesOpenProject && historyMode === 'push' ? 'replace' : historyMode;
    if (effectiveMode !== 'none')
      this.writeProjectHistory(project.id, effectiveMode);
    else this.activeHistoryOwned = this.historyOwns(project.id);

    this.closeButton.focus({ preventScroll: true });
    this.announcer.textContent = `${project.title} geöffnet.`;
    if (trigger) void this.runtime.triggerOpenFeedback();
  }

  public closeProject(historyMode: 'auto' | 'none' = 'auto'): void {
    if (!this.activeProject) return;

    const title = this.activeProject.title;
    const focusTarget = this.returnFocus;
    const shouldNavigateBack =
      historyMode === 'auto' && this.activeHistoryOwned;

    this.removeFrame();
    this.resetProjectState(true);
    this.announcer.textContent = `${title} geschlossen. Projektübersicht angezeigt.`;

    if (historyMode === 'auto') {
      if (shouldNavigateBack) this.window.history.back();
      else this.clearProjectFromUrl();
    }

    if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
    else this.catalogHeading.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  public getActiveProjectId(): ProjectId | null {
    return this.activeProject?.id ?? null;
  }

  private readonly handleProjectListClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-project-button]');
    const projectId = button?.dataset.projectId as ProjectId | undefined;
    if (button && projectId) this.openProject(projectId, button);
  };

  private readonly handleCloseClick = () => this.closeProject();

  private readonly handleRetryClick = () => {
    if (!this.activeProject) return;
    this.removeFrame();
    this.setLoadingState();
    this.createFrame(this.activeProject);
  };

  private readonly handlePopState = () => {
    const requestedProject = this.projectIdFromLocation();
    if (requestedProject) {
      if (requestedProject !== this.activeProject?.id) {
        this.openProject(requestedProject, null, 'none');
      }
      return;
    }

    this.closeProject('none');
  };

  private renderCatalog(): void {
    const template = this.requireElement<HTMLTemplateElement>(
      '[data-project-card]',
    );
    const fragment = this.document.createDocumentFragment();

    this.catalog.forEach((project, index) => {
      const card = template.content.firstElementChild?.cloneNode(true);
      if (!(card instanceof HTMLElement))
        throw new Error('Project card template is invalid.');

      card.dataset.projectId = project.id;
      const button = this.requireElement<HTMLElement>(
        '[data-project-button]',
        card,
      );
      button.dataset.projectId = project.id;
      button.setAttribute(
        'aria-label',
        `${project.title} öffnen: ${project.description}`,
      );
      this.requireElement('[data-project-index]', card).textContent = String(
        index + 1,
      ).padStart(2, '0');
      this.requireElement('[data-project-status]', card).textContent =
        project.status === 'preview'
          ? 'Vorschau'
          : project.status === 'active'
            ? 'Bereit'
            : 'Inaktiv';
      this.requireElement('[data-project-title]', card).textContent =
        project.title;
      this.requireElement('[data-project-description]', card).textContent =
        project.description;

      if (!isProjectAvailable(project)) {
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('disabled', '');
      }
      fragment.append(card);
    });

    this.projectList.replaceChildren(fragment);
  }

  private createFrame(project: HubProject): void {
    const frame = this.document.createElement('iframe');
    frame.title = `${project.title} – Projektvorschau in ki-node`;
    frame.src = this.runtime.resolveProjectSource(project);
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute(
      'sandbox',
      'allow-forms allow-modals allow-same-origin allow-scripts',
    );
    frame.setAttribute('data-project-frame', project.id);
    frame.hidden = true;

    const onLoad = () => {
      if (this.frameSession?.element !== frame) return;
      this.window.clearTimeout(this.frameSession.timeout);
      this.loadState.hidden = true;
      this.errorState.hidden = true;
      frame.hidden = false;
      this.announcer.textContent = `${project.title} ist bereit.`;
    };
    const onError = () => this.showFrameError(frame);
    frame.addEventListener('load', onLoad, { once: true });
    frame.addEventListener('error', onError, { once: true });

    const timeout = this.window.setTimeout(
      () => this.showFrameError(frame),
      this.loadTimeoutMs,
    );
    this.frameSession = { element: frame, onError, onLoad, timeout };
    this.frameHost.append(frame);
  }

  private showFrameError(frame: HTMLIFrameElement): void {
    if (this.frameSession?.element !== frame) return;
    this.window.clearTimeout(this.frameSession.timeout);
    frame.hidden = true;
    this.loadState.hidden = true;
    this.errorState.hidden = false;
    this.announcer.textContent = 'Projekt konnte nicht geladen werden.';
  }

  private removeFrame(): void {
    if (!this.frameSession) return;
    const { element, onError, onLoad, timeout } = this.frameSession;
    this.window.clearTimeout(timeout);
    element.removeEventListener('load', onLoad);
    element.removeEventListener('error', onError);
    element.remove();
    this.frameSession = null;
  }

  private setLoadingState(): void {
    this.loadState.hidden = false;
    this.errorState.hidden = true;
  }

  private resetProjectState(restoreCatalog: boolean): void {
    this.activeProject = null;
    this.activeHistoryOwned = false;
    this.activeTitle.textContent = 'Projekt';
    this.activeKicker.textContent = 'Vorschau';
    this.loadState.hidden = true;
    this.errorState.hidden = true;
    this.projectView.hidden = true;
    if (restoreCatalog) this.catalogView.hidden = false;
    this.document.body.classList.remove('is-project-open');
  }

  private projectIdFromLocation(): ProjectId | null {
    const value = new URL(this.window.location.href).searchParams.get(
      'project',
    );
    const project = this.catalog.find(
      (candidate) => candidate.id === value && isProjectAvailable(candidate),
    );
    return project?.id ?? null;
  }

  private writeProjectHistory(
    projectId: ProjectId,
    mode: Exclude<HistoryMode, 'none'>,
  ): void {
    const url = new URL(this.window.location.href);
    url.searchParams.set('project', projectId);
    const state = { [HISTORY_MARKER]: true, projectId };
    if (mode === 'replace') this.window.history.replaceState(state, '', url);
    else this.window.history.pushState(state, '', url);
    this.activeHistoryOwned = true;
  }

  private historyOwns(projectId: ProjectId): boolean {
    const state = this.window.history.state as Record<string, unknown> | null;
    return state?.[HISTORY_MARKER] === true && state.projectId === projectId;
  }

  private clearProjectFromUrl(): void {
    const url = new URL(this.window.location.href);
    url.searchParams.delete('project');
    this.window.history.replaceState({}, '', url);
  }

  private requireElement<T extends Element = HTMLElement>(
    selector: string,
    root: ParentNode = this.document,
  ): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`The Hub shell is missing "${selector}".`);
    return element;
  }
}
