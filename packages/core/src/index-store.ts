import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProjectIndex } from './types.js';
import { INDEXER_VERSION } from './scanner/index.js';

/**
 * Index persistence. The index is written next to the project in `.yummycode/`
 * and mirrored to a global cache keyed by a hash of the absolute path, so a
 * project can be reopened quickly without rescanning. Nothing leaves the disk.
 */

export function pathHash(projectRoot: string): string {
  return createHash('sha256').update(path.resolve(projectRoot)).digest('hex').slice(0, 16);
}

export function globalCacheDir(): string {
  const base =
    process.env.YUMMYCODE_CACHE_DIR ?? path.join(os.homedir(), '.cache', 'yummycode', 'indexes');
  return base;
}

function localIndexPath(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), '.yummycode', 'index.json');
}

function globalIndexPath(projectRoot: string): string {
  return path.join(globalCacheDir(), `${pathHash(projectRoot)}.json`);
}

export async function writeIndex(index: ProjectIndex): Promise<void> {
  const json = JSON.stringify(index, null, 2);
  const local = localIndexPath(index.root);
  const global = globalIndexPath(index.root);

  await fs.mkdir(path.dirname(local), { recursive: true }).catch(() => {});
  await fs.writeFile(local, json, 'utf8').catch(() => {
    // Local write can fail on read-only project dirs; the global cache is enough.
  });

  await fs.mkdir(path.dirname(global), { recursive: true });
  await fs.writeFile(global, json, 'utf8');
}

export async function readIndex(projectRoot: string): Promise<ProjectIndex | null> {
  for (const candidate of [localIndexPath(projectRoot), globalIndexPath(projectRoot)]) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as ProjectIndex;
      if (parsed.indexerVersion === INDEXER_VERSION) return parsed;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** True when a fresh scan should be preferred over any cached index. */
export function isStale(index: ProjectIndex, maxAgeMs = 1000 * 60 * 60 * 24 * 7): boolean {
  const age = Date.now() - new Date(index.scannedAt).getTime();
  return age > maxAgeMs || index.indexerVersion !== INDEXER_VERSION;
}
