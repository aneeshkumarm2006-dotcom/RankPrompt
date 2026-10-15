import { defineConfig } from 'tsup';

// Production bundle: dist/main.js. Internal @pv/* packages ship as TS source, so they are bundled
// in; everything from node_modules stays external.
export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/^@pv\//],
});
