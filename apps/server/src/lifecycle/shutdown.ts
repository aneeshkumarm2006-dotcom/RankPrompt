import type { Server } from 'node:http';
import type { Logger } from '../config/logger';

export interface ShutdownTask {
  name: string;
  run: () => Promise<void>;
}

export interface Lifecycle {
  isShuttingDown(): boolean;
  /** Tasks run one after another, in registration order: HTTP first, the DB last. */
  register(task: ShutdownTask): void;
  shutdown(reason: string, exitCode?: number): Promise<void>;
}

/**
 * Graceful shutdown (04): on SIGTERM stop taking traffic, let in-flight work finish within
 * `graceMs`, then close the DB and exit. A watchdog forces the exit if a task hangs. Render keeps
 * the old instance alive during a deploy, so this must never leave half-written state behind.
 */
export function createLifecycle(opts: {
  logger: Logger;
  graceMs: number;
  exit?: (code: number) => void;
}): Lifecycle {
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  const tasks: ShutdownTask[] = [];
  let shuttingDown = false;

  return {
    isShuttingDown: () => shuttingDown,
    register: (task) => {
      tasks.push(task);
    },
    async shutdown(reason, exitCode = 0) {
      if (shuttingDown) return;
      shuttingDown = true;
      opts.logger.info({ reason }, 'shutting down');

      const watchdog = setTimeout(() => {
        opts.logger.error({ graceMs: opts.graceMs }, 'shutdown took too long; forcing exit');
        exit(1);
      }, opts.graceMs + 5_000);
      watchdog.unref();

      let code = exitCode;
      for (const task of tasks) {
        try {
          await task.run();
          opts.logger.debug({ task: task.name }, 'shutdown task done');
        } catch (err) {
          code = code || 1;
          opts.logger.error({ err, task: task.name }, 'shutdown task failed');
        }
      }
      clearTimeout(watchdog);
      opts.logger.info({ exitCode: code }, 'shutdown complete');
      exit(code);
    },
  };
}

/** Stops accepting connections, closes idle keep-alives, and cuts the rest off after `graceMs`. */
export function closeHttpServer(server: Server, graceMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const force = setTimeout(() => server.closeAllConnections(), graceMs);
    force.unref();
    server.close((err) => {
      clearTimeout(force);
      if (err) reject(err);
      else resolve();
    });
    server.closeIdleConnections();
  });
}
