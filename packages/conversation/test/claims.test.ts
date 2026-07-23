import { describe, expect, it } from 'vitest';
import { extractClaims, findContradictions } from '@yummycode/conversation';

describe('extractClaims', () => {
  it('extracts a technology choice with a reason', () => {
    const claims = extractClaims('t1', 'We use Postgres because we need transactions.');
    expect(claims.length).toBeGreaterThan(0);
    const claim = claims[0]!;
    expect(claim.rawText).toMatch(/Postgres/);
    expect(claim.reason).toMatch(/transactions/);
  });

  it('extracts an "is" assertion', () => {
    const claims = extractClaims('t1', 'The frontend is a React app.');
    expect(claims.some((c) => /frontend/i.test(c.subject))).toBe(true);
  });

  it('ignores chit-chat with no assertion', () => {
    const claims = extractClaims('t1', 'Hi there, thanks.');
    expect(claims).toEqual([]);
  });

  it('caps the number of claims per message', () => {
    const long = Array.from({ length: 20 }, (_, i) => `Thing${i} is a widget.`).join(' ');
    expect(extractClaims('t1', long).length).toBeLessThanOrEqual(6);
  });
});

describe('findContradictions', () => {
  it('flags an affirm/deny pair about the same topic', () => {
    const claims = [
      ...extractClaims('t1', 'We use a database to store everything.'),
      ...extractClaims('t2', 'Actually we do not use a database, it is all in memory.'),
    ];
    const contradictions = findContradictions(claims);
    expect(contradictions.length).toBeGreaterThan(0);
  });

  it('does not flag consistent statements', () => {
    const claims = [
      ...extractClaims('t1', 'The api is written in TypeScript.'),
      ...extractClaims('t2', 'The tests are written in TypeScript too.'),
    ];
    expect(findContradictions(claims)).toEqual([]);
  });
});
