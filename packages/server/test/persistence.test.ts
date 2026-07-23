import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { scanProject } from '@yummycode/core';
import { MockProvider } from '@yummycode/llm';
import { createApp } from '@yummycode/server';
import { listSessions, loadSession, saveSession } from '@yummycode/server';
import type { Hono } from 'hono';

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'core',
  'test',
  'fixture',
);

let baseDir: string;

beforeAll(async () => {
  baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yummycode-persist-'));
});

afterAll(async () => {
  await fs.rm(baseDir, { recursive: true, force: true });
});

async function post(app: Hono, url: string, body?: unknown) {
  return app.fetch(
    new Request(`http://local${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

describe('session persistence', () => {
  it('round-trips a session through disk and lists it', async () => {
    const index = await scanProject(FIXTURE);
    const app = createApp({
      index,
      provider: new MockProvider(),
      webDist: null,
      persistDir: baseDir,
    });

    const created = await post(app, '/api/sessions', { persona: 'engineer' });
    const { session } = (await created.json()) as any;
    const msg = await post(app, `/api/sessions/${session.id}/messages`, {
      content: 'It exposes an API backed by an in-memory store.',
    });
    // Drain the SSE stream so the handler runs to completion (and persists).
    await msg.text();

    // The message handler persisted the session.
    const record = await loadSession(baseDir, session.id);
    expect(record).not.toBeNull();
    expect(record!.session.persona).toBe('engineer');
    expect(record!.session.turns.length).toBeGreaterThan(1);

    const summaries = await listSessions(baseDir);
    expect(summaries.some((s) => s.id === session.id)).toBe(true);
  });

  it('rehydrates a session from disk in a fresh server instance', async () => {
    const index = await scanProject(FIXTURE);

    // First server writes a session directly to disk.
    const first = createApp({
      index,
      provider: new MockProvider(),
      webDist: null,
      persistDir: baseDir,
    });
    const created = await post(first, '/api/sessions', { persona: 'pm' });
    const { session } = (await created.json()) as any;
    await saveSession(baseDir, session);

    // A brand new app (no shared memory) should still find it.
    const second = createApp({
      index,
      provider: new MockProvider(),
      webDist: null,
      persistDir: baseDir,
    });
    const res = await second.fetch(new Request(`http://local/api/sessions/${session.id}`));
    expect(res.status).toBe(200);
    const reloaded = (await res.json()) as any;
    expect(reloaded.session.id).toBe(session.id);
  });

  it('does not persist when persistence is disabled', async () => {
    const index = await scanProject(FIXTURE);
    const app = createApp({ index, provider: new MockProvider(), webDist: null, persistDir: null });
    const created = await post(app, '/api/sessions', { persona: 'parent' });
    const { session } = (await created.json()) as any;
    const list = await app.fetch(new Request('http://local/api/sessions'));
    expect(((await list.json()) as any).sessions).toEqual([]);
    // Nothing on disk for this id.
    expect(await loadSession(baseDir, session.id)).toBeNull();
  });
});
