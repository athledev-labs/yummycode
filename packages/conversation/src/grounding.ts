import { retrieveChunks, type IndexChunk, type ProjectIndex, type Session } from '@yummycode/core';

export interface Grounding {
  chunks: IndexChunk[];
  /** Formatted block injected into the persona system prompt. */
  text: string;
}

/**
 * Decide what project evidence to surface for the current turn. Builds a query
 * from the most recent user message plus a little conversational history, then
 * pulls the top lexical matches from the local index.
 */
export function retrieveForTurn(
  index: ProjectIndex,
  session: Session,
  latestUserText: string,
  k = 4,
): Grounding {
  const recentUser = session.turns
    .filter((t) => t.role === 'user')
    .slice(-2)
    .map((t) => t.content)
    .join(' ');
  const query = `${latestUserText} ${recentUser}`.trim();
  const scored = retrieveChunks(index, query, k);
  const chunks = scored.map((s) => s.chunk);

  if (chunks.length === 0) {
    return { chunks: [], text: '' };
  }

  const text = chunks
    .map((c) => `- [${c.title}] ${c.content.replace(/\s+/g, ' ').slice(0, 280)}`)
    .join('\n');

  return { chunks, text };
}

/** Evidence for the sidebar: top chunks for an arbitrary topic string. */
export function evidenceFor(index: ProjectIndex, topic: string, k = 5): IndexChunk[] {
  if (!topic.trim()) {
    return index.chunks.slice(0, k);
  }
  return retrieveChunks(index, topic, k).map((s) => s.chunk);
}
