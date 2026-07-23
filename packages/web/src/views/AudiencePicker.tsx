import { useState } from 'react';
import {
  Users,
  Briefcase,
  ArrowRight,
  ShoppingBag,
  Building2,
  TrendingUp,
  UserPlus,
  Wrench,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import type { PersonaId, PersonaMeta } from '../types';

interface Props {
  personas: PersonaMeta[];
  projectName: string;
  starting: boolean;
  onStart: (persona: PersonaId) => void;
}

const ICONS: Record<PersonaId, LucideIcon> = {
  parent: Users,
  customer: ShoppingBag,
  pm: Briefcase,
  exec: Building2,
  investor: TrendingUp,
  teammate: UserPlus,
  engineer: Wrench,
  interviewer: ClipboardList,
};

export function AudiencePicker({ personas, projectName, starting, onStart }: Props) {
  const [selected, setSelected] = useState<PersonaId | null>(null);

  return (
    <div className="content">
      <p className="eyebrow">New session</p>
      <h1 className="h1">Select audience</h1>
      <p className="sub">
        Choose who you are explaining {projectName} to. They will ask questions, not help you.
      </p>

      <div className="choice-grid">
        {personas.map((p) => {
          const Icon = ICONS[p.id] ?? Users;
          return (
            <button
              key={p.id}
              className={`choice ${selected === p.id ? 'selected' : ''}`}
              onClick={() => setSelected(p.id)}
              aria-pressed={selected === p.id}
            >
              <div className="choice-icon">
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <p className="choice-name">{p.name}</p>
              <p className="choice-tag">{p.audience}</p>
              <p className="choice-blurb">{p.blurb}</p>
            </button>
          );
        })}
      </div>

      <button
        className="pill"
        disabled={!selected || starting}
        onClick={() => selected && onStart(selected)}
      >
        {starting ? 'Starting' : 'Start session'}
        {!starting && <ArrowRight size={14} strokeWidth={2} />}
      </button>
    </div>
  );
}
