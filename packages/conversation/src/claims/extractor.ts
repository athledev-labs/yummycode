import { newId, type Claim } from '@yummycode/core';

/** Verbs that signal an assertion worth tracking. */
const ASSERTIVE =
  /\b(is|are|was|were|use|uses|used|using|chose|choose|picked|pick|built|build|store|stores|stored|run|runs|handle|handles|support|supports|rely|relies|have|has|need|needs|call|calls|send|sends|save|saves|talk|talks|connect|connects)\b/i;

const CHOICE =
  /\b(?:we|i|it|the app|this)\s+(?:use|uses|used|using|chose|choose|picked|pick|built(?:\s+it)?\s+with|rely on|relies on|went with|are using|am using)\s+(.+)/i;

const IS_A = /^(.{2,60}?)\s+(?:is|are|was|were)\s+(.+)/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
}

function trimClause(s: string): string {
  return s.replace(/^[,\s]+|[,\s.]+$/g, '').slice(0, 200);
}

/**
 * Lightweight claim extraction. Parses assertions like "we use X because Y",
 * "the database is Postgres", "it stores everything locally". No LLM: purely
 * pattern based so it is fast, local, and predictable.
 */
export function extractClaims(turnId: string, text: string): Claim[] {
  const claims: Claim[] = [];
  const now = new Date().toISOString();

  for (const sentence of splitSentences(text)) {
    if (!ASSERTIVE.test(sentence)) continue;

    let reason: string | undefined;
    let core = sentence;
    const becauseMatch = sentence.match(/^(.*?)\b(?:because|since|so that|in order to)\b(.*)$/i);
    if (becauseMatch && becauseMatch[1] && becauseMatch[2]) {
      core = becauseMatch[1].trim();
      reason = trimClause(becauseMatch[2]);
    }

    let subject: string | undefined;
    let predicate: string | undefined;

    const choice = core.match(CHOICE);
    const isA = core.match(IS_A);
    if (choice && choice[1]) {
      subject = 'technology choice';
      predicate = trimClause(core);
    } else if (isA && isA[1] && isA[2]) {
      subject = trimClause(isA[1]);
      predicate = trimClause(`is ${isA[2]}`);
    } else {
      // Fallback: treat the whole assertive sentence as a claim.
      subject = trimClause(core.split(/\s+/).slice(0, 4).join(' '));
      predicate = trimClause(core);
    }

    if (!subject || !predicate) continue;
    claims.push({
      id: newId('claim'),
      turnId,
      subject,
      predicate,
      reason,
      rawText: sentence.slice(0, 280),
      createdAt: now,
    });
  }

  // Cap to avoid noise from long messages.
  return claims.slice(0, 6);
}
