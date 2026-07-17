export interface DocumentScrollLockHandle {
  lock(): void;
  unlock(): void;
  destroy(): void;
}

interface DocumentScrollLockOptions {
  readonly document: Document;
  readonly window: Window;
}

interface LockSnapshot {
  readonly bodyStyle: string | null;
  readonly rootStyle: string | null;
  readonly scrollLeft: number;
  readonly scrollTop: number;
}

/**
 * Freezes the document without intercepting touch or zoom gestures.
 *
 * Locks are reference counted so independent modal surfaces can share one
 * instance. The first lock owns the scroll/style snapshot; the final unlock
 * restores it exactly.
 */
export class DocumentScrollLock implements DocumentScrollLockHandle {
  private readonly document: Document;
  private readonly window: Window;
  private depth = 0;
  private snapshot: LockSnapshot | null = null;

  public constructor(options: DocumentScrollLockOptions) {
    this.document = options.document;
    this.window = options.window;
  }

  public lock(): void {
    this.depth += 1;
    if (this.depth !== 1) return;

    const body = this.document.body;
    const root = this.document.documentElement;
    const scrollbarWidth = Math.max(
      0,
      this.window.innerWidth - root.clientWidth,
    );
    this.snapshot = {
      bodyStyle: body.getAttribute('style'),
      rootStyle: root.getAttribute('style'),
      scrollLeft: this.window.scrollX,
      scrollTop: this.window.scrollY,
    };

    const bodyPaddingRight = this.window.getComputedStyle(body).paddingRight;
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    body.style.position = 'fixed';
    body.style.top = `${-this.snapshot.scrollTop}px`;
    body.style.left = `${-this.snapshot.scrollLeft}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `calc(${bodyPaddingRight} + ${scrollbarWidth}px)`;
    }
  }

  public unlock(): void {
    if (this.depth === 0) return;
    this.depth -= 1;
    if (this.depth !== 0) return;
    this.restore();
  }

  public destroy(): void {
    if (this.depth === 0 && !this.snapshot) return;
    this.depth = 0;
    this.restore();
  }

  private restore(): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    this.snapshot = null;

    this.restoreAttribute(this.document.body, 'style', snapshot.bodyStyle);
    this.restoreAttribute(
      this.document.documentElement,
      'style',
      snapshot.rootStyle,
    );

    // The app stylesheet enables smooth scrolling. Temporarily overriding it
    // keeps restoration synchronous and avoids a visible closing animation.
    this.document.documentElement.style.setProperty(
      'scroll-behavior',
      'auto',
      'important',
    );
    try {
      this.window.scrollTo(snapshot.scrollLeft, snapshot.scrollTop);
    } finally {
      this.restoreAttribute(
        this.document.documentElement,
        'style',
        snapshot.rootStyle,
      );
    }
  }

  private restoreAttribute(
    element: Element,
    name: string,
    value: string | null,
  ): void {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
}
