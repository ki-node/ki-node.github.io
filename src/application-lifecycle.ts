export interface LifecycleApplication {
  init(): void;
  destroy(): void;
}

interface ApplicationLifecycleOptions {
  readonly application: LifecycleApplication;
  readonly reveal: () => void | Promise<void>;
  readonly targetWindow?: Window;
}

/**
 * Owns the document-level application lifetime.
 *
 * `pagehide` suspends the application-owned resources while retaining the two
 * lifecycle listeners needed for a back-forward-cache `pageshow`. A direct
 * `destroy()` performs the final teardown and removes those listeners too.
 */
export class ApplicationLifecycle {
  private readonly application: LifecycleApplication;
  private readonly reveal: () => void | Promise<void>;
  private readonly targetWindow: Window;
  private listening = false;
  private active = false;
  private revealed = false;

  public constructor(options: ApplicationLifecycleOptions) {
    this.application = options.application;
    this.reveal = options.reveal;
    this.targetWindow = options.targetWindow ?? window;
  }

  public init(): void {
    if (!this.listening) {
      this.targetWindow.addEventListener('pagehide', this.handlePageHide);
      this.targetWindow.addEventListener('pageshow', this.handlePageShow);
      this.listening = true;
    }
    this.activate();
  }

  public destroy(): void {
    if (this.listening) {
      this.targetWindow.removeEventListener('pagehide', this.handlePageHide);
      this.targetWindow.removeEventListener('pageshow', this.handlePageShow);
      this.listening = false;
    }
    this.suspend();
  }

  private readonly handlePageHide = () => this.suspend();

  private readonly handlePageShow = () => {
    if (this.listening) this.activate();
  };

  private activate(): void {
    if (this.active) return;
    this.application.init();
    this.active = true;
    if (this.revealed) return;
    this.revealed = true;
    void Promise.resolve(this.reveal()).catch(() => undefined);
  }

  private suspend(): void {
    if (!this.active) return;
    this.application.destroy();
    this.active = false;
  }
}
