import { EXTRACT_PROMPT_HASH } from './extract';

/** Bump when adapter, cleaning or matching behaviour changes (results stay explainable). */
export const ENGINE_SEMVER = '0.1.0';

/** `engine@<semver>+extract:<model>:<promptHash>`, stamped on every run (03). */
export const engineVersion = (extractModel: string): string =>
  `engine@${ENGINE_SEMVER}+extract:${extractModel}:${EXTRACT_PROMPT_HASH}`;
