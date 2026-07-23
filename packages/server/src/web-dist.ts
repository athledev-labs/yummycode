import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locate the built browser app. Checks the env override, then walks up from
 * this module looking for packages/web/dist. Returns null if not built yet.
 */
export function resolveWebDist(): string | null {
  const fromEnv = process.env.YUMMYCODE_WEB_DIST;
  if (fromEnv && existsSync(path.join(fromEnv, 'index.html'))) return fromEnv;

  const here = path.dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'packages', 'web', 'dist', 'index.html');
    if (existsSync(candidate)) return path.dirname(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
