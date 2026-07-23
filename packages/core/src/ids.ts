import { randomBytes } from 'node:crypto';

/** Short URL-safe id, e.g. for sessions and turns. */
export function newId(prefix = ''): string {
  const raw = randomBytes(9).toString('base64url');
  return prefix ? `${prefix}_${raw}` : raw;
}
