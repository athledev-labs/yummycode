import type { Session } from '@yummycode/core';

interface StoredSession {
  session: Session;
  busy: boolean;
}

/** In-memory session store for a single server run. Nothing is persisted. */
export class SessionStore {
  private readonly sessions = new Map<string, StoredSession>();

  add(session: Session): void {
    this.sessions.set(session.id, { session, busy: false });
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)?.session;
  }

  update(session: Session): void {
    const existing = this.sessions.get(session.id);
    if (existing) existing.session = session;
    else this.sessions.set(session.id, { session, busy: false });
  }

  setBusy(id: string, busy: boolean): void {
    const entry = this.sessions.get(id);
    if (entry) entry.busy = busy;
  }

  isBusy(id: string): boolean {
    return this.sessions.get(id)?.busy ?? false;
  }

  count(): number {
    return this.sessions.size;
  }
}
