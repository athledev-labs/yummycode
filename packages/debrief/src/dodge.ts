import type { DebriefDodge, Session } from '@yummycode/core';

const HEDGES = [
  'kind of',
  'sort of',
  'you know',
  'it just works',
  'hard to explain',
  'complicated',
  'a lot going on',
  'too technical',
  'trust me',
  'magic',
  'stuff',
  'things',
  'whatever',
  'i guess',
  'not sure',
];

const STOP = new Set([
  'what',
  'why',
  'how',
  'who',
  'does',
  'do',
  'is',
  'are',
  'the',
  'this',
  'that',
  'you',
  'your',
  'and',
  'for',
  'with',
  'about',
  'would',
  'could',
  'should',
  'a',
  'an',
  'of',
  'to',
  'in',
  'it',
  'so',
]);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/**
 * Detect questions the user dodged or hand-waved. Pairs each persona question
 * with the user's next reply and flags replies that are evasive (hedge-heavy),
 * too short, or share almost no content with the question.
 */
export function detectDodges(session: Session): DebriefDodge[] {
  const dodges: DebriefDodge[] = [];
  const turns = session.turns;

  for (let i = 0; i < turns.length - 1; i++) {
    const q = turns[i]!;
    const a = turns[i + 1]!;
    if (q.role !== 'persona' || a.role !== 'user') continue;

    const answer = a.content.trim();
    const answerLower = answer.toLowerCase();
    const wordCount = answer.split(/\s+/).filter(Boolean).length;
    const hedgeHits = HEDGES.filter((h) => answerLower.includes(h)).length;

    const qWords = contentWords(q.content);
    const aWords = contentWords(answer);
    const shared = overlap(qWords, aWords);

    const isQuestion = /\?/.test(q.content);
    let note = '';
    if (wordCount < 6) {
      note = 'The answer was very short and did not really engage the question.';
    } else if (hedgeHits >= 2) {
      note = 'The answer leaned on vague filler instead of a concrete explanation.';
    } else if (isQuestion && qWords.size >= 4 && shared === 0 && wordCount < 22) {
      note = 'The answer moved on without addressing what was asked.';
    }

    if (note) {
      dodges.push({ question: q.content.trim(), note });
    }
  }

  return dodges.slice(0, 8);
}
