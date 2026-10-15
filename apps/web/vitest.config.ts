import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

// Pure-logic tests run in node; component tests opt into jsdom with a
// `// @vitest-environment jsdom` comment at the top of the file.
export default defineProject({
  plugins: [react()],
  test: {
    name: 'web',
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
});
