/**
 * The HTML shell every email shares: table layout and inline styles, because email clients ignore
 * stylesheets. Every value put into the HTML goes through `esc`; the parts below are built only
 * from escaped text and our own markup.
 */

const BRAND = '#7c3aed';
const TEXT = '#1f2937';
const MUTED = '#6b7280';

export const esc = (value: string | number): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** A piece of trusted HTML (built here from escaped values). */
export interface Html {
  readonly html: string;
}
const html = (s: string): Html => ({ html: s });

export const p = (text: string): Html =>
  html(`<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT}">${esc(text)}</p>`);

export const muted = (text: string): Html =>
  html(`<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">${esc(text)}</p>`);

export const button = (label: string, href: string): Html =>
  html(
    `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${esc(label)}</a></p>`,
  );

/** A two-column list of facts ("Next run", "Credits per run", …). */
export const facts = (rows: readonly (readonly [string, string])[]): Html =>
  html(
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;border-collapse:collapse">${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:8px 12px 8px 0;font-size:14px;color:${MUTED};white-space:nowrap;vertical-align:top;border-bottom:1px solid #f3f4f6">${esc(k)}</td><td style="padding:8px 0;font-size:14px;color:${TEXT};font-weight:600;border-bottom:1px solid #f3f4f6">${esc(v)}</td></tr>`,
      )
      .join('')}</table>`,
  );

export function page(opts: { preheader: string; heading: string; body: readonly Html[] }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="font-size:20px;font-weight:800;color:${BRAND};padding-bottom:20px">PromptVerse</td></tr>
<tr><td><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${TEXT}">${esc(opts.heading)}</h1>
${opts.body.map((b) => b.html).join('\n')}
</td></tr></table>
<p style="font-size:12px;color:${MUTED};margin:16px 0 0">PromptVerse · AI search visibility</p>
</td></tr></table></body></html>`;
}
