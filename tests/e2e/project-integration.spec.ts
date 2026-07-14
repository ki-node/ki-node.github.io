import { expect, test } from '@playwright/test';

const portfolioButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Portfolio öffnen/u });

const expectProjectFillsViewport = async (
  page: import('@playwright/test').Page,
) => {
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.project-toolbar')).toBeVisible();
  await expect(
    page.locator('.site-header:visible, .project-toolbar:visible'),
  ).toHaveCount(1);

  const geometry = await page.evaluate(() => {
    const project = document
      .querySelector<HTMLElement>('[data-project-view]')
      ?.getBoundingClientRect();
    const toolbar = document
      .querySelector<HTMLElement>('.project-toolbar')
      ?.getBoundingClientRect();
    const frame = document
      .querySelector<HTMLIFrameElement>('[data-project-frame]')
      ?.getBoundingClientRect();

    return {
      frameBottom: frame?.bottom ?? -1,
      frameTop: frame?.top ?? -1,
      projectBottom: project?.bottom ?? -1,
      projectTop: project?.top ?? -1,
      toolbarBottom: toolbar?.bottom ?? -1,
      toolbarTop: toolbar?.top ?? -1,
      viewportHeight: window.innerHeight,
    };
  });

  expect(geometry.projectTop).toBeCloseTo(0, 0);
  expect(geometry.toolbarTop).toBeCloseTo(0, 0);
  expect(geometry.frameTop).toBeCloseTo(geometry.toolbarBottom, 0);
  expect(geometry.projectBottom).toBeCloseTo(geometry.viewportHeight, 0);
  expect(geometry.frameBottom).toBeCloseTo(geometry.viewportHeight, 0);
};

const simulateNativeCapacitor = async (
  page: import('@playwright/test').Page,
) => {
  await page.addInitScript(() => {
    const bridgeCalls: unknown[] = [];
    Object.assign(window, { __nativeBridgeCalls: bridgeCalls });
    Object.defineProperty(window, 'CapacitorCustomPlatform', {
      configurable: true,
      value: { name: 'ios' },
      writable: true,
    });
    Object.defineProperty(window, 'Capacitor', {
      configurable: true,
      value: {
        PluginHeaders: [
          {
            name: 'AppLauncher',
            methods: [{ name: 'openUrl', rtype: 'promise' }],
          },
          { name: 'Haptics', methods: [{ name: 'impact', rtype: 'promise' }] },
          {
            name: 'SplashScreen',
            methods: [{ name: 'hide', rtype: 'promise' }],
          },
        ],
        nativePromise(pluginId: string, methodName: string, options: unknown) {
          bridgeCalls.push({ pluginId, methodName, options });
          if (pluginId === 'AppLauncher')
            return Promise.resolve({ completed: true });
          return Promise.resolve();
        },
      },
      writable: true,
    });
  });
};

test('lays out the iframe behind an inaccessible loading layer before load', async ({
  page,
}) => {
  await simulateNativeCapacitor(page);
  let releaseRequest: () => void = () => undefined;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  let confirmRequest: () => void = () => undefined;
  const requestStarted = new Promise<void>((resolve) => {
    confirmRequest = resolve;
  });

  await page.route('**/projects/portfolio/index.html', async (route) => {
    confirmRequest();
    await requestGate;
    await route.continue();
  });
  await page.goto('/');
  await portfolioButton(page).evaluate((button: HTMLButtonElement) =>
    button.click(),
  );
  await requestStarted;

  const iframe = page.locator('iframe[data-project-frame="portfolio"]');
  await expect(iframe).toHaveAttribute('data-frame-state', 'loading');
  await expect(iframe).toHaveAttribute('aria-hidden', 'true');
  await expect(iframe).toHaveAttribute('inert', '');
  await expect(iframe).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('[data-frame-host]')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect(page.locator('[data-load-state]')).toBeVisible();

  const loadingGeometry = await page.evaluate(() => {
    const frame = document
      .querySelector<HTMLIFrameElement>('[data-project-frame="portfolio"]')
      ?.getBoundingClientRect();
    const host = document
      .querySelector<HTMLElement>('[data-frame-host]')
      ?.getBoundingClientRect();
    const loadingElement =
      document.querySelector<HTMLElement>('[data-load-state]');
    const loading = loadingElement?.getBoundingClientRect();
    const frameElement = document.querySelector<HTMLIFrameElement>(
      '[data-project-frame="portfolio"]',
    );
    const loadingStyle = loadingElement
      ? getComputedStyle(loadingElement)
      : undefined;
    const frameStyle = frameElement
      ? getComputedStyle(frameElement)
      : undefined;

    return {
      frameHeight: frame?.height ?? 0,
      frameWidth: frame?.width ?? 0,
      hostHeight: host?.height ?? 0,
      hostWidth: host?.width ?? 0,
      loadingHeight: loading?.height ?? 0,
      loadingWidth: loading?.width ?? 0,
      loadingZIndex: loadingStyle?.zIndex ?? '',
      frameOpacity: frameStyle?.opacity ?? '',
      framePointerEvents: frameStyle?.pointerEvents ?? '',
    };
  });

  expect(loadingGeometry.frameWidth).toBeGreaterThan(0);
  expect(loadingGeometry.frameHeight).toBeGreaterThan(0);
  expect(loadingGeometry.frameWidth).toBeCloseTo(loadingGeometry.hostWidth, 0);
  expect(loadingGeometry.frameHeight).toBeCloseTo(
    loadingGeometry.hostHeight,
    0,
  );
  expect(loadingGeometry.loadingWidth).toBeCloseTo(
    loadingGeometry.frameWidth,
    0,
  );
  expect(loadingGeometry.loadingHeight).toBeCloseTo(
    loadingGeometry.frameHeight,
    0,
  );
  expect(loadingGeometry.loadingZIndex).toBe('2');
  expect(loadingGeometry.frameOpacity).toBe('0');
  expect(loadingGeometry.framePointerEvents).toBe('none');

  releaseRequest();
  await expect(iframe).toHaveAttribute('data-frame-state', 'ready');
  await expect(iframe).not.toHaveAttribute('aria-hidden', 'true');
  await expect(iframe).not.toHaveAttribute('inert', '');
  await expect(iframe).not.toHaveAttribute('tabindex', '-1');
  await expect(page.locator('[data-frame-host]')).not.toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect(page.locator('[data-load-state]')).toBeHidden();

  const portfolio = page.frameLocator('iframe[data-project-frame="portfolio"]');
  await expect(portfolio.getByRole('heading', { level: 1 })).toBeVisible();
  await portfolio
    .getByRole('button', { name: 'Code' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await portfolio.locator('body').dispatchEvent('pointerdown', {
    clientX: 96,
    clientY: 180,
    pointerId: 41,
    pointerType: 'touch',
  });
  await expect
    .poll(() =>
      portfolio.locator('[data-code-reticle]').evaluate((element) => {
        const transform = (element as HTMLElement).style.transform;
        const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/u.exec(
          transform,
        );
        return match ? [Number(match[1]), Number(match[2])] : [];
      }),
    )
    .toEqual([96, 180]);

  await portfolio.locator('body').evaluate((body) => {
    const touch = {
      identifier: 42,
      target: body,
      clientX: 126,
      clientY: 220,
    };
    const event = new Event('touchstart', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperties(event, {
      changedTouches: { value: [touch] },
      targetTouches: { value: [touch] },
      touches: { value: [touch] },
    });
    body.dispatchEvent(event);
  });
  await expect
    .poll(() =>
      portfolio.locator('[data-code-reticle]').evaluate((element) => {
        const transform = (element as HTMLElement).style.transform;
        const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/u.exec(
          transform,
        );
        return match ? [Number(match[1]), Number(match[2])] : [];
      }),
    )
    .toEqual([126, 220]);
});

test('native runtime opens the checked-in Portfolio offline and preserves Hub lifecycle', async ({
  page,
}) => {
  await simulateNativeCapacitor(page);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4173') await route.continue();
    else await route.abort('internetdisconnected');
  });

  await page.goto('/');
  await expect(page.getByText('Native iOS', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/is-hub-ready/u);
  await expect(page.locator('[data-launch-screen]')).toBeHidden();
  const button = portfolioButton(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await button.click();

  const iframe = page.locator('iframe[data-project-frame="portfolio"]');
  await expect(iframe).toHaveAttribute(
    'src',
    './projects/portfolio/index.html',
  );
  await expect(iframe).toBeVisible();
  const portfolio = page.frameLocator('iframe[data-project-frame="portfolio"]');
  await expect(portfolio.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(portfolio.locator('html')).toHaveAttribute(
    'data-app-context',
    'embedded',
  );
  await expectProjectFillsViewport(page);

  await portfolio.getByRole('link', { name: 'Nachricht schreiben' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as Window & { __nativeBridgeCalls?: unknown[] }
        ).__nativeBridgeCalls?.find(
          (call) =>
            JSON.stringify(call).includes('AppLauncher') &&
            JSON.stringify(call).includes('mailto:kontakt@example.com'),
        ),
      ),
    )
    .toBeTruthy();

  await portfolio.locator('body').evaluate((body) => {
    const externalLink = document.createElement('a');
    externalLink.href = 'https://example.com/portfolio';
    externalLink.textContent = 'Externer Testlink';
    body.append(externalLink);
  });
  await portfolio.getByRole('link', { name: 'Externer Testlink' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as Window & { __nativeBridgeCalls?: unknown[] }
        ).__nativeBridgeCalls?.find(
          (call) =>
            JSON.stringify(call).includes('AppLauncher') &&
            JSON.stringify(call).includes('https://example.com/portfolio'),
        ),
      ),
    )
    .toBeTruthy();

  const hubScrollBefore = await page.evaluate(() => window.scrollY);
  const frameScroll = await iframe.evaluate(async (element) => {
    const frameWindow = (element as HTMLIFrameElement).contentWindow;
    if (!frameWindow) return undefined;
    frameWindow.document.documentElement.style.scrollBehavior = 'auto';
    frameWindow.scrollTo(0, frameWindow.document.documentElement.scrollHeight);
    await new Promise((resolve) => frameWindow.requestAnimationFrame(resolve));
    const footer = frameWindow.document
      .querySelector<HTMLElement>('.site-footer')
      ?.getBoundingClientRect();
    return {
      footerBottom: footer?.bottom ?? -1,
      footerTop: footer?.top ?? -1,
      scrollY: frameWindow.scrollY,
      viewportHeight: frameWindow.innerHeight,
    };
  });
  expect(frameScroll?.scrollY).toBeGreaterThan(100);
  expect(frameScroll?.footerTop).toBeGreaterThanOrEqual(0);
  expect(frameScroll?.footerBottom).toBeLessThanOrEqual(
    (frameScroll?.viewportHeight ?? 0) + 1,
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(hubScrollBefore);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  await iframe.evaluate((element) => {
    (element as HTMLIFrameElement).contentWindow?.addEventListener(
      'pagehide',
      () => localStorage.setItem('portfolio-pagehide-observed', 'true'),
      { once: true },
    );
  });
  await page.getByRole('button', { name: 'Projekte' }).click();
  await expect(iframe).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('portfolio-pagehide-observed')),
    )
    .toBe('true');

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const catalogScroll = await page.evaluate(() => window.scrollY);
  expect(catalogScroll).toBeGreaterThan(100);
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        '[data-project-button][data-project-id="portfolio"]',
      )
      ?.click(),
  );
  await expectProjectFillsViewport(page);
  await page.getByRole('button', { name: 'Projekte' }).click();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(catalogScroll);

  await page.evaluate(() => window.scrollTo(0, 0));
  await button.click();
  await expect(
    page.locator('iframe[data-project-frame="portfolio"]'),
  ).toBeVisible();
  await page.evaluate(() => window.history.back());
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('web runtime resolves Portfolio publicly without requiring it from CI', async ({
  page,
}) => {
  await page.route('https://ki-node.github.io/portfolio/**', (route) =>
    route.abort('internetdisconnected'),
  );
  await page.goto('/');
  await expect(page.getByText('Web Hub', { exact: true })).toBeVisible();

  await portfolioButton(page).click();
  await expect(
    page.locator('iframe[data-project-frame="portfolio"]'),
  ).toHaveAttribute('src', 'https://ki-node.github.io/portfolio/');
});
