import path from 'node:path';
import type { DetectedRoute, EntryPoint, ManifestSummary } from '../types.js';
import { readTextSafe } from './walk.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

/**
 * Detect HTTP routes by scanning source for common framework call shapes:
 *   app.get('/path'), router.post('/path'), fastify.route, @app.get('/path'),
 *   Hono `.get('/path')`, etc. Purely lexical; good enough to describe a service.
 */
export async function detectRoutes(root: string, files: string[]): Promise<DetectedRoute[]> {
  const routes: DetectedRoute[] = [];
  const candidates = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    if (!['.ts', '.js', '.tsx', '.jsx', '.mjs', '.py', '.rb', '.go'].includes(ext)) return false;
    const base = path.basename(f).toLowerCase();
    return (
      /rout|api|server|app|main|index|handler|controller|endpoint/.test(f.toLowerCase()) ||
      base === 'main.py' ||
      base === 'app.py'
    );
  });

  // JS/TS/Python method-call style, e.g. app.get('/users', ...) or @router.post("/x")
  const callPattern = new RegExp(
    String.raw`(?:^|[^\w])(?:app|router|api|server|fastify|route|r)\.(` +
      HTTP_METHODS.join('|') +
      String.raw`)\s*\(\s*[` +
      '`' +
      String.raw`'"]([^` +
      '`' +
      String.raw`'"]+)`,
    'i',
  );
  const decoratorPattern = new RegExp(
    String.raw`@\w+\.(` + HTTP_METHODS.join('|') + String.raw`)\s*\(\s*['"]([^'"]+)`,
    'i',
  );

  for (const rel of candidates.slice(0, 80)) {
    const text = await readTextSafe(path.join(root, rel));
    if (!text) continue;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const m = line.match(callPattern) ?? line.match(decoratorPattern);
      if (m && m[1] && m[2]) {
        routes.push({
          method: m[1].toUpperCase(),
          path: m[2],
          file: rel,
          line: i + 1,
        });
      }
    }
    if (routes.length > 100) break;
  }

  // Deduplicate on method+path+file.
  const seen = new Set<string>();
  return routes.filter((r) => {
    const key = `${r.method} ${r.path} ${r.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Detect likely entry points from manifests and conventional filenames. */
export function detectEntryPoints(files: string[], manifests: ManifestSummary[]): EntryPoint[] {
  const entries: EntryPoint[] = [];
  const seen = new Set<string>();
  const add = (p: string, reason: string) => {
    if (seen.has(p)) return;
    seen.add(p);
    entries.push({ path: p, reason });
  };

  const fileSet = new Set(files);

  // From package.json main/bin/module fields would require re-reading; instead
  // rely on conventional names plus the manifest ecosystem hint.
  const conventional: Array<[string, string]> = [
    ['src/index.ts', 'conventional TypeScript entry'],
    ['src/index.js', 'conventional JavaScript entry'],
    ['src/main.ts', 'conventional entry'],
    ['src/main.tsx', 'React app entry'],
    ['src/main.py', 'Python entry'],
    ['main.py', 'Python entry'],
    ['app.py', 'Python app entry'],
    ['index.ts', 'entry'],
    ['index.js', 'entry'],
    ['server.ts', 'server entry'],
    ['server.js', 'server entry'],
    ['cmd/main.go', 'Go entry'],
    ['main.go', 'Go entry'],
    ['src/main.rs', 'Rust entry'],
    ['Sources/main.swift', 'Swift entry'],
  ];
  for (const [p, reason] of conventional) {
    if (fileSet.has(p)) add(p, reason);
  }

  // Any file literally named like a CLI bin under bin/.
  for (const f of files) {
    if (/^bin\//.test(f) || /\/bin\//.test(f)) add(f, 'bin script');
  }

  for (const m of manifests) {
    if (m.ecosystem === 'node' && m.scripts?.includes('start')) {
      // Nothing to resolve without the raw file, but note it.
    }
  }

  return entries.slice(0, 12);
}
