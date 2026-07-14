import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    clearMocks: true,
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
