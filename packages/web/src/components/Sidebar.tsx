import { MessageSquare, FileText, Lock } from 'lucide-react';
import type { Health } from '../types';

interface SidebarProps {
  active: 'session' | 'debrief';
  health: Health | null;
  canDebrief: boolean;
  onNavigate: (view: 'session' | 'debrief') => void;
}

export function Sidebar({ active, health, canDebrief, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-dot" />
        yummycode
      </div>

      <button
        className={`nav-item ${active === 'session' ? 'active' : ''}`}
        onClick={() => onNavigate('session')}
      >
        <MessageSquare size={14} strokeWidth={1.75} />
        Session
      </button>
      <button
        className={`nav-item ${active === 'debrief' ? 'active' : ''}`}
        onClick={() => onNavigate('debrief')}
        disabled={!canDebrief}
      >
        <FileText size={14} strokeWidth={1.75} />
        Debrief
      </button>

      <div className="sidebar-spacer" />

      <div className="sidebar-foot">
        <div className="foot-row">
          <span>Project</span>
          <span className="val">{health?.project ?? '...'}</span>
        </div>
        <div className="foot-row">
          <span>Model</span>
          <span className="val">{health?.provider.model ?? '...'}</span>
        </div>
        <div className="foot-row">
          <Lock size={12} strokeWidth={1.75} />
          <span>{health?.provider.local ? 'Local only' : 'Hosted provider'}</span>
        </div>
      </div>
    </aside>
  );
}
