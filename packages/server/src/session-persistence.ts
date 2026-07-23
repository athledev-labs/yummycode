import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Debrief, Session } from '@yummycode/core';

/**
 * Optional on-disk persistence for sessions. Writes to
 * `<baseDir>/sessions/<id>.json` so a conversation and its debrief survive a
 * server restart. Everything stays local; nothing is uploaded. All operations
 * are best-effort so a read-only project directory never breaks a session.
 */

export interface StoredRecord {
  session: Session;
  debrief?: Debrief;
  savedAt: string;
}

export interface SessionSummary {
  id: string;
  persona: string;
  projectName: string;
  updatedAt: string;
  turns: number;
  hasDebrief: boolean;
}

function sessionsDir(baseDir: string): string {
  return path.join(baseDir, 'sessions');
}

export async function saveSession(
  baseDir: string,
  session: Session,
  debrief?: Debrief,
): Promise<void> {
  try {
    const dir = sessionsDir(baseDir);
    await fs.mkdir(dir, { recursive: true });
    const record: StoredRecord = { session, debrief, savedAt: new Date().toISOString() };
    await fs.writeFile(path.join(dir, `${session.id}.json`), JSON.stringify(record, null, 2), 'utf8');
  } catch {
    // Best-effort: persistence must never break the live session.
  }
}

export async function loadSession(baseDir: string, id: string): Promise<StoredRecord | null> {
  try {
    const raw = await fs.readFile(path.join(sessionsDir(baseDir), `${id}.json`), 'utf8');
    return JSON.parse(raw) as StoredRecord;
  } catch {
    return null;
  }
}

export async function listSessions(baseDir: string): Promise<SessionSummary[]> {
  let files: string[];
  try {
    files = await fs.readdir(sessionsDir(baseDir));
  } catch {
    return [];
  }
  const summaries: SessionSummary[] = [];
  for (const file of files.filter((f) => f.endsWith('.json')).slice(0, 200)) {
    const record = await loadSession(baseDir, file.replace(/\.json$/, ''));
    if (!record) continue;
    summaries.push({
      id: record.session.id,
      persona: record.session.persona,
      projectName: record.session.projectName,
      updatedAt: record.session.updatedAt,
      turns: record.session.userTurnCount,
      hasDebrief: Boolean(record.debrief),
    });
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
