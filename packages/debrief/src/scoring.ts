import type {
  DebriefContradiction,
  DebriefDodge,
  DebriefJargonItem,
  PersonaId,
  ProjectIndex,
  Session,
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

const PM_IMPACT = [
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

/** How well the explanation fit the chosen audience. */
export function scoreAudienceFit(
  persona: PersonaId,
  session: Session,
  jargon: DebriefJargonItem[],
): number {
  const userText = session.turns
    .filter((t) => t.role === 'user')
    .map((t) => t.content.toLowerCase())
    .join(' ');

  if (persona === 'parent') {
    // Non-technical audience: jargon hurts a lot.
    return clamp(95 - jargon.length * 9);
  }
  // PM: reward impact/product language, penalize jargon lightly.
  const impactHits = PM_IMPACT.filter((w) => new RegExp(`\\b${w}\\b`).test(userText)).length;
  return clamp(45 + impactHits * 9 - jargon.length * 4);
}
