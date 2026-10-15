// `node scripts/scrub-n8n-export.mjs <export.json | folder> [...more]` (go-live 9.3).
//
// Reads n8n workflow exports (one workflow per file from the UI's "Download", or an array from
// `n8n export:workflow --all`), removes everything secret or personal, and writes one file per
// workflow plus an index to new-improvement/reference/n8n-export/. The export is kept only as a
// record of what v1 did (D-001); nothing reads it.
//
// Removed: credential ids, pinned and static data (real customer data), owner/sharing info,
// instance ids, webhook ids and paths (v1's n8n endpoints were reachable by anyone who knew them).
// Redacted: any parameter whose name looks secret, any header whose name looks secret, and any
// string anywhere that looks like an API key, bearer token, JWT, signing secret, password in a
// URI, or a key in a query string. Prints what it changed; review the output before committing.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR =
  process.env.N8N_EXPORT_OUT ??
  fileURLToPath(new URL('../new-improvement/reference/n8n-export/', import.meta.url));
const REDACTED = '[REDACTED]';

/** Names that contain a secret word but aren't secrets. */
const NOT_SECRET_NAME = /^(max_?tokens|max_?completion_?tokens|token_?limit|tokens)$/i;

const SECRET_NAME =
  /(api[-_]?key|apikey|token|secret|passw(or)?d|authorization|auth[-_]?header|bearer|private[-_]?key|client[-_]?secret|credential|signature|x-api-key|cookie)/i;

/** [pattern, replacement] pairs applied to every string value. */
const SECRET_VALUES = [
  [/\bsk-ant-[A-Za-z0-9_-]{10,}/g, REDACTED], // Anthropic
  [/\bsk-(proj-)?[A-Za-z0-9_-]{20,}/g, REDACTED], // OpenAI
  [/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{10,}/g, REDACTED], // Stripe keys
  [/\bwhsec_[A-Za-z0-9]{10,}/g, REDACTED], // Stripe webhook secrets
  [/\bpplx-[A-Za-z0-9]{20,}/g, REDACTED], // Perplexity
  [/\bAIza[0-9A-Za-z_-]{30,}/g, REDACTED], // Google
  [/\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{10,}/g, REDACTED], // Resend
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, REDACTED], // JWTs
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/:@'"]+:[^\s/@'"]+@/gi, `$1${REDACTED}@`], // user:pass@ in URIs
  [/((?:btoa|Buffer\.from)\(\s*)(['"`])[^'"`]+\2/g, `$1$2${REDACTED}$2`], // inline Basic-auth pairs
  [/([?&](?:api[-_]?key|key|token|secret|access_token|password)=)[^&\s'"]+/gi, `$1${REDACTED}`],
];

const stats = { files: 0, workflows: 0, redactions: 0 };

function scrubString(value) {
  let out = value;
  for (const [pattern, replacement] of SECRET_VALUES) out = out.replace(pattern, replacement);
  if (out !== value) stats.redactions++;
  return out;
}

/** Deep-copies `value`, redacting secret-named keys, secret-named headers and secret strings. */
function scrub(value, key = '') {
  if (typeof value === 'string') {
    const secretName = SECRET_NAME.test(key) && !NOT_SECRET_NAME.test(key);
    if (secretName && value !== '' && !value.startsWith('={{')) {
      stats.redactions++;
      return REDACTED;
    }
    return scrubString(value);
  }
  if (Array.isArray(value)) return value.map((item) => scrub(item, key));
  if (value && typeof value === 'object') {
    // `{ name: 'Authorization', value: '…' }` pairs (HTTP Request headers, query params).
    const pairName = typeof value.name === 'string' ? value.name : '';
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = k === 'value' && SECRET_NAME.test(pairName) ? scrub(v, pairName) : scrub(v, k);
    }
    return out;
  }
  return value;
}

function scrubWorkflow(wf) {
  const nodes = (wf.nodes ?? []).map((node) => {
    const { credentials, webhookId: _webhookId, ...rest } = node;
    const clean = scrub(rest);
    if (credentials) {
      // Keep which credential type a node used, not the id.
      clean.credentials = Object.fromEntries(
        Object.entries(credentials).map(([type, ref]) => [type, { name: ref?.name ?? type }]),
      );
    }
    if (/webhook/i.test(node.type ?? '') && clean.parameters?.path) {
      clean.parameters.path = REDACTED;
      stats.redactions++;
    }
    return clean;
  });
  return {
    name: wf.name,
    active: wf.active ?? false,
    nodes,
    connections: wf.connections ?? {},
    settings: scrub(wf.settings ?? {}),
    tags: (wf.tags ?? []).map((t) => (typeof t === 'string' ? t : t.name)),
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  };
}

function collectFiles(paths) {
  return paths.flatMap((p) => {
    const full = resolve(p);
    if (statSync(full).isDirectory()) {
      return readdirSync(full)
        .filter((f) => extname(f).toLowerCase() === '.json')
        .map((f) => join(full, f));
    }
    return [full];
  });
}

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'workflow';

function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error('Usage: node scripts/scrub-n8n-export.mjs <export.json | folder> [...more]');
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const index = [];
  const used = new Set();
  for (const file of collectFiles(inputs)) {
    stats.files++;
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    const workflows = Array.isArray(parsed) ? parsed : [parsed];
    for (const wf of workflows) {
      if (!wf || !Array.isArray(wf.nodes)) {
        console.warn(`skipped (not a workflow): ${basename(file)}`);
        continue;
      }
      stats.workflows++;
      const clean = scrubWorkflow(wf);
      let name = slug(clean.name ?? basename(file, '.json'));
      for (let i = 2; used.has(name); i++) name = `${slug(clean.name)}-${i}`;
      used.add(name);
      writeFileSync(join(OUT_DIR, `${name}.json`), `${JSON.stringify(clean, null, 2)}\n`);
      const triggers = clean.nodes
        .map((n) => n.type ?? '')
        .filter((t) => /trigger|webhook|cron|schedule/i.test(t))
        .map((t) => t.replace(/^n8n-nodes-base\./, ''));
      index.push({
        file: `${name}.json`,
        name: clean.name,
        active: clean.active,
        nodes: clean.nodes.length,
        triggers,
      });
    }
  }

  const rows = index
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (w) =>
        `| [${w.name}](${w.file}) | ${w.active ? 'yes' : 'no'} | ${w.nodes} | ${w.triggers.join(', ') || '—'} |`,
    );
  writeFileSync(
    join(OUT_DIR, 'README.md'),
    [
      '# n8n workflow export (v1, retired)',
      '',
      'A record of the n8n workflows v1 used, exported at go-live (TODO 9.2) and scrubbed by',
      '`scripts/scrub-n8n-export.mjs` (9.3): credential ids, pinned data, webhook ids and paths are',
      'removed, and secret-looking values read `[REDACTED]`. Nothing in v2 reads these files (D-001).',
      '',
      '"Active" is the state in the export: export after deactivating, so every row should say "no".',
      '',
      '| Workflow | Active at export | Nodes | Triggers |',
      '|---|---|---|---|',
      ...rows,
      '',
    ].join('\n'),
  );

  console.log(
    `scrubbed ${stats.workflows} workflow(s) from ${stats.files} file(s); ${stats.redactions} value(s) redacted → ${OUT_DIR}`,
  );
  const stillActive = index.filter((w) => w.active).map((w) => w.name);
  if (stillActive.length) console.warn(`still active in the export: ${stillActive.join(', ')}`);
}

main();
