/** `/share/<token>` → `/share/[token]`, and `token=<value>` → `token=[token]` (8.3). */
export const maskSecretUrl = (url: string): string =>
  url.replace(/(\/share\/)[^/?#]+/, '$1[token]').replace(/([?&]token=)[^&#]*/g, '$1[token]');
