/**
 * Shared domain types for yummycode.
 *
 * These describe the indexed project, the conversation, and the debrief.
 * Every package speaks in terms of these types so modules stay decoupled.
 */

export type PersonaId =
  | 'parent'
  | 'pm'
  | 'teammate'
  | 'engineer'
  | 'exec'
  | 'interviewer'
  | 'investor'
  | 'customer';

/**
 * The kind of listener a persona represents. Drives audience-fit scoring and
 * the mock provider's tone, so behavior generalizes across the whole lineup.
 */
export type AudienceClass = 'nontechnical' | 'product' | 'technical' | 'business';

export type SessionPhase = 'opening' | 'probing' | 'escalation' | 'closing' | 'debrief';

export type TurnRole = 'user' | 'persona' | 'system';

/** A single unit of retrievable project knowledge. */
export interface IndexChunk {
  id: string;
  /** What kind of artifact this chunk came from. */
  kind: 'readme' | 'manifest' | 'structure' | 'entrypoint' | 'route' | 'config' | 'doc' | 'source';
  /** Repo-relative path this chunk is associated with. */
  path: string;
  /** Short human label, e.g. "package.json dependencies". */
  title: string;
  /** The text content used for retrieval and grounding. */
  content: string;
  /** Lowercased keywords used for lexical scoring. */
  keywords: string[];
}

export interface DetectedRoute {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface EntryPoint {
  path: string;
  reason: string;
}

export interface ManifestSummary {
  /** The manifest file, e.g. package.json, pyproject.toml, Cargo.toml, Package.swift. */
  file: string;
  ecosystem: string;
  name?: string;
  version?: string;
  description?: string;
  scripts?: string[];
  dependencies?: string[];
  /** Declared entry file, e.g. package.json "main". */
  main?: string;
  /** Declared bin targets, e.g. package.json "bin". */
  bin?: string[];
  raw?: string;
}

export interface DirNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: DirNode[];
}

/** The complete, local-only index of a project. */
export interface ProjectIndex {
  /** Absolute path of the scanned project root. */
  root: string;
  name: string;
  description?: string;
  /** Detected primary languages, most prominent first. */
  languages: string[];
  /** File counts by extension, for a quick shape read. */
  fileCounts: Record<string, number>;
  readme?: string;
  manifests: ManifestSummary[];
  structure: DirNode;
  entryPoints: EntryPoint[];
  routes: DetectedRoute[];
  configFiles: string[];
  chunks: IndexChunk[];
  /** ISO timestamp of when the scan ran. */
  scannedAt: string;
  /** Version of the indexer that produced this index. */
  indexerVersion: string;
  stats: {
    filesScanned: number;
    dirsScanned: number;
    bytesRead: number;
    durationMs: number;
  };
}

export interface Claim {
  id: string;
  turnId: string;
  /** The thing being described, e.g. "the database". */
  subject: string;
  /** The assertion, e.g. "is Postgres because we need transactions". */
  predicate: string;
  /** Optional reason, when a "because" was detected. */
  reason?: string;
  /** The raw sentence the claim was extracted from. */
  rawText: string;
  createdAt: string;
}

export interface Turn {
  id: string;
  role: TurnRole;
  content: string;
  createdAt: string;
  /** Chunk ids surfaced to ground this turn (for persona turns). */
  groundedChunkIds?: string[];
  /** The persona question this user turn is responding to, if any. */
  respondsToQuestion?: string;
}

export interface Session {
  id: string;
  persona: PersonaId;
  phase: SessionPhase;
  projectName: string;
  turns: Turn[];
  claims: Claim[];
  createdAt: string;
  updatedAt: string;
  /** Count of user turns, used for phase transitions. */
  userTurnCount: number;
}

export interface DebriefStudyItem {
  topic: string;
  why: string;
}

export interface DebriefJargonItem {
  term: string;
  context: string;
}

export interface DebriefDodge {
  question: string;
  note: string;
}

export interface DebriefContradiction {
  earlier: string;
  later: string;
  note: string;
}

/** Structured debrief produced by the multi-module analyzer. */
export interface Debrief {
  sessionId: string;
  persona: PersonaId;
  projectName: string;
  createdAt: string;
  /** The user's best one-sentence summary attempt, extracted from the transcript. */
  userSummary: string;
  /** A clear reference version for comparison. */
  clearSummary: string;
  jargon: DebriefJargonItem[];
  dodgedQuestions: DebriefDodge[];
  contradictions: DebriefContradiction[];
  /** What a non-technical listener would still not understand. */
  gaps: string[];
  studyPlan: DebriefStudyItem[];
  /** 0-100 scores per rubric dimension. */
  scores: {
    clarity: number;
    grounding: number;
    consistency: number;
    audienceFit: number;
  };
}

export interface PersonaMeta {
  id: PersonaId;
  name: string;
  audience: string;
  audienceClass: AudienceClass;
  blurb: string;
}
