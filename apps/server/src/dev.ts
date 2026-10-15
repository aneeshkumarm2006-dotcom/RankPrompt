// `pnpm dev` entry: defaults NODE_ENV to development (cross-platform, no shell syntax), then boots
// the real entry point. Production runs dist/main.js, which never applies this default.
process.env.NODE_ENV ??= 'development';
await import('./main');
