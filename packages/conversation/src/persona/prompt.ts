import type { Claim } from '@yummycode/core';
import type { TurnDirective } from '../orchestrator.js';
import type { Grounding } from '../grounding.js';
import type { PersonaProfile } from './profile.js';

export interface PromptContext {
  profile: PersonaProfile;
  directive: TurnDirective;
  grounding: Grounding;
  claims: Claim[];
  projectName: string;
  projectDescription?: string;
}

/**
 * Assemble the persona system prompt from character, constraints, the current
 * phase directive, retrieved grounding, and the running claim log. This is the
 * only place persona text is composed; behavior lives in the profile + directive.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const { profile, directive, grounding, claims, projectName, projectDescription } = ctx;
  const lines: string[] = [];

  lines.push(
    `You are role-playing a single character in a spoken conversation. The other person is a software developer trying to explain their project, "${projectName}", to you.`,
  );
  if (projectDescription) {
    lines.push(`Their project, in one line: ${projectDescription}`);
  }
  lines.push('');
  lines.push(`Your character: ${profile.character}`);
  lines.push(`Your tone: ${profile.tone}`);
  lines.push('');
  lines.push('Rules you must follow:');
  profile.constraints.forEach((c, i) => lines.push(`${i + 1}. ${c}`));
  lines.push('');
  lines.push(`Right now: ${profile.phaseDirectives[directive.phase]}`);
  if (directive.instruction) lines.push(directive.instruction);

  if (grounding.text) {
    lines.push('');
    lines.push(
      'You have a rough, non-technical sense of the following facts about their project. ' +
        'Use them only to notice when their explanation is vague, hand-wavy, or inconsistent, and to ask a sharper question. ' +
        'Do not read file names or technical terms back to them, and do not explain any of it for them.',
    );
    lines.push(grounding.text);
  }

  if (claims.length) {
    lines.push('');
    lines.push('Things they have told you so far in this conversation:');
    for (const claim of claims.slice(-8)) {
      lines.push(`- ${claim.rawText}`);
    }
  }

  lines.push('');
  lines.push(
    'Respond with only your next spoken line. One or two short sentences. No preamble, no name label, no stage directions, no quotation marks.',
  );

  return lines.join('\n');
}
