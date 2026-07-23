import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
}

export interface DirCandidate {
  name: string;
  fullPath: string;
}

/**
 * List directory candidates for the current query. If the query points at an
 * existing directory, list its children; otherwise list siblings of the final
 * path segment filtered by that segment (fuzzy-ish prefix/substring match).
 */
export async function listCandidates(query: string): Promise<DirCandidate[]> {
  const expanded = expandHome(query.trim() || '.');
  const abs = path.resolve(expanded);

  let baseDir = abs;
  let fragment = '';
  const stat = await fs.stat(abs).catch(() => null);
  const endsWithSep = query.endsWith('/');
  if (!stat?.isDirectory() || (!endsWithSep && stat?.isDirectory() && query.trim() !== '')) {
    // Treat the last segment as a filter fragment unless the query ends in "/".
    if (!endsWithSep) {
      baseDir = path.dirname(abs);
      fragment = path.basename(abs).toLowerCase();
    }
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .filter((e) => !fragment || e.name.toLowerCase().includes(fragment))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8)
    .map((e) => ({ name: e.name, fullPath: path.join(baseDir, e.name) }));
}

export async function isDirectory(p: string): Promise<boolean> {
  const stat = await fs.stat(path.resolve(expandHome(p))).catch(() => null);
  return Boolean(stat?.isDirectory());
}
