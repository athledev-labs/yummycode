import type { Debrief, PersonaId } from '@yummycode/core';

const PERSONA_LABEL: Record<PersonaId, string> = {
  friend: 'A friend',
  pm: 'A product manager',
  leader: 'A business leader',
  engineer: 'A fellow engineer',
};

/**
 * Render a debrief as portable Markdown for copying or saving. Kept in the
 * debrief package so the web app, server, and CLI all share one format.
 */
export function renderDebriefMarkdown(d: Debrief): string {
  const lines: string[] = [];
  const push = (s = '') => lines.push(s);

  push(`# Debrief: ${d.projectName}`);
  push();
  push(`Audience: ${PERSONA_LABEL[d.persona] ?? d.persona}`);
  push(`Generated: ${d.createdAt}`);
  push();

  push('## One-sentence summary');
  push(`Your version: ${d.userSummary || 'no clear one-liner landed'}`);
  push(`A clearer version: ${d.clearSummary}`);
  push();

  push('## Scores');
  push(`- Clarity: ${d.scores.clarity}/100`);
  push(`- Grounding: ${d.scores.grounding}/100`);
  push(`- Consistency: ${d.scores.consistency}/100`);
  push(`- Audience fit: ${d.scores.audienceFit}/100`);
  push();

  push('## Jargon used without translation');
  if (d.jargon.length === 0) push('None flagged.');
  else for (const j of d.jargon) push(`- ${j.term}: ${j.context}`);
  push();

  push('## Questions dodged or hand-waved');
  if (d.dodgedQuestions.length === 0) push('None flagged.');
  else for (const q of d.dodgedQuestions) push(`- ${q.question} (${q.note})`);
  push();

  push('## Contradictions');
  if (d.contradictions.length === 0) push('None flagged.');
  else
    for (const c of d.contradictions) {
      push(`- ${c.note}`);
      push(`  - Earlier: ${c.earlier}`);
      push(`  - Later: ${c.later}`);
    }
  push();

  push('## What a non-technical listener would still miss');
  for (const g of d.gaps) push(`- ${g}`);
  push();

  push('## Study before your next session');
  d.studyPlan.forEach((s, i) => {
    push(`${i + 1}. ${s.topic}`);
    push(`   ${s.why}`);
  });
  push();

  return lines.join('\n');
}
