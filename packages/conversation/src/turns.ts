import { newId, type PersonaId, type Session, type Turn } from '@yummycode/core';
import { getProfile } from './persona/profile.js';

function pickOpener(personaId: PersonaId, seed: string): string {
  const openers = getProfile(personaId).openers;
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum = (sum + seed.charCodeAt(i)) % 100003;
  return openers[sum % openers.length]!;
}

/** Create a session that already contains the persona's opening question. */
export function startSession(personaId: PersonaId, projectName: string): Session {
  const now = new Date().toISOString();
  const id = newId('sess');
  const opener: Turn = {
    id: newId('turn'),
    role: 'persona',
    content: pickOpener(personaId, id),
    createdAt: now,
  };
  return {
    id,
    persona: personaId,
    phase: 'opening',
    projectName,
    turns: [opener],
    claims: [],
    createdAt: now,
    updatedAt: now,
    userTurnCount: 0,
  };
}

export function makeUserTurn(content: string, respondsToQuestion?: string): Turn {
  return {
    id: newId('turn'),
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
    respondsToQuestion,
  };
}

export function makePersonaTurn(content: string, groundedChunkIds: string[]): Turn {
  return {
    id: newId('turn'),
    role: 'persona',
    content,
    createdAt: new Date().toISOString(),
    groundedChunkIds,
  };
}

/** The most recent persona question, used to detect dodges on the next reply. */
export function lastPersonaQuestion(session: Session): string | undefined {
  for (let i = session.turns.length - 1; i >= 0; i--) {
    if (session.turns[i]!.role === 'persona') return session.turns[i]!.content;
  }
  return undefined;
}
