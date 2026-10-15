import pkg from '../package.json' with { type: 'json' };

/** Package version, plus the short commit on Render (RENDER_GIT_COMMIT is set there). */
const commit = process.env.RENDER_GIT_COMMIT?.slice(0, 7);
export const VERSION = commit ? `${pkg.version}+${commit}` : pkg.version;
