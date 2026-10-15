import { pino, type Logger } from 'pino';
import { SECRET_ENV_KEYS, type Env } from './env';

export type { Logger };

/** Request/response fields and payload keys that never reach the logs (07 § Errors and logging). */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.credential',
  ...SECRET_ENV_KEYS,
  ...SECRET_ENV_KEYS.map((key) => `*.${key}`),
];

export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL' | 'INSTANCE_ID'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { instance: env.INSTANCE_ID },
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    ...(env.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,instance' },
          },
        }
      : {}),
  });
}
