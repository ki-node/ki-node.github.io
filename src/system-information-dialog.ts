import { createSystemInformation } from './system-information';
import type { RuntimeKind } from './runtime';
import type { DocumentScrollLockHandle } from './document-scroll-lock';

interface SystemInformationDialogOptions {
  readonly document: Document;
  readonly runtimeKind: RuntimeKind;
  readonly scrollLock: DocumentScrollLockHandle;
}

/** Owns the accessible, non-personal system-information dialog. */
export class SystemInformationDialog {
  private readonly dialog: HTMLDialogElement;
  private readonly openButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly product: HTMLElement;
  private readonly version: HTMLElement;
  private readonly runtime: HTMLElement;
  private readonly projectList: HTMLElement;
  private readonly scrollLock: DocumentScrollLockHandle;
  private readonly information;
  private initialized = false;
  private scrollLocked = false;
  private returnFocus: HTMLElement | null = null;

  public constructor(options: SystemInformationDialogOptions) {
    this.dialog = this.requireElement(options.document, '[data-system-dialog]');
    this.openButton = this.requireElement(
      options.document,
      '[data-open-system-dialog]',
    );
    this.closeButton = this.requireElement(
      this.dialog,
      '[data-close-system-dialog]',
    );
    this.product = this.requireElement(this.dialog, '[data-system-product]');
    this.version = this.requireElement(this.dialog, '[data-system-version]');
    this.runtime = this.requireElement(this.dialog, '[data-system-runtime]');
    this.projectList = this.requireElement(
      this.dialog,
      '[data-system-projects]',
    );
    this.scrollLock = options.scrollLock;
    this.information = createSystemInformation(options.runtimeKind);
  }

  public init(): void {
    if (this.initialized) return;
    this.render();
    this.openButton.addEventListener('click', this.handleOpen);
    this.closeButton.addEventListener('click', this.handleClose);
    this.dialog.addEventListener('close', this.handleClosed);
    this.initialized = true;
  }

  public destroy(): void {
    if (!this.initialized) return;
    this.openButton.removeEventListener('click', this.handleOpen);
    this.closeButton.removeEventListener('click', this.handleClose);
    this.dialog.removeEventListener('close', this.handleClosed);
    if (this.dialog.open) this.dialog.close();
    this.releaseScrollLock();
    this.returnFocus = null;
    this.initialized = false;
  }

  private readonly handleOpen = () => {
    if (this.dialog.open) return;
    this.returnFocus = this.openButton;
    this.scrollLock.lock();
    this.scrollLocked = true;
    try {
      this.dialog.showModal();
      this.closeButton.focus({ preventScroll: true });
    } catch {
      this.releaseScrollLock();
      this.returnFocus = null;
    }
  };

  private readonly handleClose = () => this.dialog.close();

  private readonly handleClosed = () => {
    this.releaseScrollLock();
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  };

  private releaseScrollLock(): void {
    if (!this.scrollLocked) return;
    this.scrollLocked = false;
    this.scrollLock.unlock();
  }

  private render(): void {
    this.product.textContent = this.information.product;
    this.version.textContent = this.information.version;
    this.runtime.textContent = this.information.runtime;
    const fragment = this.projectList.ownerDocument.createDocumentFragment();
    for (const project of this.information.projects) {
      const item = this.projectList.ownerDocument.createElement('li');
      const title = this.projectList.ownerDocument.createElement('strong');
      const repository = this.projectList.ownerDocument.createElement('span');
      const commit = this.projectList.ownerDocument.createElement('code');
      title.textContent = project.title;
      repository.textContent = project.repository;
      commit.textContent = project.commit;
      item.append(title, repository, commit);
      fragment.append(item);
    }
    this.projectList.replaceChildren(fragment);
  }

  private requireElement<T extends Element>(
    root: ParentNode,
    selector: string,
  ): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`System dialog is missing "${selector}".`);
    return element;
  }
}
