import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanProject, retrieveChunks } from '@yummycode/core';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixture');

describe('scanProject', () => {
  it('indexes a project without executing it', async () => {
    const index = await scanProject(FIXTURE);

    expect(index.name).toBe('acme-todos');
    expect(index.description).toMatch(/todos/i);
    expect(index.languages).toContain('TypeScript');
    expect(index.readme).toMatch(/Architecture/);
  });

  it('detects HTTP routes', async () => {
    const index = await scanProject(FIXTURE);
    const paths = index.routes.map((r) => `${r.method} ${r.path}`);
    expect(paths).toContain('GET /todos');
    expect(paths).toContain('POST /todos');
    expect(index.routes.every((r) => r.file && r.line > 0)).toBe(true);
  });

  it('parses the manifest and dependencies', async () => {
    const index = await scanProject(FIXTURE);
    const node = index.manifests.find((m) => m.ecosystem === 'node');
    expect(node?.name).toBe('acme-todos');
    expect(node?.dependencies).toContain('hono');
    expect(node?.scripts).toContain('start');
  });

  it('builds retrievable chunks including a README section', async () => {
    const index = await scanProject(FIXTURE);
    expect(index.chunks.length).toBeGreaterThan(2);
    expect(index.chunks.some((c) => c.kind === 'readme')).toBe(true);
    expect(index.chunks.some((c) => c.kind === 'route')).toBe(true);
  });

  it('reports progress phases', async () => {
    const phases: string[] = [];
    await scanProject(FIXTURE, (e) => phases.push(e.phase));
    expect(phases).toContain('walk');
    expect(phases[phases.length - 1]).toBe('done');
  });
});

describe('retrieveChunks', () => {
  it('surfaces the most relevant chunk for a query', async () => {
    const index = await scanProject(FIXTURE);
    const results = retrieveChunks(index, 'how are todos stored in the database', 3);
    expect(results.length).toBeGreaterThan(0);
    // The architecture/readme chunk mentions the store and database.
    const joined = results.map((r) => r.chunk.content.toLowerCase()).join(' ');
    expect(joined).toMatch(/store|database|todos/);
  });

  it('returns nothing for an empty query', async () => {
    const index = await scanProject(FIXTURE);
    expect(retrieveChunks(index, '   ', 3)).toEqual([]);
  });
});
