import { describe, expect, it } from 'vitest';
import { maskSecretUrl } from './maskSecretUrl';

describe('maskSecretUrl', () => {
  it('hides share tokens and one-time token params', () => {
    expect(maskSecretUrl('https://app.example/share/abcDEF123_-xyz?x=1')).toBe(
      'https://app.example/share/[token]?x=1',
    );
    expect(maskSecretUrl('https://app.example/reset-password?token=secret&a=b')).toBe(
      'https://app.example/reset-password?token=[token]&a=b',
    );
    expect(maskSecretUrl('https://app.example/app/brands')).toBe('https://app.example/app/brands');
  });
});
