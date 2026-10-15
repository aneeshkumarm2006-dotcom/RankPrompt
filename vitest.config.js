import { defineConfig } from 'vitest/config';

// One Vitest run over every v2 package; each project has its own vitest.config.ts.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
