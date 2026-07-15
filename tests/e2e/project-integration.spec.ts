import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const portfolioButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Portfolio öffnen/u });
const posterButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Poster öffnen/u });

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
  await expect(iframe).toHaveAttribute('sandbox', /allow-downloads/u);
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

test('Poster keeps PNG and clipboard browser fallbacks controlled inside its iframe', async ({
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
  expect(
    await iframe.evaluate(
      (element) =>
        (
          (element as HTMLIFrameElement).contentWindow as
            (Window & { __posterClipboard?: { writes: string[] } }) | null
        )?.__posterClipboard?.writes.length,
    ),
  ).toBe(1);

  await iframe.evaluate((element) => {
    const frameWindow = (element as HTMLIFrameElement).contentWindow as
      (Window & { __posterClipboard?: { fail: boolean } }) | null;
    if (frameWindow?.__posterClipboard)
      frameWindow.__posterClipboard.fail = true;
  });
  await poster
    .getByRole('button', { name: /Copy shareable configuration link/u })
    .click();
  await expect(poster.locator('[data-status]')).toContainText(
    'konnte nicht in die Zwischenablage kopiert werden',
  );

  const downloadPromise = page.waitForEvent('download');
  await poster.getByRole('button', { name: /Export PNG/u }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^poster-forge-[\w-]+-portrait\.png$/u,
  );
  expect(
    await iframe.evaluate(
      (element) =>
        'OrbitBridge' in
          ((element as HTMLIFrameElement).contentWindow ?? window) ||
        'orbitBridge' in
          ((element as HTMLIFrameElement).contentWindow ?? window),
    ),
  ).toBe(false);
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

test('web runtime keeps Poster public and Blackbox mocked without network dependence', async ({
  page,
}) => {
  await page.route('https://ki-node.github.io/poster/**', (route) =>
    route.abort('internetdisconnected'),
  );
  await page.goto('/');
  await posterButton(page).click();
  await expect(
    page.locator('iframe[data-project-frame="poster"]'),
  ).toHaveAttribute('src', 'https://ki-node.github.io/poster/');
  await page.getByRole('button', { name: 'Projekte' }).click();
  await page.getByRole('button', { name: /Blackbox öffnen/u }).click();
  await expect(
    page.locator('iframe[data-project-frame="blackbox"]'),
  ).toHaveAttribute(
    'src',
    /mock-project\/index\.html\?project=blackbox&source=web/u,
  );
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
