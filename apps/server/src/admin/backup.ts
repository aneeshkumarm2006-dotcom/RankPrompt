import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import mongoose from 'mongoose';
import { AdminError } from './index';

/**
 * Backups of the v2 database (TODO 8.4), behind `pnpm db:backup` (scripts/backup.ts).
 *
 * `dump` runs `mongodump` (MongoDB Database Tools) on the database named in the URI and writes a
 * gzip archive plus a manifest: every collection's document count just before and just after the
 * dump, and its index names. `restore` loads an archive into a **scratch** database (its name must
 * contain `restore` or `scratch`, and can't be the source's), then `verifyRestore` compares the
 * scratch database with the manifest. The CLI also runs the ledger reconciliation on it.
 *
 * The URI goes to the tools through a temporary config file (mode 600), never on the command line,
 * so the password doesn't show up in the process list. Logs show it as `***`.
 */

export interface CollectionManifest {
  before: number;
  after: number;
  indexes: string[];
}

export interface BackupManifest {
  version: 1;
  db: string;
  archive: string;
  startedAt: string;
  finishedAt: string;
  tools: string;
  collections: Record<string, CollectionManifest>;
}

export interface RestoreCheck {
  ok: boolean;
  collections: {
    name: string;
    expected: string;
    restored: number;
    indexesOk: boolean;
    ok: boolean;
  }[];
  problems: string[];
}

const URI_RE = /^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/([^?]*))?(\?.*)?$/;

/** Splits a MongoDB URI into its base, database name and query string. */
export function parseMongoUri(uri: string): { base: string; db: string; query: string } {
  const m = URI_RE.exec(uri.trim());
  if (!m?.[1]) throw new AdminError('not a mongodb:// or mongodb+srv:// URI');
  return { base: m[1], db: decodeURIComponent(m[2] ?? ''), query: m[3] ?? '' };
}

/** The same URI pointing at another database (empty = none). */
export const withDb = (uri: string, db: string): string => {
  const { base, query } = parseMongoUri(uri);
  return `${base}/${encodeURIComponent(db)}${query}`;
};

/** For logs: the credentials are replaced with `***`. */
export const redactUri = (uri: string): string => uri.replace(/\/\/[^@/]+@/, '//***@');

/** A scratch database name: never the live one. */
export function assertScratchDb(target: string, source: string): void {
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(target)) {
    throw new AdminError('--to must be a plain database name (letters, digits, _ and -)');
  }
  if (!/restore|scratch/i.test(target)) {
    throw new AdminError(
      `--to must contain "restore" or "scratch" (got "${target}"), so a typo can't overwrite a live database`,
    );
  }
  if (target === source) throw new AdminError('--to must differ from the backed-up database');
}

function toolPath(tool: 'mongodump' | 'mongorestore'): string {
  const dir = process.env.MONGO_TOOLS_DIR;
  const exe = process.platform === 'win32' ? `${tool}.exe` : tool;
  return dir ? join(dir, exe) : exe;
}

/** Runs a Database Tools binary with the URI in a temporary config file. */
async function runTool(
  tool: 'mongodump' | 'mongorestore',
  uri: string,
  args: string[],
): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'pv-backup-'));
  const config = join(dir, 'config.yaml');
  writeFileSync(config, `uri: ${JSON.stringify(uri)}\n`, { mode: 0o600 });
  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(toolPath(tool), [`--config=${config}`, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.on('data', (d: Buffer) => (output += d.toString()));
      child.stderr.on('data', (d: Buffer) => (output += d.toString()));
      child.on('error', (err: NodeJS.ErrnoException) =>
        reject(
          err.code === 'ENOENT'
            ? new AdminError(
                `${tool} not found. Install the MongoDB Database Tools ` +
                  '(Windows: `winget install MongoDB.DatabaseTools`; macOS: `brew install mongodb-database-tools`) ' +
                  'or set MONGO_TOOLS_DIR to the folder that holds them.',
              )
            : err,
        ),
      );
      child.on('close', (code) => {
        const clean = redactUri(output);
        if (code === 0) resolve(clean);
        else reject(new AdminError(`${tool} exited with code ${code}:\n${clean.slice(-4000)}`));
      });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function toolsVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(toolPath('mongodump'), ['--version'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', () => resolve(''));
    child.on('close', () => resolve(out.split('\n')[0]?.trim() ?? ''));
  });
}

/** Document counts and index names per collection, with the native driver. */
async function describeDb(
  uri: string,
  db: string,
): Promise<Record<string, { count: number; indexes: string[] }>> {
  const client = new mongoose.mongo.MongoClient(withDb(uri, db));
  await client.connect();
  try {
    const out: Record<string, { count: number; indexes: string[] }> = {};
    const handle = client.db(db);
    const collections = await handle.listCollections({}, { nameOnly: true }).toArray();
    for (const { name } of collections) {
      if (name.startsWith('system.')) continue;
      const c = handle.collection(name);
      const indexes = (await c.indexes()).map((i) => String(i.name)).sort();
      out[name] = { count: await c.countDocuments({}), indexes };
    }
    return out;
  } finally {
    await client.close();
  }
}

/** `mongodump` of the URI's database into `<outDir>/<db>-<UTC time>.archive.gz` + manifest. */
export async function dumpDatabase(opts: {
  uri: string;
  outDir: string;
  now?: Date;
}): Promise<{ archive: string; manifestPath: string; manifest: BackupManifest }> {
  const { db } = parseMongoUri(opts.uri);
  if (!db) throw new AdminError('put the database name in the URI (…/promptverse_v2?…)');
  mkdirSync(opts.outDir, { recursive: true });
  const started = opts.now ?? new Date();
  const stamp = started.toISOString().replace(/[:.]/g, '-');
  const archive = join(opts.outDir, `${db}-${stamp}.archive.gz`);

  const before = await describeDb(opts.uri, db);
  await runTool('mongodump', opts.uri, [`--archive=${archive}`, '--gzip']);
  const after = await describeDb(opts.uri, db);

  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const manifest: BackupManifest = {
    version: 1,
    db,
    archive: basename(archive),
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    tools: await toolsVersion(),
    collections: Object.fromEntries(
      names.map((n) => [
        n,
        {
          before: before[n]?.count ?? 0,
          after: after[n]?.count ?? 0,
          indexes: (after[n] ?? before[n])?.indexes ?? [],
        },
      ]),
    ),
  };
  const manifestPath = archive.replace(/\.archive\.gz$/, '.manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { archive, manifestPath, manifest };
}

export const readManifest = (archive: string): BackupManifest =>
  JSON.parse(
    readFileSync(archive.replace(/\.archive\.gz$/, '.manifest.json'), 'utf8'),
  ) as BackupManifest;

/**
 * Restores an archive into the scratch database `to` on the cluster of `uri` (whatever database
 * the URI names is ignored), replacing what a previous scratch restore left there.
 */
export async function restoreArchive(opts: {
  archive: string;
  uri: string;
  to: string;
}): Promise<{ manifest: BackupManifest; output: string }> {
  const manifest = readManifest(opts.archive);
  assertScratchDb(opts.to, manifest.db);
  const client = new mongoose.mongo.MongoClient(withDb(opts.uri, opts.to));
  await client.connect();
  try {
    await client.db(opts.to).dropDatabase();
  } finally {
    await client.close();
  }
  const output = await runTool('mongorestore', withDb(opts.uri, ''), [
    `--archive=${opts.archive}`,
    '--gzip',
    `--nsInclude=${manifest.db}.*`,
    `--nsFrom=${manifest.db}.*`,
    `--nsTo=${opts.to}.*`,
  ]);
  return { manifest, output };
}

/**
 * Compares a restored database with the manifest: every collection is there, its count lies
 * between the counts taken before and after the dump (the app may have written meanwhile), and
 * it has the same indexes.
 */
export async function verifyRestore(opts: {
  uri: string;
  db: string;
  manifest: BackupManifest;
}): Promise<RestoreCheck> {
  const restored = await describeDb(opts.uri, opts.db);
  const problems: string[] = [];
  const collections = Object.entries(opts.manifest.collections).map(([name, m]) => {
    const got = restored[name];
    const lo = Math.min(m.before, m.after);
    const hi = Math.max(m.before, m.after);
    const count = got?.count ?? -1;
    const countOk = count >= lo && count <= hi;
    const indexesOk = JSON.stringify(got?.indexes ?? []) === JSON.stringify(m.indexes);
    if (!got) problems.push(`${name}: missing`);
    else if (!countOk) problems.push(`${name}: ${count} documents, expected ${lo}–${hi}`);
    if (got && !indexesOk) problems.push(`${name}: indexes differ`);
    return {
      name,
      expected: lo === hi ? String(lo) : `${lo}–${hi}`,
      restored: count,
      indexesOk,
      ok: !!got && countOk && indexesOk,
    };
  });
  for (const name of Object.keys(restored)) {
    if (!(name in opts.manifest.collections)) problems.push(`${name}: not in the manifest`);
  }
  return { ok: problems.length === 0, collections, problems };
}
