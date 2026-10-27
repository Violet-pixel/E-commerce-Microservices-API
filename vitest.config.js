import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/*/test/**/*.test.js', 'packages/*/test/**/*.test.js', 'services/*/test/**/*.test.js'],
    environment: 'node',
    coverage: { provider: 'v8', reporter: ['text', 'html'] }
  }
});
