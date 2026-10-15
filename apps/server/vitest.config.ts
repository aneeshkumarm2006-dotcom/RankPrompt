import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'server',
    include: ['test/**/*.test.ts'],
    // One in-memory replica set (transactions need one) for the whole run; each file uses its own DB.
    globalSetup: ['test/globalSetup.ts'],
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
