import type { Session, SessionPhase } from '@yummycode/core';

/**
 * The session state machine. Phases advance with the number of user turns:
 *   opening -> probing -> escalation -> closing -> (debrief)
 * The orchestrator owns transitions and the per-turn directive that tells the
 * responder how hard to push. It is deliberately separate from prompt text.
 */

export const PHASE_ORDER: SessionPhase[] = [
  'opening',
  'probing',
  'escalation',
  'closing',
  'debrief',
];

/** Soft cap on user turns before the session should move to debrief. */
export const SUGGESTED_TURN_LIMIT = 8;

export function phaseForTurnCount(userTurnCount: number): SessionPhase {
  if (userTurnCount <= 0) return 'opening';
  if (userTurnCount <= 2) return 'probing';
  if (userTurnCount <= 5) return 'escalation';
  return 'closing';
}

export interface TurnDirective {
  phase: SessionPhase;
  /** Whether the orchestrator wants the persona to point out a contradiction. */
  challengeContradiction: boolean;
  /** Whether the session is ready to close and debrief. */
  readyForDebrief: boolean;
  /** Extra one-line instruction for the responder. */
  instruction: string;
}

/**
 * Advance the session phase for the turn that is about to be generated and
 * produce a directive for the responder.
 */
export function planTurn(session: Session, opts: { hasNewContradiction: boolean }): TurnDirective {
  const nextPhase = phaseForTurnCount(session.userTurnCount);
  const readyForDebrief = session.userTurnCount >= SUGGESTED_TURN_LIMIT;

  let instruction = '';
  switch (nextPhase) {
    case 'opening':
      instruction = 'Open the conversation. Ask what they built in the simplest terms.';
      break;
    case 'probing':
      instruction = 'Ask a focused follow-up. Force plain language on any jargon they used.';
      break;
    case 'escalation':
      instruction = 'Push harder on tradeoffs, failure modes, and who this is really for.';
      break;
    case 'closing':
      instruction = 'Begin closing. Ask them to summarize in one clear sentence.';
      break;
    case 'debrief':
      instruction = 'The conversation is complete.';
      break;
  }

  if (opts.hasNewContradiction) {
    instruction =
      'They just contradicted something they said earlier. Point it out plainly and ask which is true.';
  }

  return {
    phase: nextPhase,
    challengeContradiction: opts.hasNewContradiction,
    readyForDebrief,
    instruction,
  };
}
