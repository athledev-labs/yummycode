import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { PERSONA_LIST, isPersonaId, type Debrief, type ProjectIndex } from '@yummycode/core';
import {
  buildResponderContext,
  evidenceFor,
  extractClaims,
  findContradictions,
  lastPersonaQuestion,
  makePersonaTurn,
  makeUserTurn,
  planTurn,
  sanitizeReply,
  startSession,
} from '@yummycode/conversation';
import { analyzeSession, renderDebriefMarkdown } from '@yummycode/debrief';
import type { LLMProvider } from '@yummycode/llm';
import { SessionStore } from './session-store.js';
import { filterThink } from './stream-filter.js';
import { createStaticHandler } from './static.js';

export interface AppDeps {
  index: ProjectIndex;
  provider: LLMProvider;
  webDist: string | null;
}

/** Trimmed index view for the sidebar (omits large raw fields). */
function indexOverview(index: ProjectIndex) {
  return {
    name: index.name,
    description: index.description,
    languages: index.languages,
    fileCounts: index.fileCounts,
    entryPoints: index.entryPoints,
    routes: index.routes.slice(0, 40),
    configFiles: index.configFiles,
    manifests: index.manifests.map((m) => ({
      file: m.file,
      ecosystem: m.ecosystem,
      name: m.name,
      description: m.description,
      dependencies: (m.dependencies ?? []).slice(0, 20),
      scripts: m.scripts,
    })),
    stats: index.stats,
    scannedAt: index.scannedAt,
    chunkCount: index.chunks.length,
  };
}

export function createApp(deps: AppDeps): Hono {
  const { index, provider } = deps;
  const store = new SessionStore();
  const app = new Hono();
  const debriefs = new Map<string, Debrief>();

  app.get('/api/health', async (c) => {
    const status = await provider.status();
    return c.json({
      ok: true,
      project: index.name,
      provider: {
        id: provider.id,
        label: provider.label,
        model: provider.model,
        local: provider.local,
      },
      providerStatus: status,
    });
  });

  app.get('/api/personas', (c) => c.json({ personas: PERSONA_LIST }));

  app.get('/api/index', (c) => c.json(indexOverview(index)));

  app.post('/api/sessions', async (c) => {
    const body = await c.req.json<{ persona?: string }>().catch(() => ({}) as { persona?: string });
    const persona = body.persona ?? 'parent';
    if (!isPersonaId(persona)) {
      return c.json({ error: 'Unknown persona. Use "parent" or "pm".' }, 400);
    }
    const session = startSession(persona, index.name);
    store.add(session);
    return c.json({ session });
  });

  app.get('/api/sessions/:id', (c) => {
    const session = store.get(c.req.param('id'));
    if (!session) return c.json({ error: 'Session not found' }, 404);
    return c.json({ session });
  });

  app.get('/api/sessions/:id/evidence', (c) => {
    const session = store.get(c.req.param('id'));
    if (!session) return c.json({ error: 'Session not found' }, 404);
    const topic = c.req.query('topic') ?? '';
    const chunks = evidenceFor(index, topic, 6);
    return c.json({ chunks });
  });

  app.post('/api/sessions/:id/messages', async (c) => {
    const id = c.req.param('id');
    const session = store.get(id);
    if (!session) return c.json({ error: 'Session not found' }, 404);
    if (store.isBusy(id)) return c.json({ error: 'A response is already in progress.' }, 409);

    const body = await c.req.json<{ content?: string }>().catch(() => ({}) as { content?: string });
    const content = (body.content ?? '').trim();
    if (!content) return c.json({ error: 'Message content is required.' }, 400);

    store.setBusy(id, true);

    return streamSSE(c, async (stream) => {
      const controller = new AbortController();
      stream.onAbort(() => controller.abort());

      try {
        // Record the user's turn and extract claims.
        const question = lastPersonaQuestion(session);
        const userTurn = makeUserTurn(content, question);
        session.turns.push(userTurn);
        session.userTurnCount += 1;

        const priorContradictions = findContradictions(session.claims).length;
        session.claims.push(...extractClaims(userTurn.id, content));
        const nowContradictions = findContradictions(session.claims).length;
        const hasNewContradiction = nowContradictions > priorContradictions;

        const directive = planTurn(session, { hasNewContradiction });
        session.phase = directive.phase;

        const ctx = buildResponderContext({
          session,
          index,
          directive,
          latestUserText: content,
          claims: session.claims,
        });

        await stream.writeSSE({
          event: 'grounding',
          data: JSON.stringify({
            chunks: ctx.grounding.chunks.map((ch) => ({
              id: ch.id,
              title: ch.title,
              path: ch.path,
              kind: ch.kind,
            })),
          }),
        });

        let raw = '';
        const source = provider.stream(ctx.messages, {
          temperature: 0.7,
          maxTokens: 220,
          signal: controller.signal,
        });
        for await (const delta of filterThink(source)) {
          if (controller.signal.aborted) break;
          raw += delta;
          await stream.writeSSE({ event: 'token', data: JSON.stringify({ delta }) });
        }

        let text = sanitizeReply(raw);
        if (!text) text = fallbackQuestion(session.persona);

        const personaTurn = makePersonaTurn(
          text,
          ctx.grounding.chunks.map((ch) => ch.id),
        );
        session.turns.push(personaTurn);
        session.updatedAt = new Date().toISOString();
        store.update(session);

        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({
            turn: personaTurn,
            phase: session.phase,
            readyForDebrief: directive.readyForDebrief,
            userTurnCount: session.userTurnCount,
          }),
        });
      } catch (err) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: errorMessage(err) }),
        });
      } finally {
        store.setBusy(id, false);
      }
    });
  });

  app.post('/api/sessions/:id/debrief', async (c) => {
    const session = store.get(c.req.param('id'));
    if (!session) return c.json({ error: 'Session not found' }, 404);
    if (session.userTurnCount === 0) {
      return c.json({ error: 'Have a short conversation before generating a debrief.' }, 400);
    }
    try {
      session.phase = 'debrief';
      const debrief = await analyzeSession(provider, session, index);
      debriefs.set(session.id, debrief);
      store.update(session);
      return c.json({ debrief });
    } catch (err) {
      return c.json({ error: errorMessage(err) }, 500);
    }
  });

  app.get('/api/sessions/:id/debrief.md', (c) => {
    const debrief = debriefs.get(c.req.param('id'));
    if (!debrief) {
      return c.json({ error: 'No debrief yet. Generate one first.' }, 404);
    }
    return c.body(renderDebriefMarkdown(debrief), 200, {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="debrief-${debrief.projectName}.md"`,
    });
  });

  // Static browser app (must come last so /api routes win).
  const staticHandler = createStaticHandler(deps.webDist);
  app.get('*', staticHandler);

  return app;
}

function fallbackQuestion(persona: string): string {
  return persona === 'pm'
    ? 'Let me put it differently. What is the single most important thing this has to get right?'
    : 'Okay, say that again but simpler. What does it actually do for someone?';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
