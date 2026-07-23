import { Lock } from 'lucide-react';
import type { Health } from '../types';

interface Props {
  health: Health | null;
  inSession: boolean;
  onHome: () => void;
  onNewSession: () => void;
}

export function TopBar({ health, inSession, onHome, onNewSession }: Props) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome}>
        <span className="brand-dot" />
        yummycode
      </button>

      <div className="topbar-meta">
        {inSession && (
          <button className="topbar-link" onClick={onNewSession}>
            New session
          </button>
        )}
        {health && (
          <span className="meta-item hide-sm">
            <strong>{health.project}</strong>
          </span>
        )}
        {health && <span className="meta-item hide-sm">{health.provider.model}</span>}
        <span className="meta-item">
          <Lock size={11} strokeWidth={1.75} />
          {health?.provider.local ? 'local only' : 'hosted'}
        </span>
      </div>
    </header>
  );
}
