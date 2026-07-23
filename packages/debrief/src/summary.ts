import type { ProjectIndex, Session } from '@yummycode/core';
import type { LLMProvider } from '@yummycode/llm';

/**
 * Extract the user's best one-sentence summary attempt. Prefers the reply to a
 * closing "sum it up" question, then the most self-contained sentence they said.
 */
export function extractUserSummary(session: Session): string {
  const userTurns = session.turns.filter((t) => t.role === 'user');
  if (userTurns.length === 0) return '';

  // If a persona asked for a one-sentence summary, use the following user reply.
  const turns = session.turns;
  for (let i = 0; i < turns.length - 1; i++) {
    const q = turns[i]!;
    const a = turns[i + 1]!;
    if (
      q.role === 'persona' &&
      a.role === 'user' &&
      /one sentence|sum(?:mari[sz]e| it up)|pitch|in a sentence/i.test(q.content)
    ) {
      const firstSentence = a.content.split(/(?<=[.!?])\s+/)[0]?.trim();
      if (firstSentence) return firstSentence.slice(0, 240);
    }
  }

  // Otherwise pick the first substantial "it is / this is / a tool that" sentence.
  for (const turn of userTurns) {
    for (const sentence of turn.content.split(/(?<=[.!?])\s+/)) {
      const s = sentence.trim();
      if (
        /\b(it'?s|this is|a (tool|way|app|platform|system|service)|helps|lets)\b/i.test(s) &&
        s.length > 20
      ) {
        return s.slice(0, 240);
      }
    }
  }

  return (
    userTurns[0]!.content
      .split(/(?<=[.!?])\s+/)[0]
      ?.trim()
      .slice(0, 240) ?? ''
  );
}

function deterministicClearSummary(index: ProjectIndex): string {
  const what =
    index.description?.replace(/\.$/, '') ?? `a ${index.languages[0] ?? 'software'} project`;
  const langs = index.languages.slice(0, 2).join(' and ');
  const shape =
    index.routes.length > 0
      ? 'It exposes an HTTP service'
      : index.entryPoints.length > 0
        ? 'It runs from a clear entry point'
        : 'It is organized as a codebase';
  return `${index.name} is ${lowerFirst(what)}. ${shape}${langs ? `, built mainly in ${langs}` : ''}.`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Produce a clear reference summary from the index (not the transcript), so the
 * user can compare their attempt to a plain, accurate version. Uses the model
 * when available and falls back to a deterministic template offline.
 */
export async function generateClearSummary(
  provider: LLMProvider,
  index: ProjectIndex,
): Promise<string> {
  const fallback = deterministicClearSummary(index);
  try {
    const facts = [
      `Name: ${index.name}`,
      index.description ? `Description: ${index.description}` : '',
      `Languages: ${index.languages.join(', ') || 'unknown'}`,
      index.routes.length ? `Has ${index.routes.length} HTTP routes` : '',
      index.manifests
        .map((m) => `${m.ecosystem} deps: ${(m.dependencies ?? []).slice(0, 8).join(', ')}`)
        .join('; '),
    ]
      .filter(Boolean)
      .join('\n');

    const reply = await provider.chat(
      [
        {
          role: 'system',
          content:
            'You write one clear sentence a non-technical person could understand. No jargon, no hype, no em dashes. Return only the sentence.',
        },
        {
          role: 'user',
          content: `Summarize this software project in one plain sentence:\n${facts}`,
        },
      ],
      { temperature: 0.3, maxTokens: 80 },
    );
    const clean = reply
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    const firstSentence = clean.split(/(?<=[.!?])\s+/)[0]?.trim();
    return firstSentence && firstSentence.length > 15 ? firstSentence : fallback;
  } catch {
    return fallback;
  }
}
