import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProjectIndex } from '../types.js';
import { buildChunks } from './chunks.js';
import { detectEntryPoints, detectRoutes } from './routes.js';
import { parseManifests } from './manifests.js';
import { readTextSafe, walkProject } from './walk.js';

/**
 * Cache-schema revision, not a release version. Written into each on-disk index
 * and compared on read; bump it whenever the scanner's output changes so stale
 * caches are re-generated instead of served. Independent of the package version.
 */
export const INDEXER_VERSION = 'rev-2';

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.swift': 'Swift',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.cs': 'C#',
  '.php': 'PHP',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

const CONFIG_FILE_NAMES = new Set([
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'webpack.config.js',
  'rollup.config.js',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  'makefile',
  'vercel.json',
  'netlify.toml',
  'turbo.json',
  'pnpm-workspace.yaml',
  'eslint.config.js',
  '.eslintrc.json',
  '.prettierrc',
  'jest.config.js',
  'vitest.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',
]);

export interface ScanProgressEvent {
  phase: 'walk' | 'readme' | 'manifests' | 'routes' | 'chunks' | 'done';
  message: string;
  /** 0..1 progress within the overall scan. */
  progress: number;
}

export type ScanProgress = (event: ScanProgressEvent) => void;

/**
 * Scan a project directory into a fully local ProjectIndex. Reads only text,
 * never executes anything, and stays bounded so large repos finish quickly.
 */
export async function scanProject(root: string, onProgress?: ScanProgress): Promise<ProjectIndex> {
  const start = Date.now();
  const abs = path.resolve(root);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Not a directory: ${abs}`);
  }

  const emit = (e: ScanProgressEvent) => onProgress?.(e);

  emit({ phase: 'walk', message: 'Reading directory tree', progress: 0.1 });
  const { tree, files, dirsScanned, filesScanned } = await walkProject(abs);

  // Language + extension tallies.
  const fileCounts: Record<string, number> = {};
  const langCounts: Record<string, number> = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!ext) continue;
    fileCounts[ext] = (fileCounts[ext] ?? 0) + 1;
    const lang = LANGUAGE_BY_EXT[ext];
    if (lang) langCounts[lang] = (langCounts[lang] ?? 0) + 1;
  }
  const languages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  emit({ phase: 'readme', message: 'Reading README', progress: 0.3 });
  const readmeRel = files.find((f) => /^readme(\.md|\.rst|\.txt)?$/i.test(path.basename(f)));
  const readme = readmeRel ? await readTextSafe(path.join(abs, readmeRel), 40_000) : null;

  emit({ phase: 'manifests', message: 'Parsing manifests', progress: 0.45 });
  const manifests = await parseManifests(abs, files);

  emit({ phase: 'routes', message: 'Detecting entry points and routes', progress: 0.65 });
  const routes = await detectRoutes(abs, files);
  const entryPoints = detectEntryPoints(files, manifests);

  const configFiles = files.filter((f) => CONFIG_FILE_NAMES.has(path.basename(f).toLowerCase()));

  // Derive name + description.
  const nodeManifest = manifests.find((m) => m.ecosystem === 'node');
  const anyNamed = manifests.find((m) => m.name);
  const name = nodeManifest?.name ?? anyNamed?.name ?? path.basename(abs);
  const description =
    nodeManifest?.description ?? anyNamed?.description ?? firstReadmeLine(readme) ?? undefined;

  emit({ phase: 'chunks', message: 'Building index', progress: 0.85 });
  const chunks = buildChunks({
    readme: readme ?? undefined,
    manifests,
    structure: tree,
    entryPoints,
    routes,
    configFiles,
    languages,
  });

  const index: ProjectIndex = {
    root: abs,
    name,
    description,
    languages,
    fileCounts,
    readme: readme ?? undefined,
    manifests,
    structure: tree,
    entryPoints,
    routes,
    configFiles,
    chunks,
    scannedAt: new Date().toISOString(),
    indexerVersion: INDEXER_VERSION,
    stats: {
      filesScanned,
      dirsScanned,
      bytesRead: 0,
      durationMs: Date.now() - start,
    },
  };

  emit({ phase: 'done', message: 'Index ready', progress: 1 });
  return index;
}

function firstReadmeLine(readme: string | null): string | undefined {
  if (!readme) return undefined;
  for (const raw of readme.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    if (line.startsWith('!') || line.startsWith('[')) continue;
    if (line.startsWith('<')) continue;
    return line.replace(/[*_`]/g, '').slice(0, 200);
  }
  return undefined;
}
