import { z } from 'zod';

/**
 * Password policy (07): at least 8 characters, at most 72 bytes (bcrypt ignores anything after
 * that), and not one of the most common passwords. Shared so the web forms give the same answer.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '12345678910',
  '0123456789',
  '87654321',
  '11111111',
  '00000000',
  '88888888',
  '12341234',
  '11223344',
  '1q2w3e4r',
  '1q2w3e4r5t',
  '1qaz2wsx',
  'qwertyui',
  'qwertyuiop',
  'qwerty123',
  'qwerty12',
  'asdfghjk',
  'asdfasdf',
  'zxcvbnm1',
  'password',
  'password1',
  'password12',
  'password123',
  'password!',
  'passw0rd',
  'p@ssw0rd',
  'p@ssword',
  'iloveyou',
  'iloveyou1',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'basketball',
  'superman',
  'starwars',
  'trustno1',
  'whatever',
  'welcome1',
  'welcome123',
  'letmein1',
  'letmein123',
  'changeme',
  'changeme1',
  'abc12345',
  'abcd1234',
  'abcdefgh',
  'aa123456',
  'admin123',
  'administrator',
  'computer',
  'internet',
  'michelle',
  'jennifer',
  'jordan23',
  'liverpool',
  'chelsea1',
  'charlie1',
  'shadow12',
  'monkey12',
  'dragon12',
  'master12',
  'qazwsxedc',
  'zaq12wsx',
  'mustang1',
  'secret12',
  'promptverse',
  'promptverse1',
]);

export const isCommonPassword = (password: string): boolean =>
  COMMON_PASSWORDS.has(password.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine((p) => new TextEncoder().encode(p).length <= PASSWORD_MAX_BYTES, {
    message: 'Use at most 72 characters',
  })
  .refine((p) => !isCommonPassword(p), { message: 'This password is too common' });
