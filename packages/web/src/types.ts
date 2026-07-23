// API response shapes. Mirrors @yummycode/core domain types, kept local so the
// browser bundle never imports Node-only code.

export type PersonaId =
  'parent' | 'pm' | 'teammate' | 'engineer' | 'exec' | 'interviewer' | 'investor' | 'customer';
export type SessionPhase = 'opening' | 'probing' | 'escalation' | 'closing' | 'debrief';
export type TurnRole = 'user' | 'persona' | 'system';

export interface PersonaMeta {
  id: PersonaId;
  name: string;
  audience: string;
  audienceClass: string;
  blurb: string;
}

export interface Turn {
  id: string;
  role: TurnRole;
  content: string;
  createdAt: string;
  groundedChunkIds?: string[];
}

export interface Session {
  id: string;
  persona: PersonaId;
  phase: SessionPhase;
  projectName: string;
  turns: Turn[];
  claims: unknown[];
  userTurnCount: number;
}

export interface EvidenceChunk {
  id: string;
  kind: string;
  path: string;
  title: string;
  content: string;
}

export interface IndexOverview {
  name: string;
  description?: string;
  languages: string[];
  fileCounts: Record<string, number>;
  entryPoints: { path: string; reason: string }[];
  routes: { method: string; path: string; file: string; line: number }[];
  configFiles: string[];
  manifests: {
    file: string;
    ecosystem: string;
    name?: string;
    description?: string;
    dependencies: string[];
    scripts?: string[];
  }[];
  stats: { filesScanned: number; dirsScanned: number; durationMs: number };
  chunkCount: number;
}

export interface Health {
  ok: boolean;
  project: string;
  provider: { id: string; label: string; model: string; local: boolean };
  providerStatus: { ok: boolean; detail: string; model?: string };
}

export interface Debrief {
  sessionId: string;
  persona: PersonaId;
  projectName: string;
  createdAt: string;
  userSummary: string;
  clearSummary: string;
  jargon: { term: string; context: string }[];
  dodgedQuestions: { question: string; note: string }[];
  contradictions: { earlier: string; later: string; note: string }[];
  gaps: string[];
  studyPlan: { topic: string; why: string }[];
  scores: { clarity: number; grounding: number; consistency: number; audienceFit: number };
}
