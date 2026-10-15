import { createHash } from 'node:crypto';
import type { Platform } from '@pv/shared';
import { finalizeCitations } from '../domain';
import { EXTRACT_PROMPT_HASH, type Extractor } from '../extract';
import { PROVIDER_OF, type PlatformAdapter } from '../types';

/**
 * FAKE_PROVIDERS=true: deterministic canned answers, no network, no cost. Used by tests, local
 * dev and the P8 load test. The same prompt always gives the same answer.
 */
const VENDORS = [
  'Acme Analytics',
  'Globex',
  'Initech',
  'Umbrella Labs',
  'Hooli',
  'Vandelay Industries',
];

const seedOf = (s: string): number => createHash('sha256').update(s).digest().readUInt32BE(0);

export function createFakeAdapter(
  platform: Platform,
  opts: { latencyMs?: number } = {},
): PlatformAdapter {
  return {
    platform,
    providerKey: PROVIDER_OF[platform],
    async ask(input, signal) {
      const seed = seedOf(`${platform}|${input.country}|${input.prompt}`);
      if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
      signal.throwIfAborted();
      const raw = { fake: true, seed };
      if (platform === 'google_aio' && seed % 4 === 0) {
        return {
          answer: '',
          citations: [],
          model: 'fake',
          usage: {},
          costMicros: 0,
          latencyMs: 0,
          raw,
          noAnswer: true,
        };
      }
      const picks = [0, 1, 2].map((k) => VENDORS[(seed + k * 7) % VENDORS.length] as string);
      const unique = [...new Set(picks)];
      const answer = [
        `Here are good options for "${input.prompt}":`,
        ...unique.map(
          (v, i) =>
            `${i + 1}. **${v}** is a solid choice. ([${v.split(' ')[0]?.toLowerCase()}.example](https://${v.split(' ')[0]?.toLowerCase()}.example/?utm_source=openai))`,
        ),
      ].join('\n');
      return {
        answer,
        citations: finalizeCitations(
          unique.map((v) => ({
            url: `https://${v.split(' ')[0]?.toLowerCase()}.example/`,
            title: v,
          })),
        ),
        model: `fake-${platform}`,
        usage: {},
        costMicros: 0,
        latencyMs: opts.latencyMs ?? 0,
        raw,
      };
    },
  };
}

/** Vendors = the `**bold**` names, in order. */
export function createFakeExtractor(): Extractor {
  return {
    model: 'fake-extractor',
    promptHash: EXTRACT_PROMPT_HASH,
    extract(prose) {
      const vendors = [
        ...new Set([...prose.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => (m[1] as string).trim())),
      ];
      return Promise.resolve({
        vendors,
        model: 'fake-extractor',
        usage: {},
        costMicros: 0,
        raw: null,
      });
    },
  };
}
