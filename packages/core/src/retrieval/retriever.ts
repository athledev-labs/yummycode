import type { IndexChunk, ProjectIndex } from '../types.js';
import { keywordize } from '../scanner/chunks.js';

export interface ScoredChunk {
  chunk: IndexChunk;
  score: number;
}

/**
 * Lexical grounding retrieval. No embeddings, no network: a small TF-IDF style
 * score over chunk keywords plus a light bonus for phrase and kind matches.
 * Fully local and deterministic.
 */
export function retrieveChunks(index: ProjectIndex, query: string, k = 4): ScoredChunk[] {
  const queryTokens = keywordize(query);
  if (queryTokens.length === 0) return [];

  const chunks = index.chunks;
  const df = new Map<string, number>();
  for (const chunk of chunks) {
    for (const token of new Set(chunk.keywords)) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  const total = Math.max(chunks.length, 1);

  const queryLower = query.toLowerCase();
  const scored: ScoredChunk[] = chunks.map((chunk) => {
    const tf = new Map<string, number>();
    for (const token of chunk.keywords) tf.set(token, (tf.get(token) ?? 0) + 1);

    let score = 0;
    for (const token of queryTokens) {
      const termFreq = tf.get(token);
      if (!termFreq) continue;
      const idf = Math.log(1 + total / (df.get(token) ?? 1));
      score += termFreq * idf;
    }

    // Phrase bonus: query mentions a word that literally appears in content.
    for (const token of queryTokens) {
      if (token.length > 4 && chunk.content.toLowerCase().includes(token)) score += 0.5;
    }

    // Slight preference for README/manifest/route chunks when relevant, since
    // they carry the most conversational signal.
    if (score > 0 && (chunk.kind === 'readme' || chunk.kind === 'route')) score += 0.25;

    // Direct filename mention.
    if (chunk.path && queryLower.includes(chunk.path.toLowerCase())) score += 1;

    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
