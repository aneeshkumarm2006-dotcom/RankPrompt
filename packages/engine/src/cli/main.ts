import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { COUNTRY_CODES, LANGUAGE_CODES, PLATFORMS, platformSchema } from '@pv/shared';
import { runCheck } from '../check';
import { createEngine, engineConfigFromEnv } from '../config';
import { ExtractError, ProviderError } from '../errors';
import type { ProviderLimit } from '../limiter';
import { buildMatcher } from '../match';
import type { ProviderKey } from '../types';
import { exportRun } from './export';
import { loadCompetitors, loadPrompts, splitList } from './inputs';
import { runBatch, type RunSpec } from './runner';

/**
 * `pnpm engine <ask|run|export>` (03 § CLI). Replaces the throwaway luna scripts. Reads keys from
 * apps/server/.env (or --env). Never touches a database.
 */

const USAGE = `Usage:
  pnpm engine ask    --platform <p> [--country US] [--city X] [--language en]
                     [--brand Name --domain x.com --aliases "A,B" --competitors comps.json]
                     [--json] [--record fixture.json] "prompt"
  pnpm engine run    --brand Name --domain x.com [--aliases "A,B"] [--competitors comps.json]
                     --prompts prompts.csv --platforms chatgpt,perplexity [--country US] [--city X]
                     [--language en] [--concurrency 6] --out ./out/dir [--no-retry-failed] [--force]
  pnpm engine export --in ./out/dir --xlsx "path/to/file.xlsx"

Platforms: ${PLATFORMS.join(', ')}. Options common to all: --env <file> (default apps/server/.env).
Relative paths resolve from the directory you ran the command in.`;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
/** pnpm runs scripts from the package dir; INIT_CWD is where the user typed the command. */
const cwd = process.env.INIT_CWD ?? process.cwd();
const resolvePath = (p: string) => path.resolve(cwd, p);

function loadEnv(file: string | undefined): void {
  const envFile = file ? resolvePath(file) : path.join(repoRoot, 'apps/server/.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  else if (file) throw new Error(`env file not found: ${envFile}`);
}

const common = {
  env: { type: 'string' },
  country: { type: 'string', default: 'US' },
  city: { type: 'string' },
  language: { type: 'string', default: 'en' },
  brand: { type: 'string' },
  domain: { type: 'string' },
  aliases: { type: 'string' },
  competitors: { type: 'string' },
} as const;

function location(v: { country: string; city?: string | undefined; language: string }) {
  const country = v.country.toUpperCase();
  if (!(COUNTRY_CODES as readonly string[]).includes(country))
    throw new Error(`unknown --country ${v.country}`);
  const language = v.language.toLowerCase();
  if (!(LANGUAGE_CODES as readonly string[]).includes(language))
    throw new Error(`unknown --language ${v.language}`);
  return { country, language, ...(v.city ? { city: v.city } : {}) };
}

function providerLimitsFromEnv(): Partial<Record<ProviderKey, ProviderLimit>> | undefined {
  const raw = process.env.PROVIDER_LIMITS?.trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as Partial<Record<ProviderKey, ProviderLimit>>;
}

const fmtUsd = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`;

async function ask(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      ...common,
      platform: { type: 'string' },
      json: { type: 'boolean' },
      record: { type: 'string' },
    },
  });
  loadEnv(values.env);
  const prompt = positionals.join(' ').trim();
  if (!prompt || !values.platform) throw new Error('ask needs --platform and a prompt');
  const platform = platformSchema.parse(values.platform);
  const engine = createEngine(engineConfigFromEnv(process.env));
  const adapter = engine.adapters[platform];
  if (!adapter) throw new Error(`${platform}: ${engine.missing[platform]}`);
  if (!engine.extractor) throw new Error(engine.missing.extractor ?? 'no extractor');
  const input = { prompt, ...location(values) };
  const brand = buildMatcher({
    name: values.brand ?? '(no brand)',
    domain: values.domain ?? null,
    aliases: splitList(values.aliases),
  });
  const competitors = values.competitors
    ? loadCompetitors(resolvePath(values.competitors)).map(buildMatcher)
    : [];
  const res = await runCheck({
    adapter,
    extractor: engine.extractor,
    input,
    brand,
    competitors,
    signal: AbortSignal.timeout(300_000),
  });

  if (values.record) {
    // Fixture format (test/fixtures/README.md): the provider bodies, replayed in order.
    const raw = res.raw as { response?: unknown; responses?: unknown[] };
    const bodies = raw.responses ?? [raw.response];
    const fixture = {
      meta: {
        platform,
        source: 'pnpm engine ask --record',
        recordedAt: new Date().toISOString(),
        model: res.model,
      },
      input,
      http: bodies.map((body) => ({ status: 200, body })),
    };
    fs.writeFileSync(resolvePath(values.record), JSON.stringify(fixture, null, 1));
  }
  if (values.json) {
    const { raw: _raw, extractorRaw: _x, ...rest } = res;
    console.log(JSON.stringify(rest, null, 2));
    return;
  }
  console.log(
    `${platform} · ${res.model} · ${res.status} · ${res.latencyMs} ms · ${fmtUsd(res.costMicros)} (answer ${fmtUsd(res.answerCostMicros)}, extract ${fmtUsd(res.extractCostMicros)})`,
  );
  console.log(`usage ${JSON.stringify(res.usage)}\n`);
  console.log(res.answer || '(no answer)');
  console.log(`\nCitations (${res.citations.length}):`);
  for (const c of res.citations) console.log(`  ${c.position}. ${c.domain || '?'}  ${c.url}`);
  console.log(`\nVendors: ${res.vendors.map((v, i) => `${i + 1}. ${v}`).join(' | ') || '(none)'}`);
  if (values.brand) {
    const b = res.match.brand;
    console.log(
      `\n${brand.name}: mentioned=${b.mentioned} rank=${b.rank ?? '-'} cited=${b.cited}${b.citedUrl ? ` (${b.citedUrl})` : ''}`,
    );
    for (const c of res.match.competitors)
      console.log(`  ${c.name}: mentioned=${c.mentioned} rank=${c.rank ?? '-'} cited=${c.cited}`);
    if (res.match.suggested.length)
      console.log(`Suggested competitors: ${res.match.suggested.join(', ')}`);
  }
}

async function run(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...common,
      prompts: { type: 'string' },
      platforms: { type: 'string' },
      concurrency: { type: 'string', default: '6' },
      out: { type: 'string' },
      'no-retry-failed': { type: 'boolean' },
      force: { type: 'boolean' },
    },
  });
  loadEnv(values.env);
  if (!values.brand || !values.prompts || !values.platforms || !values.out) {
    throw new Error('run needs --brand, --prompts, --platforms and --out');
  }
  const platforms = splitList(values.platforms).map((p) => platformSchema.parse(p));
  const spec: RunSpec = {
    brand: {
      name: values.brand,
      domain: values.domain ?? null,
      aliases: splitList(values.aliases),
    },
    competitors: values.competitors ? loadCompetitors(resolvePath(values.competitors)) : [],
    prompts: loadPrompts(resolvePath(values.prompts)),
    platforms,
    ...location(values),
  };
  const engine = createEngine(engineConfigFromEnv(process.env));
  const ac = new AbortController();
  process.once('SIGINT', () => {
    console.error('\nStopping… finished checks are saved; run the same command again to resume.');
    ac.abort(new Error('interrupted'));
  });
  const outDir = resolvePath(values.out);
  const limits = providerLimitsFromEnv();
  const started = Date.now();
  const summary = await runBatch({
    spec,
    engine,
    outDir,
    concurrency: Number(values.concurrency),
    retryFailed: !values['no-retry-failed'],
    force: values.force ?? false,
    signal: ac.signal,
    log: (l) => console.log(l),
    ...(limits ? { limits } : {}),
  });
  console.log(
    `\nDone in ${Math.round((Date.now() - started) / 1000)} s: ${summary.ran} checks run, ${summary.skipped} skipped (already done). Output: ${outDir}`,
  );
  for (const [p, s] of Object.entries(summary.byPlatform)) {
    console.log(
      `  ${p.padEnd(10)} ok ${s.ok}  no_answer ${s.noAnswer}  failed ${s.failed}  cost ${fmtUsd(s.costMicros)}  per check ${fmtUsd(s.checks ? s.costMicros / s.checks : 0)}`,
    );
  }
}

async function exportCmd(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { in: { type: 'string' }, xlsx: { type: 'string' } },
  });
  if (!values.in || !values.xlsx) throw new Error('export needs --in and --xlsx');
  const out = resolvePath(values.xlsx);
  const { rows } = await exportRun(resolvePath(values.in), out);
  console.log(`Wrote ${rows} checks to ${out}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const commands: Record<string, (argv: string[]) => Promise<void>> = {
    ask,
    run,
    export: exportCmd,
  };
  const fn = cmd ? commands[cmd] : undefined;
  if (!fn) {
    console.log(USAGE);
    process.exitCode = cmd && cmd !== 'help' && cmd !== '--help' ? 1 : 0;
    return;
  }
  await fn(rest);
}

main().catch((e: unknown) => {
  if (e instanceof ProviderError)
    console.error(`${e.provider} ${e.kind}${e.status ? ` (${e.status})` : ''}: ${e.message}`);
  else if (e instanceof ExtractError) console.error(e.message);
  else console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
