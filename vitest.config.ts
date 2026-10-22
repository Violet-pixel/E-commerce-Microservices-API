import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'services/*/test/**/*.test.ts'],
    environment: 'node',
    coverage: { provider: 'v8', reporter: ['text', 'html'] }
  }
});
