import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanProject, type Session } from '@yummycode/core';
import { extractClaims } from '@yummycode/conversation';
import { MockProvider } from '@yummycode/llm';
import {
  analyzeSession,
  detectJargon,
  detectDodges,
  renderDebriefMarkdown,
} from '@yummycode/debrief';

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'core',
  'test',
  'fixture',
);

function buildSession(): Session {
  const now = new Date().toISOString();
  const script: Array<['persona' | 'user', string]> = [
    ['persona', 'What is it?'],
    ['user', 'It is a service that exposes an API and stores todos in a database.'],
    ['persona', 'Who uses it?'],
    ['user', 'It just works, kind of, you know, it is complicated.'],
    ['persona', 'What actually stores the data?'],
    ['user', 'Actually we do not use a database, it is all in memory.'],
    ['persona', 'Can you sum it up in one sentence?'],
    ['user', 'In one sentence, it is a small todo service my team shares.'],
  ];

  const turns: Session['turns'] = [];
  const claims: Session['claims'] = [];
  let userCount = 0;
  script.forEach(([role, content], i) => {
    const id = `${role[0]}${i}`;
    turns.push({ id, role, content, createdAt: now });
    if (role === 'user') {
      userCount += 1;
      claims.push(...extractClaims(id, content));
    }
  });

  return {
    id: 'sess_test',
    persona: 'friend',
    phase: 'closing',
    projectName: 'acme-todos',
    turns,
    claims,
    createdAt: now,
    updatedAt: now,
    userTurnCount: userCount,
  };
}

describe('debrief modules', () => {
  it('detects untranslated jargon', () => {
    const jargon = detectJargon(buildSession());
    const terms = jargon.map((j) => j.term);
    expect(terms).toContain('api');
    expect(terms).toContain('database');
  });

  it('detects hand-waved answers', () => {
    const dodges = detectDodges(buildSession());
    expect(dodges.length).toBeGreaterThan(0);
  });
});

describe('analyzeSession', () => {
  it('produces a complete, well-formed debrief', async () => {
    const index = await scanProject(FIXTURE);
    const session = buildSession();
    const debrief = await analyzeSession(new MockProvider(), session, index);

    // Schema completeness.
    expect(debrief.sessionId).toBe('sess_test');
    expect(debrief.persona).toBe('friend');
    expect(typeof debrief.clearSummary).toBe('string');
    expect(debrief.clearSummary.length).toBeGreaterThan(10);
    expect(debrief.userSummary).toMatch(/todo/i);
    expect(Array.isArray(debrief.jargon)).toBe(true);
    expect(debrief.studyPlan).toHaveLength(3);
    expect(debrief.gaps.length).toBeGreaterThan(0);

    // Scores are bounded 0..100.
    for (const value of Object.values(debrief.scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('flags the database vs in-memory contradiction', async () => {
    const index = await scanProject(FIXTURE);
    const debrief = await analyzeSession(new MockProvider(), buildSession(), index);
    expect(debrief.contradictions.length).toBeGreaterThan(0);
    expect(debrief.scores.consistency).toBeLessThan(100);
  });

  it('renders the debrief as markdown', async () => {
    const index = await scanProject(FIXTURE);
    const debrief = await analyzeSession(new MockProvider(), buildSession(), index);
    const md = renderDebriefMarkdown(debrief);
    expect(md).toContain('# Debrief: acme-todos');
    expect(md).toContain('## Scores');
    expect(md).toContain('## Study before your next session');
    expect(md).not.toContain('—'); // no em dashes
  });
});
