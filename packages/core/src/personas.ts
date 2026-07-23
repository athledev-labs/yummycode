import type { PersonaId, PersonaMeta } from './types.js';

/**
 * Display metadata for the four general personas, one per audience class.
 * Behavioral definitions (tone, question templates, escalation rules) live in
 * the conversation package. Everything is data so the set can be tuned or
 * extended with custom personas later.
 */
export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  friend: {
    id: 'friend',
    name: 'A friend',
    audience: 'Non-technical',
    audienceClass: 'nontechnical',
    blurb: 'No technical background. Interrupts on jargon and asks what things actually do.',
  },
  pm: {
    id: 'pm',
    name: 'A product manager',
    audience: 'Product',
    audienceClass: 'product',
    blurb: 'Thinks in users, scope, and impact. Sharp questions, but not an engineer.',
  },
  leader: {
    id: 'leader',
    name: 'A business leader',
    audience: 'Business',
    audienceClass: 'business',
    blurb: 'Cares about value, cost, and risk. Redirects the detail to outcomes.',
  },
  engineer: {
    id: 'engineer',
    name: 'A fellow engineer',
    audience: 'Technical',
    audienceClass: 'technical',
    blurb: 'A technical peer. Probes the design, the tradeoffs, and the failure modes.',
  },
};

/** Picker order: least to most technical. */
export const PERSONA_LIST: PersonaMeta[] = [
  PERSONA_META.friend,
  PERSONA_META.pm,
  PERSONA_META.leader,
  PERSONA_META.engineer,
];

const PERSONA_IDS = new Set<string>(Object.keys(PERSONA_META));

export function isPersonaId(value: string): value is PersonaId {
  return PERSONA_IDS.has(value);
}
