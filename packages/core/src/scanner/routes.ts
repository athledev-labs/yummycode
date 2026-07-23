import path from 'node:path';
import type { DetectedRoute, EntryPoint, ManifestSummary } from '../types.js';
import { readTextSafe } from './walk.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

/** Line-based route patterns across frameworks. Each returns [method, path]. */
interface LinePattern {
  re: RegExp;
  method: (m: RegExpMatchArray) => string;
  path: (m: RegExpMatchArray) => string;
}

const LINE_PATTERNS: LinePattern[] = [
  // Express / Hono / Fastify / Koa style: app.get('/x'), router.post("/x")
  {
    re: new RegExp(
      String.raw`(?:^|[^\w.])(?:app|router|api|server|fastify|route|r|http)\.(` +
        HTTP_METHODS.join('|') +
        String.raw`)\s*\(\s*['"` +
        '`' +
        String.raw`]([^'"` +
        '`' +
        String.raw`]+)`,
      'i',
    ),
    method: (m) => m[1]!.toUpperCase(),
    path: (m) => m[2]!,
  },
  // FastAPI / Flask decorators: @app.get("/x"), @router.post("/x")
  {
    re: new RegExp(
      String.raw`@\w+\.(` + HTTP_METHODS.join('|') + String.raw`)\s*\(\s*['"]([^'"]+)`,
      'i',
    ),
    method: (m) => m[1]!.toUpperCase(),
    path: (m) => m[2]!,
  },
  // NestJS decorators: @Get('/x'), @Post()
  {
    re: /@(Get|Post|Put|Patch|Delete|Options|Head)\(\s*['"]?([^'")]*)/,
    method: (m) => m[1]!.toUpperCase(),
    path: (m) => (m[2] ? (m[2].startsWith('/') ? m[2] : `/${m[2]}`) : '/'),
  },
  // Spring: @GetMapping("/x"), @RequestMapping(value = "/x")
  {
    re: /@(Get|Post|Put|Patch|Delete|Request)Mapping\s*\(\s*(?:value\s*=\s*)?['"]([^'"]+)/,
    method: (m) => (m[1] === 'Request' ? 'ANY' : m[1]!.toUpperCase()),
    path: (m) => m[2]!,
  },
  // Rails routes.rb: get 'x', post "x"
  {
    re: new RegExp(String.raw`^\s*(` + HTTP_METHODS.join('|') + String.raw`)\s+['"]([^'"]+)`, 'i'),
    method: (m) => m[1]!.toUpperCase(),
    path: (m) => (m[2]!.startsWith('/') ? m[2]! : `/${m[2]!}`),
  },
  // Django urls.py: path('x/', ...), re_path(r'^x$', ...)
  {
    re: /\b(?:path|re_path|url)\(\s*r?['"]([^'"]*)['"]/,
    method: () => 'ANY',
    path: (m) => (m[1]!.startsWith('/') ? m[1]! : `/${m[1]!}`),
  },
];

const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|#|<!--)/;

function isRouteCandidate(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file).toLowerCase();
  if (base === 'urls.py' || base === 'routes.rb' || base === 'route.ts' || base === 'route.js')
    return true;
  if (!['.ts', '.js', '.tsx', '.jsx', '.mjs', '.py', '.rb', '.go', '.java', '.kt'].includes(ext))
    return false;
  const lower = file.toLowerCase();
  return (
    /rout|api|server|app|main|index|handler|controller|endpoint|urls/.test(lower) ||
    base === 'main.py' ||
    base === 'app.py'
  );
}

/**
 * Detect HTTP routes by scanning source for common framework shapes across
 * Express, Hono, Fastify, FastAPI, Flask, NestJS, Spring, Rails, Django, and
 * Next.js app-router files. Purely lexical, and comment lines are skipped so
 * example calls in documentation do not produce phantom routes.
 */
export async function detectRoutes(root: string, files: string[]): Promise<DetectedRoute[]> {
  const routes: DetectedRoute[] = [];
  const candidates = files.filter(isRouteCandidate);

  for (const rel of candidates.slice(0, 120)) {
    const text = await readTextSafe(path.join(root, rel));
    if (!text) continue;

    // Next.js app router: app/**/route.ts exporting HTTP method functions.
    if (/(^|\/)route\.(ts|js|tsx|mjs)$/.test(rel) && /(^|\/)app\//.test(rel)) {
      for (const r of nextAppRoutes(rel, text)) routes.push(r);
      continue;
    }

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (COMMENT_LINE.test(line)) continue;
      for (const pattern of LINE_PATTERNS) {
        const m = line.match(pattern.re);
        if (m) {
          routes.push({ method: pattern.method(m), path: pattern.path(m), file: rel, line: i + 1 });
          break;
        }
      }
    }
    if (routes.length > 200) break;
  }

  const seen = new Set<string>();
  return routes.filter((r) => {
    const key = `${r.method} ${r.path} ${r.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Derive routes from a Next.js app-router file and its folder path. */
function nextAppRoutes(rel: string, text: string): DetectedRoute[] {
  const dir = path.dirname(rel);
  const afterApp = dir.replace(/.*?(^|\/)app\/?/, '');
  const routePath = '/' + afterApp.replace(/\([^)]*\)\/?/g, '').replace(/\/$/, '');
  const out: DetectedRoute[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(
      /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
    );
    if (m) out.push({ method: m[1]!, path: routePath || '/', file: rel, line: i + 1 });
  }
  return out;
}

const MONOREPO_ENTRY =
  /(?:^|\/)(?:packages|apps|services)\/[^/]+\/src\/(?:index|main|cli|server)\.(ts|tsx|js|mjs)$/;

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

  // Declared main and bin targets from manifests, when the file exists in source.
  for (const m of manifests) {
    if (m.main && fileSet.has(normalizeRel(m.main))) add(normalizeRel(m.main), 'package.json main');
    for (const b of m.bin ?? []) {
      if (fileSet.has(normalizeRel(b))) add(normalizeRel(b), 'package.json bin');
    }
  }

  // Monorepo package entries.
  for (const f of files) {
    if (MONOREPO_ENTRY.test(f)) add(f, 'workspace package entry');
  }

  // Any file under a bin/ directory.
  for (const f of files) {
    if (/^bin\//.test(f) || /\/bin\//.test(f)) add(f, 'bin script');
  }

  return entries.slice(0, 16);
}

function normalizeRel(p: string): string {
  return p.replace(/^\.\//, '');
}
