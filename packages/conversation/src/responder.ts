import type { Claim, ProjectIndex, Session } from '@yummycode/core';
import type { ChatMessage } from '@yummycode/llm';
import type { TurnDirective } from './orchestrator.js';
import { retrieveForTurn, type Grounding } from './grounding.js';
import { getProfile } from './persona/profile.js';
import { buildSystemPrompt } from './persona/prompt.js';

export interface ResponderContext {
  messages: ChatMessage[];
  grounding: Grounding;
}

/**
 * PersonaResponder assembles the full model input for the next persona turn:
 * the persona system prompt (character + directive + grounding + claims) plus
 * the conversation history mapped to chat roles. It does not call the model;
 * the server owns streaming so the same context can drive text or, later, voice.
 */
export function buildResponderContext(args: {
  session: Session;
  index: ProjectIndex;
  directive: TurnDirective;
  latestUserText: string;
  claims: Claim[];
}): ResponderContext {
  const { session, index, directive, latestUserText, claims } = args;
  const profile = getProfile(session.persona);
  const grounding =
    directive.phase === 'opening'
      ? { chunks: [], text: '' }
      : retrieveForTurn(index, session, latestUserText);

  const system = buildSystemPrompt({
    profile,
    directive,
    grounding,
    claims,
    projectName: index.name,
    projectDescription: index.description,
  });

  const history: ChatMessage[] = [];
  for (const turn of session.turns) {
    if (turn.role === 'persona') history.push({ role: 'assistant', content: turn.content });
    else if (turn.role === 'user') history.push({ role: 'user', content: turn.content });
  }

  return {
    messages: [{ role: 'system', content: system }, ...history],
    grounding,
  };
}

/**
 * Clean raw model output into a single spoken line: strip reasoning tags,
 * stage directions, name labels, and wrapping quotes.
 */
export function sanitizeReply(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Some reasoning models leave a dangling opener with no closer.
  text = text.replace(/<think>[\s\S]*$/i, '').trim();
  text = text.replace(/^\s*(?:parent|friend|pm|product manager)\s*[:>-]\s*/i, '');
  text = text.replace(/^\s*["'“”]+|["'“”]+\s*$/g, '');
  // Drop leading stage directions like *smiles*.
  text = text.replace(/^\*[^*]+\*\s*/, '');
  return text.trim();
}
