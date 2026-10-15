/**
 * Turns a raw answer into the prose that mention checks run on (03 § Cleaning). Proven in the
 * Canadim run (`proseOf`): without it, brands whose name is part of their own domain get false
 * mentions from inline citations.
 */

// A URL inside markdown link parens; allows one level of balanced parens (Wikipedia-style URLs).
const LINK_URL = String.raw`https?:\/\/(?:[^()\s]|\([^()\s]*\))*`;
const LINK = String.raw`\[([^\]]*)\]\(${LINK_URL}\)`;

/** ` ([orion.com](https://…))` or ` ([a](u), [b](v))`: ChatGPT inline citation groups. */
const CITATION_GROUP = new RegExp(String.raw`\s*\(\s*${LINK}(?:\s*[,;]?\s*${LINK})*\s*\)`, 'g');
const MARKDOWN_LINK = new RegExp(LINK, 'g');
const BARE_URL = /https?:\/\/[^\s<>()\]]+/g;
/** Perplexity `[1]`, `[1][2]`, `[1, 2]` and Agent API `[web:3]` markers. */
export const CITATION_MARKER = /\[(?:web:)?\d+(?:\s*[,–-]\s*(?:web:)?\d+)*\]/g;

/** Link text that is just a domain, optionally with a path: `orion.com`, `www.x.co.uk/a`. */
const DOMAIN_TEXT = /^(?:www\.)?[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?:\/\S*)?$/i;

export function proseOf(answer: string): string {
  return answer
    .replace(CITATION_GROUP, '')
    .replace(MARKDOWN_LINK, (_m, text: string) => (DOMAIN_TEXT.test(text.trim()) ? '' : text))
    .replace(BARE_URL, '')
    .replace(CITATION_MARKER, '')
    .replace(/[ \t]+([.,;:!?)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Indexes (1-based) of the `[n]` / `[web:n]` markers used in an answer, in first-seen order. */
export function usedMarkers(answer: string): number[] {
  const out: number[] = [];
  for (const m of answer.matchAll(CITATION_MARKER)) {
    for (const n of m[0].matchAll(/\d+/g)) {
      const k = Number(n[0]);
      if (!out.includes(k)) out.push(k);
    }
  }
  return out;
}
