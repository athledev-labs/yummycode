import type { DebriefJargonItem, Session } from '@yummycode/core';

/** Technical terms a non-technical listener would not understand unaided. */
export const JARGON_LEXICON = [
  'api',
  'endpoint',
  'backend',
  'frontend',
  'framework',
  'library',
  'database',
  'schema',
  'query',
  'cache',
  'caching',
  'queue',
  'async',
  'asynchronous',
  'concurrency',
  'thread',
  'websocket',
  'middleware',
  'orchestrator',
  'orchestration',
  'pipeline',
  'runtime',
  'compiler',
  'latency',
  'throughput',
  'index',
  'indexing',
  'embedding',
  'vector',
  'token',
  'tokenize',
  'stateless',
  'stateful',
  'idempotent',
  'kubernetes',
  'docker',
  'container',
  'microservice',
  'monorepo',
  'serverless',
  'graphql',
  'rest',
  'oauth',
  'jwt',
  'webhook',
  'cdn',
  'dns',
  'ssr',
  'hydration',
  'polyfill',
  'transpile',
  'binary',
  'deserialize',
  'serialize',
  'mutex',
  'race condition',
  'load balancer',
  'reverse proxy',
  'dependency injection',
  'abstraction layer',
  'inference',
  'quantization',
  'fine-tune',
  'crud',
  'orm',
  'ci/cd',
  'sdk',
  'cli',
];

/** Phrases that indicate the speaker translated a term into plain language. */
const EXPLANATION_CUES = [
  'which means',
  'which is',
  'in other words',
  'basically',
  'meaning',
  'i mean',
  'think of it',
  'kind of like',
  'sort of like',
  'like a',
  'that is,',
  'in plain',
  'to put it simply',
  'so it',
  'so that',
  'this lets',
  'this means',
];

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function hasExplanation(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  if (EXPLANATION_CUES.some((cue) => lower.includes(cue))) return true;
  // A parenthetical gloss counts as an explanation.
  if (/\([^)]{6,}\)/.test(sentence)) return true;
  return false;
}

/**
 * Detect jargon the user leaned on without translating for the audience. A term
 * counts as untranslated when it appears in a sentence with no explanation cue.
 */
export function detectJargon(session: Session): DebriefJargonItem[] {
  const found = new Map<string, string>();
  const userText = session.turns.filter((t) => t.role === 'user');

  for (const turn of userText) {
    for (const sentence of splitSentences(turn.content)) {
      const lower = sentence.toLowerCase();
      const explained = hasExplanation(sentence);
      for (const term of JARGON_LEXICON) {
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\b`, 'i');
        if (re.test(lower) && !explained && !found.has(term)) {
          found.set(term, sentence.trim().slice(0, 160));
        }
      }
    }
  }

  return [...found.entries()].map(([term, context]) => ({ term, context })).slice(0, 12);
}

/** Count total jargon mentions (used for scoring density). */
export function jargonDensity(session: Session): number {
  let mentions = 0;
  let words = 0;
  for (const turn of session.turns.filter((t) => t.role === 'user')) {
    const lower = turn.content.toLowerCase();
    words += turn.content.split(/\s+/).length;
    for (const term of JARGON_LEXICON) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\b`, 'gi');
      mentions += (lower.match(re) ?? []).length;
    }
  }
  return words > 0 ? mentions / words : 0;
}
