import type { PersonaId, PersonaMeta } from './types.js';

/**
 * Display metadata for the audience picker. Behavioral definitions (tone,
 * question templates, escalation rules) live in the conversation package.
 */
export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  parent: {
    id: 'parent',
    name: 'Parent or friend',
    audience: 'Non-technical',
    blurb: 'Curious, no background. Interrupts on jargon and asks what things actually do.',
  },
  pm: {
    id: 'pm',
    name: 'Curious PM',
    audience: 'Product-minded',
    blurb: 'Sharper questions on impact, scope, timeline, and risk. Still not an engineer.',
  },
};

export const PERSONA_LIST: PersonaMeta[] = Object.values(PERSONA_META);

export function isPersonaId(value: string): value is PersonaId {
  return value === 'parent' || value === 'pm';
}
