import { expect, test } from '@playwright/test';

const portfolioButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Portfolio öffnen/u });

const simulateNativeCapacitor = async (
  page: import('@playwright/test').Page,
) => {
  await page.addInitScript(() => {
    const bridgeCalls: unknown[] = [];
    Object.assign(window, { __nativeBridgeCalls: bridgeCalls });
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
    });
    Object.defineProperty(window, 'webkit', {
      configurable: true,
      value: {
        messageHandlers: {
          bridge: { postMessage: () => undefined },
        },
      },
    });
  });
};

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
    if (!frameWindow) return 0;
    frameWindow.document.documentElement.style.scrollBehavior = 'auto';
    frameWindow.scrollTo(0, frameWindow.document.documentElement.scrollHeight);
    await new Promise((resolve) => frameWindow.requestAnimationFrame(resolve));
    return frameWindow.scrollY;
  });
  expect(frameScroll).toBeGreaterThan(100);
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
