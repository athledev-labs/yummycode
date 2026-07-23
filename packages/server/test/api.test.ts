import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { scanProject, type ProjectIndex } from '@yummycode/core';
import { MockProvider } from '@yummycode/llm';
import { createApp } from '@yummycode/server';
import type { Hono } from 'hono';

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'core',
  'test',
  'fixture',
);

let app: Hono;
let index: ProjectIndex;

beforeAll(async () => {
  index = await scanProject(FIXTURE);
  app = createApp({ index, provider: new MockProvider(), webDist: null });
});

async function post(url: string, body?: unknown) {
  return app.fetch(
    new Request(`http://local${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

describe('session API', () => {
  it('reports health', async () => {
    const res = await app.fetch(new Request('http://local/api/health'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ok).toBe(true);
    expect(data.provider.id).toBe('mock');
  });

  it('returns the index overview', async () => {
    const res = await app.fetch(new Request('http://local/api/index'));
    const data = (await res.json()) as any;
    expect(data.name).toBe('acme-todos');
    expect(data.routes.length).toBeGreaterThan(0);
  });

  it('creates a session with an opening persona turn', async () => {
    const res = await post('/api/sessions', { persona: 'parent' });
    expect(res.status).toBe(200);
    const { session } = (await res.json()) as any;
    expect(session.persona).toBe('parent');
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0].role).toBe('persona');
  });

  it('rejects an unknown persona', async () => {
    const res = await post('/api/sessions', { persona: 'ceo' });
    expect(res.status).toBe(400);
  });

  it('streams a persona response and advances the phase', async () => {
    const created = await post('/api/sessions', { persona: 'pm' });
    const { session } = (await created.json()) as any;

    const res = await post(`/api/sessions/${session.id}/messages`, {
      content: 'It is an API that stores todos in a database.',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);

    const text = await res.text();
    expect(text).toContain('event: grounding');
    expect(text).toContain('event: token');
    expect(text).toContain('event: done');
  });

  it('generates a debrief after a conversation', async () => {
    const created = await post('/api/sessions', { persona: 'parent' });
    const { session } = (await created.json()) as any;
    await post(`/api/sessions/${session.id}/messages`, {
      content: 'It exposes an API and uses a database for todos.',
    });
    await post(`/api/sessions/${session.id}/messages`, {
      content: 'In one sentence, it is a small shared todo service.',
    });

    const res = await post(`/api/sessions/${session.id}/debrief`);
    expect(res.status).toBe(200);
    const { debrief } = (await res.json()) as any;
    expect(debrief.projectName).toBe('acme-todos');
    expect(debrief.studyPlan).toHaveLength(3);
    expect(debrief.scores.clarity).toBeGreaterThanOrEqual(0);
  });

  it('404s for a missing session', async () => {
    const res = await app.fetch(new Request('http://local/api/sessions/nope'));
    expect(res.status).toBe(404);
  });
});
