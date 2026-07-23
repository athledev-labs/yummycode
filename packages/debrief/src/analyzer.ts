import type {
  Debrief,
  DebriefContradiction,
  DebriefDodge,
  DebriefJargonItem,
  DebriefStudyItem,
  ProjectIndex,
  Session,
} from '@yummycode/core';
import { findContradictions } from '@yummycode/conversation';
import type { LLMProvider } from '@yummycode/llm';
import { detectJargon } from './jargon.js';
import { detectDodges } from './dodge.js';
import { extractUserSummary, generateClearSummary } from './summary.js';
import { scoreAudienceFit, scoreClarity, scoreConsistency, scoreGrounding } from './scoring.js';

/**
 * DebriefAnalyzer composes independent modules over the full session:
 *   jargon detection, dodge detection, contradiction detection, summary
 *   extraction, grounding + rubric scoring, gap synthesis, and a study plan.
 * The LLM is used only to phrase a clear reference summary; everything else is
 * deterministic so the debrief is specific and works offline.
 */
export async function analyzeSession(
  provider: LLMProvider,
  session: Session,
  index: ProjectIndex,
): Promise<Debrief> {
  const jargon = detectJargon(session);
  const dodges = detectDodges(session);
  const contradictions = findContradictions(session.claims);
  const userSummary = extractUserSummary(session);
  const clearSummary = await generateClearSummary(provider, index);

  const scores = {
    clarity: scoreClarity(session, jargon, dodges),
    grounding: scoreGrounding(session, index),
    consistency: scoreConsistency(contradictions),
    audienceFit: scoreAudienceFit(session.persona, session, jargon),
  };

  const gaps = synthesizeGaps(session, index, jargon, dodges, scores.grounding);
  const studyPlan = buildStudyPlan(index, jargon, dodges, contradictions, session);

  return {
    sessionId: session.id,
    persona: session.persona,
    projectName: index.name,
    createdAt: new Date().toISOString(),
    userSummary,
    clearSummary,
    jargon,
    dodgedQuestions: dodges,
    contradictions,
    gaps,
    studyPlan,
    scores,
  };
}

function synthesizeGaps(
  session: Session,
  index: ProjectIndex,
  jargon: DebriefJargonItem[],
  dodges: DebriefDodge[],
  groundingScore: number,
): string[] {
  const gaps: string[] = [];

  for (const item of jargon.slice(0, 3)) {
    gaps.push(
      `You used "${item.term}" without saying what it is, so a non-technical listener is left guessing what it actually does.`,
    );
  }

  if (dodges.length > 0) {
    gaps.push(
      `A listener still would not have a concrete answer to: "${truncate(dodges[0]!.question, 100)}"`,
    );
  }

  if (groundingScore < 55) {
    gaps.push(
      'You described the idea but not what actually happens when someone uses it, step by step.',
    );
  }

  const userText = session.turns
    .filter((t) => t.role === 'user')
    .map((t) => t.content.toLowerCase())
    .join(' ');
  if (!/\b(user|people|someone|customer|they)\b/.test(userText)) {
    gaps.push(
      'It is not clear who this is for. No specific person or user showed up in the story.',
    );
  }

  if (gaps.length === 0) {
    gaps.push(
      'A listener could follow the what, but the why (the problem this solves) never became concrete.',
    );
  }

  return gaps.slice(0, 5);
}

function buildStudyPlan(
  index: ProjectIndex,
  jargon: DebriefJargonItem[],
  dodges: DebriefDodge[],
  contradictions: DebriefContradiction[],
  session: Session,
): DebriefStudyItem[] {
  const plan: DebriefStudyItem[] = [];

  if (jargon[0]) {
    plan.push({
      topic: `Explain "${jargon[0].term}" in one plain sentence`,
      why: 'You reached for it without a translation. Have a version your audience could repeat back.',
    });
  }

  if (dodges[0]) {
    plan.push({
      topic: `Prepare a concrete answer to: "${truncate(dodges[0].question, 90)}"`,
      why: 'This question did not get a real answer in the session.',
    });
  }

  if (contradictions[0]) {
    plan.push({
      topic: 'Pin down the detail you described two different ways',
      why: `You said "${truncate(contradictions[0].earlier, 60)}" and later "${truncate(contradictions[0].later, 60)}". Decide which is true.`,
    });
  }

  const unmentioned = firstUnmentionedComponent(index, session);
  if (unmentioned && plan.length < 3) {
    plan.push({
      topic: `Where ${unmentioned} fits in the system`,
      why: `It is a real part of ${index.name} that never came up. Be ready to place it in the story.`,
    });
  }

  const defaults: DebriefStudyItem[] = [
    {
      topic: 'The one-sentence version of what this is',
      why: 'Being able to open with a single clear sentence sets up everything else.',
    },
    {
      topic: 'The failure story: what happens when it breaks',
      why: 'Explaining failure modes shows you understand the system, not just the happy path.',
    },
    {
      topic: 'Who this is for, as a specific person',
      why: 'A concrete user makes the value obvious without any technical detail.',
    },
  ];
  for (const d of defaults) {
    if (plan.length >= 3) break;
    if (!plan.some((p) => p.topic === d.topic)) plan.push(d);
  }

  return plan.slice(0, 3);
}

function firstUnmentionedComponent(index: ProjectIndex, session: Session): string | null {
  const userText = session.turns
    .filter((t) => t.role === 'user')
    .map((t) => t.content.toLowerCase())
    .join(' ');

  const candidates: string[] = [];
  for (const m of index.manifests) {
    for (const d of (m.dependencies ?? []).slice(0, 10)) candidates.push(d);
  }
  for (const e of index.entryPoints.slice(0, 3)) candidates.push(e.path);

  for (const c of candidates) {
    const key = c.toLowerCase();
    if (key.length > 2 && !userText.includes(key)) return c;
  }
  return null;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
