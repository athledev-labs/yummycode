import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Context } from 'hono';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/**
 * Serve a built single-page app from `webDist`. Static assets resolve directly;
 * any other path falls back to index.html so client-side routing works.
 */
export function createStaticHandler(webDist: string | null) {
  return async (c: Context): Promise<Response> => {
    if (!webDist) {
      return c.text(
        'yummycode server is running. The browser UI was not built. Run: pnpm build:web',
        200,
      );
    }

    const urlPath = decodeURIComponent(new URL(c.req.url).pathname);
    const candidate = safeJoin(webDist, urlPath);

    if (candidate && (await isFile(candidate))) {
      return sendFile(candidate);
    }

    // SPA fallback.
    const indexHtml = path.join(webDist, 'index.html');
    if (await isFile(indexHtml)) {
      return sendFile(indexHtml, 'text/html; charset=utf-8');
    }
    return c.text('Browser UI not found.', 404);
  };
}

function safeJoin(root: string, urlPath: string): string | null {
  const resolved = path.normalize(path.join(root, urlPath));
  if (!resolved.startsWith(path.resolve(root))) return null;
  return resolved;
}

async function isFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function sendFile(file: string, forcedType?: string): Promise<Response> {
  const data = await fs.readFile(file);
  const type =
    forcedType ?? CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const body = new Uint8Array(data);
  return new Response(body, {
    status: 200,
    headers: { 'content-type': type, 'cache-control': 'no-cache' },
  });
}
