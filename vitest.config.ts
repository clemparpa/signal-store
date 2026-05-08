import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**'],
      exclude: ['packages/*/src/**/*.test.ts', 'packages/*/src/index.ts'],
    },
  },
});
