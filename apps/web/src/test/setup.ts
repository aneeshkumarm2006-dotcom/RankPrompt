import { afterEach } from 'vitest';

// Testing Library only auto-cleans with vitest globals on; this suite runs without them.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
