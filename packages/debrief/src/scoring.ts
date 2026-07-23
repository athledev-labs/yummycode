import {
  PERSONA_META,
  type DebriefContradiction,
  type DebriefDodge,
  type DebriefJargonItem,
  type PersonaId,
  type ProjectIndex,
  type Session,
} from '@yummycode/core';
import { jargonDensity } from './jargon.js';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** How clearly the user explained, penalized by untranslated jargon and dodges. */
export function scoreClarity(
  session: Session,
  jargon: DebriefJargonItem[],
  dodges: DebriefDodge[],
): number {
  const density = jargonDensity(session);
  let score = 100;
  score -= jargon.length * 5;
  score -= dodges.length * 8;
  score -= density * 400; // density is small; scale up
  return clamp(score);
}

/** How grounded the explanation was in the real project. */
export function scoreGrounding(session: Session, index: ProjectIndex): number {
  const components = new Set<string>();
  for (const m of index.manifests) {
    for (const d of m.dependencies ?? []) components.add(d.toLowerCase());
    if (m.name) components.add(m.name.toLowerCase());
  }
  for (const lang of index.languages) components.add(lang.toLowerCase());
  for (const e of index.entryPoints) components.add(e.path.split('/').pop()!.toLowerCase());
  for (const r of index.routes) components.add(r.path.toLowerCase());

  const userText = session.turns
    .filter((t) => t.role === 'user')
    .map((t) => t.content.toLowerCase())
    .join(' ');

  if (components.size === 0) return userText.length > 40 ? 60 : 30;

  let matched = 0;
  for (const c of components) {
    if (c.length > 2 && userText.includes(c)) matched++;
  }
  // Reward referencing real parts of the system; saturate quickly.
  const ratio = matched / Math.min(components.size, 12);
  return clamp(35 + ratio * 75);
}

/** Internal consistency, penalized per contradiction. */
export function scoreConsistency(contradictions: DebriefContradiction[]): number {
  return clamp(100 - contradictions.length * 22);
}

const PRODUCT_WORDS = [
  'user',
  'users',
  'problem',
  'risk',
  'scope',
  'launch',
  'impact',
  'value',
  'customer',
  'goal',
  'timeline',
];
const TECHNICAL_WORDS = [
  'tradeoff',
  'trade-off',
  'because',
  'failure',
  'edge',
  'scale',
  'latency',
  'design',
  'bottleneck',
  'decision',
  'constraint',
  'flow',
  'store',
  'concurrency',
];
const BUSINESS_WORDS = [
  'cost',
  'risk',
  'timeline',
  'impact',
  'value',
  'market',
  'revenue',
  'customer',
  'roi',
  'budget',
  'moat',
  'growth',
];
const HEDGE_WORDS = [
  'kind of',
  'sort of',
  'you know',
  'it just works',
  'magic',
  'complicated',
  'stuff',
  'somehow',
];

function countWords(text: string, words: string[]): number {
  return words.filter((w) => text.includes(w)).length;
}

/** How well the explanation fit the chosen audience, by audience class. */
export function scoreAudienceFit(
  persona: PersonaId,
  session: Session,
  jargon: DebriefJargonItem[],
): number {
  const userText = session.turns
    .filter((t) => t.role === 'user')
    .map((t) => t.content.toLowerCase())
    .join(' ');

  switch (PERSONA_META[persona].audienceClass) {
    case 'nontechnical':
      // Jargon hurts a lot for a non-technical listener.
      return clamp(95 - jargon.length * 9);
    case 'product':
      return clamp(45 + countWords(userText, PRODUCT_WORDS) * 9 - jargon.length * 4);
    case 'technical': {
      // Jargon is expected; reward depth, penalize hand-waving.
      const depth = countWords(userText, TECHNICAL_WORDS);
      const hedges = countWords(userText, HEDGE_WORDS);
      return clamp(50 + depth * 8 - hedges * 6);
    }
    case 'business':
      return clamp(45 + countWords(userText, BUSINESS_WORDS) * 9 - jargon.length * 5);
  }
}
