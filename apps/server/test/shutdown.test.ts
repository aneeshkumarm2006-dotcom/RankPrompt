import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { closeHttpServer, createLifecycle } from '../src/lifecycle/shutdown';
import { silentLogger } from './helpers';

describe('lifecycle', () => {
  it('runs tasks in order, once, then exits with the given code', async () => {
    const exit = vi.fn();
    const order: string[] = [];
    const lifecycle = createLifecycle({ logger: silentLogger, graceMs: 1_000, exit });
    lifecycle.register({ name: 'http', run: () => Promise.resolve(void order.push('http')) });
    lifecycle.register({ name: 'db', run: () => Promise.resolve(void order.push('db')) });

    expect(lifecycle.isShuttingDown()).toBe(false);
    await Promise.all([lifecycle.shutdown('SIGTERM'), lifecycle.shutdown('SIGTERM')]);

    expect(lifecycle.isShuttingDown()).toBe(true);
    expect(order).toEqual(['http', 'db']);
    expect(exit).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('keeps going after a failed task and exits non-zero', async () => {
    const exit = vi.fn();
    const ran = vi.fn(() => Promise.resolve());
    const lifecycle = createLifecycle({ logger: silentLogger, graceMs: 1_000, exit });
    lifecycle.register({ name: 'broken', run: () => Promise.reject(new Error('nope')) });
    lifecycle.register({ name: 'db', run: ran });

    await lifecycle.shutdown('SIGTERM');
    expect(ran).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('closeHttpServer', () => {
  it('stops listening and resolves', async () => {
    const server = createServer((_req, res) => res.end('ok'));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    await closeHttpServer(server, 1_000);
    expect(server.listening).toBe(false);
  });
});
