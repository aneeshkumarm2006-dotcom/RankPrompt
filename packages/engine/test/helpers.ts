import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Extractor } from '../src/extract';
import type { AskInput } from '../src/types';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Fixture format: see test/fixtures/README.md. */
export interface Fixture {
  meta: { platform: string; vendors?: string[]; [k: string]: unknown };
  input: AskInput;
  http: { status: number; body: unknown; headers?: Record<string, string> }[];
  redirects?: Record<string, string>;
}

export const loadFixture = (rel: string): Fixture =>
  JSON.parse(fs.readFileSync(path.join(here, 'fixtures', rel), 'utf8')) as Fixture;

/** A fetch that answers with the fixture's HTTP responses in order and records the requests. */
export function replayFetch(http: Fixture['http']) {
  const requests: { url: string; method: string; body: unknown; headers: Headers }[] = [];
  let i = 0;
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : init?.body;
    requests.push({
      url,
      method: init?.method ?? 'GET',
      body,
      headers: new Headers(init?.headers),
    });
    const next = http[i++];
    if (!next) return Promise.reject(new Error(`fixture has no response #${i} for ${url}`));
    return Promise.resolve(
      new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { 'content-type': 'application/json', ...next.headers },
      }),
    );
  }) as typeof fetch;
  return { fetch: fetchImpl, requests };
}

/** Returns a fixed vendor list, like the shared extractor would. */
export const fixedExtractor = (vendors: string[]): Extractor => ({
  model: 'test-extractor',
  promptHash: 'test',
  extract: () =>
    Promise.resolve({ vendors, model: 'test-extractor', usage: {}, costMicros: 0, raw: null }),
});

export const never = () => new AbortController().signal;
