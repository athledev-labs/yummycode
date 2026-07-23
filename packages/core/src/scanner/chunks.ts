import type { DetectedRoute, DirNode, EntryPoint, IndexChunk, ManifestSummary } from '../types.js';

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'into',
  'your',
  'you',
  'our',
  'are',
  'was',
  'has',
  'have',
  'not',
  'but',
  'all',
  'can',
  'use',
  'used',
  'using',
  'via',
  'per',
  'a',
  'an',
  'of',
  'to',
  'in',
  'is',
  'it',
  'on',
  'or',
  'as',
  'by',
  'be',
  'we',
]);

/** Extract lowercase keyword tokens for lexical scoring. */
export function keywordize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && t.length < 40 && !STOPWORDS.has(t));
  return [...new Set(tokens)];
}

let counter = 0;
function chunkId(kind: string): string {
  counter += 1;
  return `${kind}-${counter}`;
}

/** Reset chunk id counter (used so repeated scans in a process stay stable). */
export function resetChunkIds(): void {
  counter = 0;
}

function summarizeTree(node: DirNode, depth = 0, lines: string[] = []): string[] {
  if (depth > 2) return lines;
  const indent = '  '.repeat(depth);
  if (node.type === 'dir' && node.children) {
    const dirs = node.children.filter((c) => c.type === 'dir');
    const fileCount = node.children.filter((c) => c.type === 'file').length;
    if (depth > 0) {
      lines.push(`${indent}${node.name}/ (${fileCount} files, ${dirs.length} subdirs)`);
    }
    for (const child of dirs.slice(0, 12)) {
      summarizeTree(child, depth + 1, lines);
    }
  }
  return lines;
}

export interface ChunkInputs {
  readme?: string;
  manifests: ManifestSummary[];
  structure: DirNode;
  entryPoints: EntryPoint[];
  routes: DetectedRoute[];
  configFiles: string[];
  languages: string[];
}

/** Build the retrievable chunk set that grounds the conversation. */
export function buildChunks(inputs: ChunkInputs): IndexChunk[] {
  resetChunkIds();
  const chunks: IndexChunk[] = [];
  const push = (c: Omit<IndexChunk, 'id' | 'keywords'> & { keywords?: string[] }) => {
    chunks.push({
      id: chunkId(c.kind),
      keywords: c.keywords ?? keywordize(`${c.title} ${c.content}`),
      ...c,
    });
  };

  if (inputs.readme) {
    for (const section of splitReadme(inputs.readme)) {
      push({
        kind: 'readme',
        path: 'README.md',
        title: section.title,
        content: section.content,
      });
    }
  }

  for (const m of inputs.manifests) {
    const parts: string[] = [`${m.ecosystem} manifest (${m.file}).`];
    if (m.name) parts.push(`name: ${m.name}.`);
    if (m.description) parts.push(m.description);
    if (m.scripts?.length) parts.push(`scripts: ${m.scripts.join(', ')}.`);
    if (m.dependencies?.length) parts.push(`dependencies: ${m.dependencies.join(', ')}.`);
    push({
      kind: 'manifest',
      path: m.file,
      title: `${m.file} (${m.ecosystem})`,
      content: parts.join(' '),
    });
  }

  const treeLines = summarizeTree(inputs.structure);
  if (treeLines.length) {
    push({
      kind: 'structure',
      path: '.',
      title: 'Project structure',
      content: `Primary languages: ${inputs.languages.join(', ') || 'unknown'}.\n${treeLines.join('\n')}`,
    });
  }

  if (inputs.entryPoints.length) {
    push({
      kind: 'entrypoint',
      path: '.',
      title: 'Entry points',
      content: inputs.entryPoints.map((e) => `${e.path} (${e.reason})`).join('; '),
    });
  }

  if (inputs.routes.length) {
    // Group routes into a single chunk plus a few per-file chunks.
    const list = inputs.routes.map((r) => `${r.method} ${r.path} -> ${r.file}:${r.line}`);
    push({
      kind: 'route',
      path: '.',
      title: `HTTP routes (${inputs.routes.length})`,
      content: list.join('\n'),
    });
  }

  if (inputs.configFiles.length) {
    push({
      kind: 'config',
      path: '.',
      title: 'Config files',
      content: inputs.configFiles.join(', '),
    });
  }

  return chunks;
}

interface ReadmeSection {
  title: string;
  content: string;
}

/** Split a README on markdown headings into retrievable sections. */
function splitReadme(readme: string): ReadmeSection[] {
  const lines = readme.split('\n');
  const sections: ReadmeSection[] = [];
  let title = 'README';
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (content) sections.push({ title: `README: ${title}`, content: content.slice(0, 1500) });
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.*)/);
    if (heading && heading[1]) {
      flush();
      title = heading[1].replace(/[#*`]/g, '').trim().slice(0, 60) || 'section';
    } else {
      buffer.push(line);
    }
  }
  flush();

  // Keep the first handful of meaningful sections.
  return sections.filter((s) => s.content.length > 40).slice(0, 10);
}
