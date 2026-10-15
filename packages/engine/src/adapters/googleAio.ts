import { costMicros, toMicros } from '../cost';
import { finalizeCitations, hostOf } from '../domain';
import { ProviderError, networkError, type ProviderErrorKind } from '../errors';
import { ASK_TIMEOUT_MS, type FetchLike, postJson, withTimeout } from '../http';
import { countryLocationCode, dfsLanguageCode } from '../locations';
import type { AnswerRaw, AskInput, PlatformAdapter, Usage } from '../types';

/** Google AI Overviews via DataForSEO SERP live/advanced (03). No overview = `noAnswer`. */
export const DFS_BASE = 'https://api.dataforseo.com/v3';
const LIVE_ADVANCED = `${DFS_BASE}/serp/google/organic/live/advanced`;

interface AioReference {
  url?: string;
  domain?: string;
  title?: string;
  source?: string;
}
interface AioElement {
  type?: string;
  title?: string | null;
  text?: string | null;
  markdown?: string | null;
  references?: AioReference[] | null;
  items?: AioElement[] | null;
}
interface AioItem extends AioElement {
  type: 'ai_overview';
  asynchronous_ai_overview?: boolean;
}
interface DfsResponse {
  status_code?: number;
  status_message?: string;
  cost?: number;
  tasks?: {
    status_code?: number;
    status_message?: string;
    cost?: number;
    result?: { items?: ({ type?: string } & Record<string, unknown>)[] | null }[] | null;
  }[];
}

/** DataForSEO status codes (in the body; HTTP is 200 for most failures). */
export function dfsKind(code: number): ProviderErrorKind {
  if (code === 40200 || code === 40210) return 'quota'; // payment required / balance
  if (code === 40202 || code === 40209) return 'rate_limited';
  if (code >= 50000) return 'transient';
  return 'bad_request';
}

/** The item's `markdown` when present (it already covers its elements), else titles + texts. */
const elementText = (el: AioElement): string => {
  if (el.markdown?.trim()) return el.markdown.trim();
  return [el.title?.trim(), el.text?.trim(), ...(el.items ?? []).map(elementText)]
    .filter(Boolean)
    .join('\n\n');
};

const referencesOf = (el: AioElement): AioReference[] => [
  ...(el.references ?? []),
  ...(el.items ?? []).flatMap(referencesOf),
];

export function parseGoogleAio(
  body: DfsResponse,
  request: unknown,
  latencyMs: number,
  loadAsync: boolean,
): AnswerRaw {
  const top = body.status_code ?? 20000;
  if (top !== 20000) {
    throw new ProviderError(
      'dataforseo',
      dfsKind(top),
      `${top} ${body.status_message ?? ''}`.trim(),
    );
  }
  const task = body.tasks?.[0];
  const code = task?.status_code ?? 0;
  const usage: Usage = { serpRequests: 1, ...(loadAsync ? { asyncAio: 1 } : {}) };
  const cost = task?.cost ?? body.cost;
  if (cost !== undefined) usage.providerCostMicros = toMicros(cost);
  const model = 'google-ai-overview';
  const base = { model, usage, latencyMs, raw: { request, response: body } };
  // 40102 = "No Search Results": nothing to evaluate, same as no overview.
  if (code === 40102) {
    return {
      ...base,
      answer: '',
      citations: [],
      noAnswer: true,
      costMicros: costMicros('dataforseo', model, usage),
    };
  }
  if (code !== 20000) {
    throw new ProviderError(
      'dataforseo',
      dfsKind(code),
      `${code} ${task?.status_message ?? ''}`.trim(),
    );
  }
  const items = task?.result?.[0]?.items ?? [];
  const aio = items.find((i) => i.type === 'ai_overview') as AioItem | undefined;
  const answer = aio ? elementText(aio) : '';
  if (!aio || !answer) {
    // An overview that only loads asynchronously comes back as an empty stub unless
    // load_async_ai_overview is on. Count it so Q-002 can be measured.
    if (aio?.asynchronous_ai_overview) usage.aioNotLoaded = 1;
    return {
      ...base,
      answer: '',
      citations: [],
      noAnswer: true,
      costMicros: costMicros('dataforseo', model, usage),
    };
  }
  const citations = finalizeCitations(
    referencesOf(aio).flatMap((r) =>
      r.url ? [{ url: r.url, title: r.title ?? r.source, domain: hostOf(r.domain ?? r.url) }] : [],
    ),
  );
  return { ...base, answer, citations, costMicros: costMicros('dataforseo', model, usage) };
}

export interface GoogleAioOptions {
  login: string;
  password: string;
  loadAsyncAio: boolean;
  fetch?: FetchLike;
}

export function createGoogleAioAdapter(opts: GoogleAioOptions): PlatformAdapter {
  const auth = `Basic ${Buffer.from(`${opts.login}:${opts.password}`).toString('base64')}`;
  const cityCodes = new Map<string, number | null>();

  /** City → location code via the (free) locations list, cached per country; falls back to the country. */
  async function locationCode(input: AskInput, signal: AbortSignal): Promise<number> {
    const country = countryLocationCode(input.country);
    if (!input.city) return country;
    const key = `${input.country}|${input.city}`.toLowerCase();
    if (!cityCodes.has(key)) {
      cityCodes.set(key, await lookupCity(input.country, input.city, signal));
    }
    return cityCodes.get(key) ?? country;
  }

  async function lookupCity(
    country: string,
    city: string,
    signal: AbortSignal,
  ): Promise<number | null> {
    let res: Response;
    try {
      res = await (opts.fetch ?? fetch)(
        `${DFS_BASE}/serp/google/locations/${country.toLowerCase()}`,
        {
          headers: { Authorization: auth },
          signal,
        },
      );
    } catch (e) {
      throw networkError('dataforseo', e);
    }
    if (!res.ok) return null;
    const body = (await res.json()) as {
      tasks?: {
        result?: { location_code: number; location_name: string; location_type: string }[];
      }[];
    };
    const want = city.trim().toLowerCase();
    const hit = (body.tasks?.[0]?.result ?? []).find(
      (l) => l.location_type === 'City' && l.location_name.toLowerCase().split(',')[0] === want,
    );
    return hit?.location_code ?? null;
  }

  return {
    platform: 'google_aio',
    providerKey: 'dataforseo',
    async ask(input: AskInput, signal: AbortSignal) {
      const timed = withTimeout(signal, ASK_TIMEOUT_MS);
      const request = [
        {
          keyword: input.prompt,
          location_code: await locationCode(input, timed),
          language_code: dfsLanguageCode(input.language, input.country),
          device: 'desktop',
          load_async_ai_overview: opts.loadAsyncAio,
        },
      ];
      const started = Date.now();
      const body = await postJson<DfsResponse>('dataforseo', LIVE_ADVANCED, request, {
        fetch: opts.fetch,
        headers: { Authorization: auth },
        signal: timed,
      });
      return parseGoogleAio(body, request, Date.now() - started, opts.loadAsyncAio);
    },
  };
}
