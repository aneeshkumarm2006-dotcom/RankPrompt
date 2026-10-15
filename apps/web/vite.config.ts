import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The app always calls same-origin /api (D-018). In dev, Vite forwards it to the local server;
// in production, the Vercel rewrite in vercel.json forwards it to Render.
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET ?? 'http://localhost:4000',
    // Adds X-Forwarded-For, so the server (trust proxy = 1 locally) sees the browser's IP.
    xfwd: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The server's APP_URL (CORS, Origin check) is http://localhost:5173, so never drift to 5174.
    strictPort: true,
    proxy: apiProxy,
  },
  preview: { port: 4173, proxy: apiProxy },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't invalidate the framework code in caches.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          query: ['@tanstack/react-query', 'zod'],
        },
      },
      onwarn(warning, warn) {
        // zod ships comments Rollup can't place; harmless and noisy in CI logs.
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('/zod/')) return;
        warn(warning);
      },
    },
  },
});
