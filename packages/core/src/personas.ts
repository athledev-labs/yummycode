import type { PersonaId, PersonaMeta } from './types.js';

/**
 * Display metadata for the audience picker. Behavioral definitions (tone,
 * question templates, escalation rules) live in the conversation package.
 * `audienceClass` drives generic behavior (scoring, mock tone) so the lineup
 * grows without special-casing each persona.
 */
export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  parent: {
    id: 'parent',
    name: 'Parent or friend',
    audience: 'Non-technical',
    audienceClass: 'nontechnical',
    blurb: 'Curious, no background. Interrupts on jargon and asks what things actually do.',
  },
  customer: {
    id: 'customer',
    name: 'Skeptical customer',
    audience: 'Non-technical',
    audienceClass: 'nontechnical',
    blurb: 'Only cares whether it solves their problem. Why switch, what is the catch.',
  },
  pm: {
    id: 'pm',
    name: 'Curious PM',
    audience: 'Product',
    audienceClass: 'product',
    blurb: 'Sharper questions on impact, scope, timeline, and risk. Still not an engineer.',
  },
  teammate: {
    id: 'teammate',
    name: 'New teammate',
    audience: 'Technical, new',
    audienceClass: 'technical',
    blurb: 'Needs the mental model to contribute. Where things live, how a request flows.',
  },
  engineer: {
    id: 'engineer',
    name: 'Skeptical senior engineer',
    audience: 'Technical peer',
    audienceClass: 'technical',
    blurb: 'Challenges design choices, tradeoffs, and failure modes. No hand-waving.',
  },
  interviewer: {
    id: 'interviewer',
    name: 'Interviewer',
    audience: 'System design',
    audienceClass: 'technical',
    blurb: 'Runs it like a design interview. Constraints, alternatives, rough scale math.',
  },
  exec: {
    id: 'exec',
    name: 'Executive',
    audience: 'Business and risk',
    audienceClass: 'business',
    blurb: 'Cost, timeline reality, risk, and strategic fit. Redirects detail to impact.',
  },
  investor: {
    id: 'investor',
    name: 'Investor',
    audience: 'Business',
    audienceClass: 'business',
    blurb: 'Market, why now, moat, and what breaks the thesis. Impatient with detail.',
  },
};

/** Picker order: grouped by how technical the listener is. */
export const PERSONA_LIST: PersonaMeta[] = [
  PERSONA_META.parent,
  PERSONA_META.customer,
  PERSONA_META.pm,
  PERSONA_META.exec,
  PERSONA_META.investor,
  PERSONA_META.teammate,
  PERSONA_META.engineer,
  PERSONA_META.interviewer,
];

const PERSONA_IDS = new Set<string>(Object.keys(PERSONA_META));

export function isPersonaId(value: string): value is PersonaId {
  return PERSONA_IDS.has(value);
}
