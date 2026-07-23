import type { Claim, DebriefContradiction } from '@yummycode/core';

const NEGATION =
  /\b(not|no|no longer|don't|doesn't|do not|does not|didn't|isn't|aren't|never|without|instead of)\b/i;

const STOP = new Set([
  'about',
  'above',
  'after',
  'again',
  'their',
  'there',
  'these',
  'those',
  'which',
  'while',
  'would',
  'could',
  'should',
  'because',
  'earlier',
  'actually',
  'everything',
  'something',
]);

/** Salient content tokens (longer words, minus obvious stopwords). */
function salient(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 4 && !STOP.has(t)),
  );
}

function shared(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const t of a) if (b.has(t)) out.push(t);
  return out;
}

/**
 * Heuristic contradiction detection over the claim log. Flags two cases:
 *  - two statements about the same salient topic with opposite polarity
 *    ("we use a database" vs "we do not use a database")
 *  - "X is A" / "X is B" claims that assign different values to the same subject
 * Conservative: requires a shared salient token so unrelated statements do not
 * trip it.
 */
export function findContradictions(claims: Claim[]): DebriefContradiction[] {
  const results: DebriefContradiction[] = [];

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i]!;
      const b = claims[j]!;
      const topic = shared(salient(a.rawText), salient(b.rawText));
      if (topic.length === 0) continue;

      const negA = NEGATION.test(a.rawText);
      const negB = NEGATION.test(b.rawText);

      if (negA !== negB) {
        results.push({
          earlier: a.rawText,
          later: b.rawText,
          note: `One statement affirms and the other denies something about "${topic[0]}".`,
        });
        continue;
      }

      // "X is A" vs "X is B" with different values for the same subject.
      const aVal = a.predicate
        .match(/^(?:is|are|was|were)\s+(.+)/i)?.[1]
        ?.trim()
        .toLowerCase();
      const bVal = b.predicate
        .match(/^(?:is|are|was|were)\s+(.+)/i)?.[1]
        ?.trim()
        .toLowerCase();
      const sameSubject = shared(salient(a.subject), salient(b.subject)).length > 0;
      if (
        aVal &&
        bVal &&
        sameSubject &&
        aVal !== bVal &&
        shared(salient(aVal), salient(bVal)).length === 0
      ) {
        results.push({
          earlier: a.rawText,
          later: b.rawText,
          note: 'The same thing is described two different ways.',
        });
      }
    }
  }

  const seen = new Set<string>();
  return results.filter((c) => {
    const key = `${c.earlier}::${c.later}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
