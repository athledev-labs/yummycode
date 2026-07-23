import type {
  Debrief,
  EvidenceChunk,
  Health,
  IndexOverview,
  PersonaId,
  PersonaMeta,
  Session,
  Turn,
} from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function getHealth(): Promise<Health> {
  return json(await fetch('/api/health'));
}

export async function getIndex(): Promise<IndexOverview> {
  return json(await fetch('/api/index'));
}

export async function getPersonas(): Promise<PersonaMeta[]> {
  const data = await json<{ personas: PersonaMeta[] }>(await fetch('/api/personas'));
  return data.personas;
}

export async function createSession(persona: PersonaId): Promise<Session> {
  const data = await json<{ session: Session }>(
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ persona }),
    }),
  );
  return data.session;
}

export async function getSession(id: string): Promise<Session> {
  const data = await json<{ session: Session }>(await fetch(`/api/sessions/${id}`));
  return data.session;
}

export async function getEvidence(id: string, topic: string): Promise<EvidenceChunk[]> {
  const data = await json<{ chunks: EvidenceChunk[] }>(
    await fetch(`/api/sessions/${id}/evidence?topic=${encodeURIComponent(topic)}`),
  );
  return data.chunks;
}

export async function getDebrief(id: string): Promise<Debrief> {
  const data = await json<{ debrief: Debrief }>(
    await fetch(`/api/sessions/${id}/debrief`, { method: 'POST' }),
  );
  return data.debrief;
}

export interface StreamHandlers {
  onGrounding?: (chunks: { id: string; title: string; path: string; kind: string }[]) => void;
  onToken?: (delta: string) => void;
  onDone?: (payload: {
    turn: Turn;
    phase: string;
    readyForDebrief: boolean;
    userTurnCount: number;
  }) => void;
  onError?: (message: string) => void;
}

/**
 * POST a user message and consume the server-sent event stream. Parses SSE
 * frames from the fetch body reader (EventSource cannot POST a body).
 */
export async function sendMessage(
  sessionId: string,
  content: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    handlers.onError?.(body.error ?? `Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (frame: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    let data: any;
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (event === 'grounding') handlers.onGrounding?.(data.chunks ?? []);
    else if (event === 'token') handlers.onToken?.(data.delta ?? '');
    else if (event === 'done') handlers.onDone?.(data);
    else if (event === 'error') handlers.onError?.(data.message ?? 'Unknown error');
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (frame.trim()) dispatch(frame);
    }
  }
  if (buffer.trim()) dispatch(buffer);
}
