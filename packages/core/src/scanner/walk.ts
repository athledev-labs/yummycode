import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DirNode } from '../types.js';

/** Directories we never descend into. */
export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  '.build',
  'out',
  'target',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.idea',
  '.vscode',
  'vendor',
  'Pods',
  'DerivedData',
  '.gradle',
  '.yummycode',
]);

/** Dotfiles that carry useful signal and should still be indexed. */
const ALLOWED_DOTFILES = new Set(['.github', '.env.example', '.nvmrc', '.tool-versions']);

const IGNORED_FILE_EXT = new Set([
  '.lock',
  '.log',
  '.map',
  '.lcov',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.pdf',
  '.zip',
  '.gz',
  '.mov',
  '.mp4',
  '.woff',
  '.woff2',
  '.ttf',
]);

export interface WalkResult {
  tree: DirNode;
  files: string[];
  dirsScanned: number;
  filesScanned: number;
}

interface WalkOptions {
  maxDepth?: number;
  maxEntriesPerDir?: number;
}

/**
 * Walk a project directory, producing a bounded tree plus a flat list of
 * candidate files. Bounded so a huge repo cannot stall the scan.
 */
export async function walkProject(root: string, options: WalkOptions = {}): Promise<WalkResult> {
  const maxDepth = options.maxDepth ?? 6;
  const maxEntriesPerDir = options.maxEntriesPerDir ?? 200;
  const files: string[] = [];
  let dirsScanned = 0;
  let filesScanned = 0;

  async function walk(dir: string, depth: number): Promise<DirNode> {
    dirsScanned++;
    const rel = path.relative(root, dir) || '.';
    const node: DirNode = {
      name: depth === 0 ? path.basename(root) : path.basename(dir),
      path: rel,
      type: 'dir',
      children: [],
    };

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return node;
    }

    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    let count = 0;
    for (const entry of entries) {
      // Skip most dotfiles, but keep a few that carry real signal.
      if (entry.name.startsWith('.') && !ALLOWED_DOTFILES.has(entry.name)) continue;
      if (count >= maxEntriesPerDir) break;

      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (depth + 1 > maxDepth) {
          node.children!.push({
            name: entry.name,
            path: path.relative(root, full),
            type: 'dir',
          });
          count++;
          continue;
        }
        node.children!.push(await walk(full, depth + 1));
        count++;
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IGNORED_FILE_EXT.has(ext)) continue;
        filesScanned++;
        files.push(path.relative(root, full));
        node.children!.push({
          name: entry.name,
          path: path.relative(root, full),
          type: 'file',
        });
        count++;
      }
    }

    return node;
  }

  const tree = await walk(root, 0);
  return { tree, files, dirsScanned, filesScanned };
}

/** Read a file as text, bounded in size. Returns null on failure. */
export async function readTextSafe(file: string, maxBytes = 200_000): Promise<string | null> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return null;
    const handle = await fs.open(file, 'r');
    try {
      const size = Math.min(stat.size, maxBytes);
      const buffer = Buffer.alloc(size);
      await handle.read(buffer, 0, size, 0);
      // Reject binary content (presence of a NUL byte is a reliable signal).
      if (buffer.includes(0)) return null;
      return buffer.toString('utf8');
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}
