import fs from 'node:fs';
import path from 'node:path';
import type { EntityInput } from '../types';

/** A prompt row. Extra columns come from keyword sheets (luna/Semrush layout). */
export interface PromptRow {
  prompt: string;
  category?: string;
  keyword?: string;
  volume?: number;
  kd?: number;
  intent?: string;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.startsWith('\u{FEFF}') ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

function toRow(o: Record<string, unknown>): PromptRow | null {
  const prompt = str(o.prompt) ?? str(o.question);
  if (!prompt) return null;
  const row: PromptRow = { prompt };
  const category = str(o.category);
  const keyword = str(o.keyword);
  const intent = str(o.intent);
  const volume = num(o.volume);
  const kd = num(o.kd);
  if (category) row.category = category;
  if (keyword) row.keyword = keyword;
  if (volume !== undefined) row.volume = volume;
  if (kd !== undefined) row.kd = kd;
  if (intent) row.intent = intent;
  return row;
}

/** Prompts from `.csv` (needs a `prompt` header), `.json` (strings or objects) or `.txt` (one per line). */
export function loadPrompts(file: string): PromptRow[] {
  const text = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  let rows: (PromptRow | null)[];
  if (ext === '.json') {
    const data = JSON.parse(text) as unknown;
    if (!Array.isArray(data)) throw new Error(`${file}: expected a JSON array`);
    rows = data.map((d) =>
      typeof d === 'string' ? toRow({ prompt: d }) : toRow(d as Record<string, unknown>),
    );
  } else if (ext === '.csv') {
    const [header, ...body] = parseCsv(text);
    const keys = (header ?? []).map((h) => h.trim().toLowerCase());
    if (!keys.includes('prompt') && !keys.includes('question')) {
      throw new Error(`${file}: the CSV needs a "prompt" column`);
    }
    rows = body.map((cells) => toRow(Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? '']))));
  } else {
    rows = text.split(/\r?\n/).map((l) => toRow({ prompt: l }));
  }
  const out = rows.filter((r): r is PromptRow => r !== null);
  if (!out.length) throw new Error(`${file}: no prompts found`);
  return out;
}

/** `[{ name, domain | website, aliases? }]`. */
export function loadCompetitors(file: string): EntityInput[] {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(data)) throw new Error(`${file}: expected a JSON array of competitors`);
  return data.map((d, i) => {
    const o = d as Record<string, unknown>;
    const name = str(o.name);
    if (!name) throw new Error(`${file}: competitor #${i + 1} has no name`);
    const domain = str(o.domain) ?? str(o.website) ?? null;
    const aliases = Array.isArray(o.aliases)
      ? o.aliases.filter((a): a is string => typeof a === 'string')
      : [];
    return { name, domain, aliases };
  });
}

export const splitList = (v: string | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
