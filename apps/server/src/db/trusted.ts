import mongoose from 'mongoose';

/**
 * `sanitizeFilter` (connection.ts) turns any `{ $op: … }` object in a query filter into an `$eq`
 * match, so user input can't smuggle operators in. Server code that needs a real operator in a
 * filter wraps it in `op()`. Only ever wrap operators the server builds, never raw user input.
 */
export const op = <T extends object>(operator: T): T => mongoose.trusted<T>(operator);
