import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    clearMocks: true,
    exclude: [
      ...configDefaults.exclude,
      'tests/e2e/**',
      '**/DerivedData/**',
      'ios/App/build/**',
      'ios/App/output/**',
    ],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'https://ki-node.github.io/',
      },
    },
    coverage: {
      enabled: false,
    },
  },
});
