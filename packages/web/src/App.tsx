import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useRoute } from './router';
import { getHealth, getIndex, getPersonas, createSession } from './api';
import type { Health, IndexOverview, PersonaId, PersonaMeta } from './types';
import { TopBar } from './components/TopBar';
import { GuidedHome } from './views/GuidedHome';
import { Conversation } from './views/Conversation';
import { DebriefView } from './views/DebriefView';

export function App() {
  const [route, navigate] = useRoute();
  const [health, setHealth] = useState<Health | null>(null);
  const [index, setIndex] = useState<IndexOverview | null>(null);
  const [personas, setPersonas] = useState<PersonaMeta[]>([]);
  const [starting, setStarting] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getHealth(), getIndex(), getPersonas()])
      .then(([h, i, p]) => {
        setHealth(h);
        setIndex(i);
        setPersonas(p);
      })
      .catch((e: Error) => setBootError(e.message));
  }, []);

  const currentSessionId = route.sessionId;
  const inSession = route.view !== 'picker';

  const providerWarning = useMemo(() => {
    if (!health) return null;
    return health.providerStatus.ok ? null : health.providerStatus.detail;
  }, [health]);

  const onStart = async (persona: PersonaId) => {
    setStarting(true);
    try {
      const session = await createSession(persona);
      navigate(`/session/${session.id}`);
    } catch (e) {
      setBootError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const renderView = () => {
    if (bootError) {
      return (
        <div className="main">
          <div className="content center-state">
            <p className="error-text">{bootError}</p>
            <p className="muted">Is the yummycode server still running?</p>
          </div>
        </div>
      );
    }
    if (!health || !index) {
      return (
        <div className="main">
          <div className="content center-state">
            <div className="spinner" />
            <p className="muted">Connecting</p>
          </div>
        </div>
      );
    }

    if (route.view === 'debrief' && currentSessionId) {
      return <DebriefView sessionId={currentSessionId} onRestart={() => navigate('/')} />;
    }
    if (route.view === 'session' && currentSessionId) {
      return (
        <Conversation
          sessionId={currentSessionId}
          onOpenDebrief={() => navigate(`/session/${currentSessionId}/debrief`)}
          onSessionMissing={() => navigate('/')}
        />
      );
    }
    return (
      <div className="main">
        {providerWarning && (
          <div className="content" style={{ paddingBottom: 0 }}>
            <div className="banner">
              <AlertCircle
                size={14}
                strokeWidth={1.75}
                style={{ verticalAlign: '-2px', marginRight: 6 }}
              />
              {providerWarning}
            </div>
          </div>
        )}
        <GuidedHome
          personas={personas}
          projectName={index.name}
          description={index.description}
          starting={starting}
          onStart={onStart}
        />
      </div>
    );
  };

  return (
    <div className="app">
      <TopBar
        health={health}
        inSession={inSession}
        onHome={() => navigate('/')}
        onNewSession={() => navigate('/')}
      />
      {renderView()}
    </div>
  );
}
