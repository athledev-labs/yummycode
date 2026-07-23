import { describe, expect, it } from 'vitest';
import {
  PERSONA_LIST,
  PERSONA_META,
  isPersonaId,
  type PersonaId,
  type SessionPhase,
} from '@yummycode/core';
import { PROFILES, getProfile } from '@yummycode/conversation';

const PHASES: SessionPhase[] = ['opening', 'probing', 'escalation', 'closing', 'debrief'];

describe('persona lineup', () => {
  it('exposes eight personas across four audience classes', () => {
    expect(PERSONA_LIST).toHaveLength(8);
    const classes = new Set(PERSONA_LIST.map((p) => p.audienceClass));
    expect([...classes].sort()).toEqual(['business', 'nontechnical', 'product', 'technical']);
  });

  it('has a complete profile for every persona', () => {
    for (const id of Object.keys(PERSONA_META) as PersonaId[]) {
      const profile = getProfile(id);
      expect(profile.id).toBe(id);
      expect(profile.meta).toBe(PERSONA_META[id]);
      expect(profile.character.length).toBeGreaterThan(20);
      expect(profile.constraints.length).toBeGreaterThan(3);
      expect(profile.openers.length).toBeGreaterThan(0);
      for (const phase of PHASES) {
        expect(profile.phaseDirectives[phase]).toBeTruthy();
      }
    }
  });

  it('keeps the profile map and metadata in sync', () => {
    expect(Object.keys(PROFILES).sort()).toEqual(Object.keys(PERSONA_META).sort());
  });

  it('validates persona ids', () => {
    expect(isPersonaId('engineer')).toBe(true);
    expect(isPersonaId('ceo')).toBe(false);
  });
});
