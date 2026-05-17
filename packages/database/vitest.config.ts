import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '__tests__/unit/**/*.test.ts',
      '__tests__/property/**/*.prop.ts',
    ],
    exclude: [
      '__tests__/integration/**',
      'node_modules',
      'dist',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts'],
    },
  },
});
