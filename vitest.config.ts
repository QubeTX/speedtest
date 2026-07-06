/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// Node environment: the v4 statistical core is pure computation (no DOM).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
