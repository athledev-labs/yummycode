import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PersonaId, PersonaMeta } from '../types';

interface Props {
  personas: PersonaMeta[];
  projectName: string;
  description?: string;
  starting: boolean;
  onStart: (persona: PersonaId) => void;
}

function trim(text: string, max = 150): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/[,.;:]\s*\S*$/, '')}...`;
}

export function GuidedHome({ personas, projectName, description, starting, onStart }: Props) {
  const [selected, setSelected] = useState<PersonaId | null>(null);
  const chosen = personas.find((p) => p.id === selected) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selected && !starting) onStart(selected);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, starting, onStart]);

  const lede = description
    ? `You pointed me at ${projectName}. ${trim(description)}`
    : `You pointed me at ${projectName}. I have scanned it and I am ready.`;

  return (
    <div className="home">
      <p className="home-eyebrow reveal" style={{ '--i': 0 } as React.CSSProperties}>
        New session
      </p>
      <h1 className="home-headline reveal" style={{ '--i': 1 } as React.CSSProperties}>
        Let&rsquo;s practice explaining {projectName}.
      </h1>
      <p className="home-lede reveal" style={{ '--i': 2 } as React.CSSProperties}>
        {lede}
      </p>
      <p className="home-ask reveal" style={{ '--i': 3 } as React.CSSProperties}>
        Who are you explaining it to? They will ask questions, not help.
      </p>

      <div className="audience-row reveal" style={{ '--i': 4 } as React.CSSProperties}>
        {personas.map((p) => (
          <button
            key={p.id}
            className={`audience ${selected === p.id ? 'sel' : ''}`}
            onClick={() => setSelected(p.id)}
            aria-pressed={selected === p.id}
          >
            <span className="audience-name">{p.name}</span>
            <span className="audience-tag">{p.audience}</span>
          </button>
        ))}
      </div>

      <div className={`home-start ${chosen ? 'in' : ''}`}>
        {chosen && <span className="home-confirm">{chosen.blurb}</span>}
        <button
          className="pill"
          disabled={!chosen || starting}
          onClick={() => chosen && onStart(chosen.id)}
        >
          {starting ? 'Starting' : 'Start session'}
          {!starting && <ArrowRight size={14} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}
