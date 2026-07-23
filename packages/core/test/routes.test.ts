import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanProject } from '@yummycode/core';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'routes-fixture');

describe('framework route detection', () => {
  it('detects Express, Nest, and Django routes', async () => {
    const index = await scanProject(FIXTURE);
    const routes = index.routes.map((r) => `${r.method} ${r.path}`);

    expect(routes).toContain('GET /real');
    expect(routes).toContain('POST /real');
    expect(routes).toContain('GET /list'); // Nest decorator
    expect(routes).toContain('ANY /cats/'); // Django path()
    expect(routes).toContain('ANY /dogs/');
  });

  it('ignores routes that appear only in comments', async () => {
    const index = await scanProject(FIXTURE);
    const paths = index.routes.map((r) => r.path);
    expect(paths.some((p) => p.includes('commented'))).toBe(false);
    expect(paths.some((p) => p.includes('ignored'))).toBe(false);
  });

  it('resolves entry points from package.json main and bin', async () => {
    const index = await scanProject(FIXTURE);
    const paths = index.entryPoints.map((e) => e.path);
    expect(paths).toContain('api.ts');
    expect(paths).toContain('bin/cli.js');
  });
});
