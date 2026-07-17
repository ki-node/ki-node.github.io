import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const portfolioButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Portfolio öffnen/u });
const posterButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Poster öffnen/u });
const blackboxButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Blackbox öffnen/u });

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
          {
            name: 'Haptics',
            methods: [
              { name: 'impact', rtype: 'promise' },
              { name: 'notification', rtype: 'promise' },
            ],
          },
          {
            name: 'SplashScreen',
            methods: [{ name: 'hide', rtype: 'promise' }],
          },
          {
            name: 'Filesystem',
            methods: [
              { name: 'writeFile', rtype: 'promise' },
              { name: 'deleteFile', rtype: 'promise' },
            ],
          },
          { name: 'Share', methods: [{ name: 'share', rtype: 'promise' }] },
        ],
        nativePromise(pluginId: string, methodName: string, options: unknown) {
          bridgeCalls.push({ pluginId, methodName, options });
          if (pluginId === 'AppLauncher')
            return Promise.resolve({ completed: true });
          if (pluginId === 'Filesystem' && methodName === 'writeFile')
            return Promise.resolve({ uri: 'file:///cache/poster.png' });
          if (pluginId === 'Share')
            return Promise.resolve({ activityType: 'saveToFiles' });
          return Promise.resolve();
        },
      },
      writable: true,
    });
  });
};

test('lays out the iframe behind an inaccessible loading layer before load', async ({
  page,
  browserName,
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
  await expect(iframe).toHaveAttribute('data-frame-state', 'ready', {
    timeout: 15_000,
  });
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
  if (browserName === 'chromium') {
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
  }

  if (browserName === 'chromium') {
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
  }
});

test('native runtime opens the checked-in Portfolio offline and preserves Hub lifecycle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
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

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.documentElement.style.minHeight = '200vh';
    document.body.style.minHeight = '200vh';
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
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

test('native runtime opens the pinned Poster offline with mobile-safe geometry and controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await simulateNativeCapacitor(page);
  const externalRequests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4173') await route.continue();
    else {
      externalRequests.push(url.href);
      await route.abort('internetdisconnected');
    }
  });

  await page.goto('/');
  const button = posterButton(page);
  await button.click();
  const iframe = page.locator('iframe[data-project-frame="poster"]');
  await expect(iframe).toHaveAttribute('src', './projects/poster/index.html');
  await expect(iframe).toHaveAttribute('allow', 'clipboard-write');
  await expect(iframe).not.toHaveAttribute('sandbox', /allow-downloads/u);
  await expect(iframe).not.toHaveAttribute('sandbox', /allow-top-navigation/u);
  await expect(iframe).toHaveAttribute('data-frame-state', 'ready');
  await expectProjectFillsViewport(page);

  const poster = page.frameLocator('iframe[data-project-frame="poster"]');
  await expect(poster.locator('html')).toHaveAttribute(
    'data-app-context',
    'embedded',
  );
  await expect(poster.locator('.masthead')).toBeHidden();
  await expect(poster.locator('.intro')).toBeHidden();
  await expect(
    poster.getByRole('heading', { level: 2, name: 'Forge controls' }),
  ).toBeVisible();
  await expect(poster.locator('[data-poster]')).toBeVisible();
  const horizontalGeometry = await poster.locator('html').evaluate((html) => ({
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    width: html.clientWidth,
    scrollWidth: html.scrollWidth,
  }));
  expect(horizontalGeometry.reducedMotion).toBe(true);
  expect(horizontalGeometry.scrollWidth).toBeLessThanOrEqual(
    horizontalGeometry.width + 1,
  );

  const seed = poster.locator('[data-seed-label]');
  const initialSeed = await seed.textContent();
  await poster.getByRole('button', { name: /Remix layout/u }).click();
  const remixedSeed = await seed.textContent();
  expect(remixedSeed).not.toBe(initialSeed);
  await poster.getByRole('button', { name: /Undo/u }).click();
  await expect(seed).toHaveText(initialSeed ?? '');
  await poster.getByRole('button', { name: /Redo/u }).click();
  await expect(seed).toHaveText(remixedSeed ?? '');

  const format = poster.locator('#poster-format');
  const preview = poster.locator('[data-poster]');
  await poster.locator('[data-advanced] summary').click();
  const formats = [
    ['portrait', '1200', '1600'],
    ['square', '1200', '1200'],
    ['story', '1080', '1920'],
    ['landscape', '1600', '1000'],
  ] as const;
  for (const [value, width, height] of formats) {
    await format.selectOption(value);
    await expect(preview).toHaveAttribute('width', width);
    await expect(preview).toHaveAttribute('height', height);
  }

  await poster.locator('[data-advanced]').scrollIntoViewIfNeeded();
  await expect(
    poster.getByRole('button', { name: 'Zur großen Poster-Vorschau springen' }),
  ).toBeVisible();
  const hubScroll = await page.evaluate(() => window.scrollY);
  const footerGeometry = await iframe.evaluate(async (element) => {
    const frameWindow = (element as HTMLIFrameElement).contentWindow;
    if (!frameWindow) return null;
    frameWindow.scrollTo(0, frameWindow.document.documentElement.scrollHeight);
    await new Promise((resolve) => frameWindow.requestAnimationFrame(resolve));
    const footer = frameWindow.document
      .querySelector('footer')
      ?.getBoundingClientRect();
    return {
      bottom: footer?.bottom ?? -1,
      top: footer?.top ?? -1,
      viewportHeight: frameWindow.innerHeight,
    };
  });
  expect(footerGeometry?.top).toBeGreaterThanOrEqual(0);
  expect(footerGeometry?.bottom).toBeLessThanOrEqual(
    (footerGeometry?.viewportHeight ?? 0) + 1,
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(hubScroll);
  expect(externalRequests).toEqual([]);
});

test('Poster exports through native Share and keeps Clipboard controlled inside its iframe', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { fail: false, writes: [] as string[] };
    Object.assign(window, { __posterClipboard: state });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          if (state.fail) throw new Error('Clipboard denied for test');
          state.writes.push(text);
        },
      },
    });
  });
  await simulateNativeCapacitor(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await posterButton(page).click();
  const iframe = page.locator('iframe[data-project-frame="poster"]');
  const poster = page.frameLocator('iframe[data-project-frame="poster"]');
  await expect(iframe).toHaveAttribute('data-frame-state', 'ready');
  await poster.locator('[data-advanced] summary').click();

  await poster.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(poster.locator('[data-status]')).toContainText('kopiert');
  await poster.getByRole('button', { name: 'Copy', exact: true }).click();
  await poster
    .getByRole('button', { name: /Copy shareable configuration link/u })
    .click();
  await expect(poster.locator('[data-status]')).toContainText(
    'Konfigurationslink kopiert',
  );
  expect(
    await iframe.evaluate(
      (element) =>
        (
          (element as HTMLIFrameElement).contentWindow as
            (Window & { __posterClipboard?: { writes: string[] } }) | null
        )?.__posterClipboard?.writes.length,
    ),
  ).toBe(3);

  await iframe.evaluate((element) => {
    const frameWindow = (element as HTMLIFrameElement).contentWindow as
      (Window & { __posterClipboard?: { fail: boolean } }) | null;
    if (frameWindow?.__posterClipboard)
      frameWindow.__posterClipboard.fail = true;
  });
  await poster.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(poster.locator('[data-status]')).toContainText(
    'Seed konnte nicht in die Zwischenablage kopiert werden',
  );
  await poster
    .getByRole('button', { name: /Copy shareable configuration link/u })
    .click();
  await expect(poster.locator('[data-status]')).toContainText(
    'konnte nicht in die Zwischenablage kopiert werden',
  );

  const sourceBefore = await iframe.getAttribute('src');
  await poster.getByRole('button', { name: /Export PNG/u }).click();
  await expect(poster.locator('[data-status]')).toContainText(
    'an Orbit übergeben',
  );
  expect(await iframe.getAttribute('src')).toBe(sourceBefore);
  const nativeExports = await page.evaluate(() =>
    (
      window as Window & {
        __nativeBridgeCalls?: {
          pluginId: string;
          methodName: string;
          options: Record<string, unknown>;
        }[];
      }
    ).__nativeBridgeCalls?.filter(
      (call) => call.pluginId === 'Filesystem' || call.pluginId === 'Share',
    ),
  );
  expect(
    nativeExports?.map((call) => `${call.pluginId}.${call.methodName}`),
  ).toEqual(['Filesystem.writeFile', 'Share.share', 'Filesystem.deleteFile']);
  expect(nativeExports?.[0]?.options.path).toMatch(
    /^orbit-exports\/[\w-]+-poster-forge-[\w-]+-portrait\.png$/u,
  );
  expect(nativeExports?.[1]?.options.url).toBe('file:///cache/poster.png');
  expect(nativeExports?.[2]?.options.path).toBe(
    nativeExports?.[0]?.options.path,
  );
  expect(errors).toEqual([]);
});

test('switches Portfolio to Poster and back without retaining iframe state', async ({
  page,
}) => {
  await simulateNativeCapacitor(page);
  await page.goto('/');

  await portfolioButton(page).click();
  const firstPortfolio = page.locator('iframe[data-project-frame="portfolio"]');
  await expect(firstPortfolio).toHaveAttribute('data-frame-state', 'ready');
  await page.getByRole('button', { name: 'Projekte' }).click();
  await expect(firstPortfolio).toHaveCount(0);

  await posterButton(page).click();
  const poster = page.locator('iframe[data-project-frame="poster"]');
  await expect(poster).toHaveAttribute('data-frame-state', 'ready');
  await poster.evaluate((element) => {
    (element as HTMLIFrameElement).contentWindow?.addEventListener(
      'pagehide',
      () => localStorage.setItem('poster-pagehide-observed', 'true'),
      { once: true },
    );
  });
  await page.getByRole('button', { name: 'Projekte' }).click();
  await expect(poster).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('poster-pagehide-observed')),
    )
    .toBe('true');

  await portfolioButton(page).click();
  const secondPortfolio = page.locator(
    'iframe[data-project-frame="portfolio"]',
  );
  await expect(secondPortfolio).toHaveAttribute('data-frame-state', 'ready');
  await expect(page.locator('iframe')).toHaveCount(1);
});

test('native runtime opens pinned Blackbox offline, preserves progress and forwards haptics', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await simulateNativeCapacitor(page);
  const externalRequests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4173') await route.continue();
    else {
      externalRequests.push(url.href);
      await route.abort('internetdisconnected');
    }
  });

  await page.goto('/');
  const button = blackboxButton(page);
  await button.click();
  const iframe = page.locator('iframe[data-project-frame="blackbox"]');
  await expect(iframe).toHaveAttribute('src', './projects/blackbox/index.html');
  await expect(iframe).not.toHaveAttribute('allow');
  await expect(iframe).not.toHaveAttribute('sandbox', /allow-downloads/u);
  await expect(iframe).not.toHaveAttribute('sandbox', /allow-top-navigation/u);
  await expect(iframe).toHaveAttribute('data-frame-state', 'ready');
  await expectProjectFillsViewport(page);

  const blackbox = page.frameLocator('iframe[data-project-frame="blackbox"]');
  await expect(blackbox.locator('html')).toHaveAttribute(
    'data-runtime-context',
    'embedded',
  );
  await expect(blackbox.locator('link[rel="manifest"]')).toHaveCount(0);
  await expect(blackbox.locator('[data-install]')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (
        window as Window & {
          __nativeBridgeCalls?: { pluginId: string }[];
        }
      ).__nativeBridgeCalls?.filter((call) => call.pluginId === 'Haptics'),
    ),
  ).toEqual([]);

  await blackbox.getByRole('button', { name: 'Verbindung herstellen' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as Window & {
            __nativeBridgeCalls?: {
              pluginId: string;
              methodName: string;
              options: Record<string, unknown>;
            }[];
          }
        ).__nativeBridgeCalls?.filter((call) => call.pluginId === 'Haptics'),
      ),
    )
    .toEqual([
      {
        pluginId: 'Haptics',
        methodName: 'impact',
        options: { style: 'LIGHT' },
      },
    ]);

  const progress = await iframe.evaluate((element) =>
    (element as HTMLIFrameElement).contentWindow?.localStorage.getItem(
      'black-box-progress-v2',
    ),
  );
  expect(progress).toContain('"started":true');

  await page.getByRole('button', { name: 'Projekte' }).click();
  await expect(iframe).toHaveCount(0);
  await expect(button).toBeFocused();
  await button.click();
  const reopened = page.locator('iframe[data-project-frame="blackbox"]');
  await expect(reopened).toHaveAttribute('data-frame-state', 'ready');
  expect(
    await reopened.evaluate((element) =>
      (element as HTMLIFrameElement).contentWindow?.localStorage.getItem(
        'black-box-progress-v2',
      ),
    ),
  ).toBe(progress);
  await expect(
    page
      .frameLocator('iframe[data-project-frame="blackbox"]')
      .getByRole('button', { name: 'Stromkreis schließen' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Projekte' }).click();

  await posterButton(page).click();
  await expect(
    page.locator('iframe[data-project-frame="poster"]'),
  ).toHaveAttribute('data-frame-state', 'ready');
  await page.getByRole('button', { name: 'Projekte' }).click();
  await portfolioButton(page).click();
  await expect(
    page.locator('iframe[data-project-frame="portfolio"]'),
  ).toHaveAttribute('data-frame-state', 'ready');

  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('web runtime keeps Poster and Blackbox on their public sources', async ({
  page,
}) => {
  await page.route('https://ki-node.github.io/poster/**', (route) =>
    route.abort('internetdisconnected'),
  );
  await page.route('https://ki-node.github.io/blackbox/**', (route) =>
    route.abort('internetdisconnected'),
  );
  await page.goto('/');
  await posterButton(page).click();
  await expect(
    page.locator('iframe[data-project-frame="poster"]'),
  ).toHaveAttribute('src', 'https://ki-node.github.io/poster/');
  await page.getByRole('button', { name: 'Projekte' }).click();
  await blackboxButton(page).click();
  await expect(
    page.locator('iframe[data-project-frame="blackbox"]'),
  ).toHaveAttribute('src', 'https://ki-node.github.io/blackbox/');
});

test('keeps the Hub and active Poster frame accessible', async ({ page }) => {
  await simulateNativeCapacitor(page);
  await page.goto('/');
  await posterButton(page).click();
  await expect(
    page.locator('iframe[data-project-frame="poster"]'),
  ).toHaveAttribute('data-frame-state', 'ready');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('restores the active URL project after pagehide/pageshow without duplicate frames', async ({
  page,
}) => {
  await simulateNativeCapacitor(page);
  await page.goto('/?project=portfolio');
  await expect(
    page.locator('iframe[data-project-frame="portfolio"]'),
  ).toHaveAttribute('data-frame-state', 'ready');

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent('pagehide', { persisted: true }),
    );
  });
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('[data-catalog-view]')).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
  });
  await expect(
    page.locator('iframe[data-project-frame="portfolio"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('iframe[data-project-frame="portfolio"]'),
  ).toHaveAttribute('data-frame-state', 'ready');
  await expect(page.locator('[data-launch-screen]')).toBeHidden();

  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await expect(page.locator('iframe')).toHaveCount(1);
});

test('offers a fresh retry and a complete catalog return from the error state', async ({
  page,
}) => {
  await simulateNativeCapacitor(page);
  let releaseBlockedLoads: () => void = () => undefined;
  const blockedLoads = new Promise<void>((resolve) => {
    releaseBlockedLoads = resolve;
  });
  let blockPortfolio = true;
  await page.route('**/projects/portfolio/index.html', async (route) => {
    if (blockPortfolio) await blockedLoads;
    await route.continue();
  });
  await page.goto('/');
  const opener = portfolioButton(page);
  await opener.click();
  await page
    .locator('iframe[data-project-frame="portfolio"]')
    .dispatchEvent('error');

  await expect(
    page.getByRole('heading', { name: /Portfolio konnte/u }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Erneut versuchen' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Zurück zu Projekten' }),
  ).toBeVisible();
  const errorResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(errorResults.violations).toEqual([]);

  await page.getByRole('button', { name: 'Zurück zu Projekten' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  const failedFrame = page.locator('iframe[data-project-frame="portfolio"]');
  const failedHandle = await failedFrame.elementHandle();
  await failedFrame.dispatchEvent('error');
  blockPortfolio = false;
  releaseBlockedLoads();
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  expect(await failedHandle?.evaluate((element) => element.isConnected)).toBe(
    false,
  );
  await expect(
    page.locator('iframe[data-project-frame="portfolio"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('iframe[data-project-frame="portfolio"]'),
  ).toHaveAttribute('data-frame-state', 'ready');
});

test('shows accessible system information from the lock file at constrained viewports', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  for (const scenario of [
    { viewport: { width: 393, height: 852 }, reducedMotion: false },
    { viewport: { width: 320, height: 568 }, reducedMotion: false },
    { viewport: { width: 390, height: 500 }, reducedMotion: false },
    { viewport: { width: 844, height: 390 }, reducedMotion: true },
  ]) {
    await page.setViewportSize(scenario.viewport);
    await page.emulateMedia({
      reducedMotion: scenario.reducedMotion ? 'reduce' : 'no-preference',
    });
    await page.evaluate(() => {
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, root.scrollHeight);
      root.style.scrollBehavior = previousScrollBehavior;
    });
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    const initialScroll = await page.evaluate(() => ({
      left: window.scrollX,
      top: window.scrollY,
    }));
    expect(initialScroll.top).toBeGreaterThan(0);

    const opener = page.getByRole('button', { name: 'Systeminformationen' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Systeminformationen' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Orbit');
    await expect(dialog).toContainText('1.0.0');
    await expect(dialog).toContainText('Web-Hub');
    await expect(dialog).toContainText('ki-node/portfolio');
    await expect(dialog).toContainText('ki-node/poster');
    await expect(dialog).toContainText('ki-node/blackbox');
    await expect(dialog.locator('code')).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    const lockedDocument = await page.evaluate(() => ({
      bodyLeft: document.body.style.left,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      scrollLeft: window.scrollX,
      scrollTop: window.scrollY,
    }));
    expect(lockedDocument.bodyPosition).toBe('fixed');
    expect(Number.parseFloat(lockedDocument.bodyTop)).toBe(-initialScroll.top);
    expect(Number.parseFloat(lockedDocument.bodyLeft)).toBeCloseTo(
      -initialScroll.left,
      5,
    );

    if (browserName === 'webkit') await page.keyboard.press('PageUp');
    else {
      await page.mouse.move(2, 2);
      await page.mouse.wheel(0, -400);
    }
    await expect
      .poll(() =>
        page.evaluate(() => ({
          bodyLeft: document.body.style.left,
          bodyPosition: document.body.style.position,
          bodyTop: document.body.style.top,
          scrollLeft: window.scrollX,
          scrollTop: window.scrollY,
        })),
      )
      .toEqual(lockedDocument);

    const panel = dialog.locator('.system-dialog__panel');
    const panelMetrics = await panel.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    if (
      scenario.viewport.height <= 568 ||
      scenario.viewport.width > scenario.viewport.height
    ) {
      expect(panelMetrics.scrollHeight).toBeGreaterThan(
        panelMetrics.clientHeight,
      );
      const panelBounds = await panel.boundingBox();
      if (!panelBounds) throw new Error('System dialog panel has no bounds.');
      if (browserName === 'webkit') {
        await panel.evaluate((element) => {
          element.tabIndex = -1;
          element.focus({ preventScroll: true });
        });
        await page.keyboard.press('PageDown');
      } else {
        await page.mouse.move(
          panelBounds.x + panelBounds.width / 2,
          panelBounds.y + panelBounds.height / 2,
        );
        await page.mouse.wheel(0, 240);
      }
      await expect
        .poll(() => panel.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      if (browserName === 'webkit')
        await panel.evaluate((element) => element.removeAttribute('tabindex'));
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate(() => ({ left: window.scrollX, top: window.scrollY })),
      )
      .toEqual(initialScroll);

    if (browserName === 'webkit') await page.keyboard.press('PageUp');
    else {
      await page.mouse.move(2, Math.floor(scenario.viewport.height / 2));
      await page.mouse.wheel(0, -400);
    }
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeLessThan(initialScroll.top);
  }
});
