import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ClipboardCheck, Mic, Volume2, VolumeX } from 'lucide-react';
import type { EvidenceChunk, Session, Turn } from '../types';
import { getEvidence, getSession, sendMessage } from '../api';
import { Evidence } from '../components/Evidence';
import {
  createRecognizer,
  recognitionSupported,
  speak,
  speechSupported,
  stopSpeaking,
  type Recognizer,
} from '../voice';

const PHASE_LABEL: Record<string, string> = {
  opening: 'Opening',
  probing: 'Probing',
  escalation: 'Pushing back',
  closing: 'Closing',
  debrief: 'Debrief',
};

interface Props {
  sessionId: string;
  onOpenDebrief: () => void;
  onSessionMissing: () => void;
}

export function Conversation({ sessionId, onOpenDebrief, onSessionMissing }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [evidence, setEvidence] = useState<EvidenceChunk[]>([]);
  const [phase, setPhase] = useState('opening');
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('yc_voice') === '1',
  );
  const [listening, setListening] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const canSpeak = speechSupported();
  const canListen = recognitionSupported();

  // Stop any speech or recognition when leaving the session.
  useEffect(() => {
    return () => {
      stopSpeaking();
      recognizerRef.current?.stop();
    };
  }, []);

  const toggleVoice = () => {
    setVoiceOn((on) => {
      const next = !on;
      if (typeof localStorage !== 'undefined') localStorage.setItem('yc_voice', next ? '1' : '0');
      if (!next) stopSpeaking();
      return next;
    });
  };

  const toggleMic = () => {
    if (listening) {
      recognizerRef.current?.stop();
      return;
    }
    const recognizer = createRecognizer({
      onTranscript: (text) => setInput(text),
      onEnd: () => setListening(false),
    });
    if (!recognizer) return;
    recognizerRef.current = recognizer;
    setListening(true);
    recognizer.start();
  };

  useEffect(() => {
    let alive = true;
    getSession(sessionId)
      .then((s) => {
        if (!alive) return;
        setSession(s);
        setTurns(s.turns);
        setPhase(s.phase);
        setUserTurnCount(s.userTurnCount);
      })
      .catch(() => alive && setLoadError('This session could not be found.'));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, streamText]);

  const canDebrief = userTurnCount >= 2;

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;

    const userTurn: Turn = {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setTurns((t) => [...t, userTurn]);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setSending(true);
    setStreamText('');
    setError(null);
    stopSpeaking();
    recognizerRef.current?.stop();

    getEvidence(sessionId, content)
      .then((chunks) => setEvidence(chunks))
      .catch(() => {});

    await sendMessage(sessionId, content, {
      onToken: (delta) => setStreamText((prev) => prev + delta),
      onDone: (payload) => {
        setTurns((t) => [...t, payload.turn]);
        setStreamText('');
        setPhase(payload.phase);
        setUserTurnCount(payload.userTurnCount);
        setSending(false);
        if (voiceOn) speak(payload.turn.content);
      },
      onError: (message) => {
        setError(message);
        setStreamText('');
        setSending(false);
      },
    });
  }, [input, sending, sessionId, voiceOn]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  if (loadError) {
    return (
      <div className="main">
        <div className="content center-state">
          <p className="error-text">{loadError}</p>
          <button className="pill" onClick={onSessionMissing}>
            Start a new session
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="main">
        <div className="content center-state">
          <div className="spinner" />
          <p className="muted">Loading session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main" ref={scrollRef}>
      <div className="content content-wide">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <span className="chip">
            <span className="chip-dot" />
            {PHASE_LABEL[phase] ?? phase}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            {canSpeak && (
              <button
                className="pill pill-ghost"
                onClick={toggleVoice}
                aria-pressed={voiceOn}
                title={voiceOn ? 'Voice on' : 'Voice off'}
              >
                {voiceOn ? <Volume2 size={14} strokeWidth={1.75} /> : <VolumeX size={14} strokeWidth={1.75} />}
                {voiceOn ? 'Voice on' : 'Voice off'}
              </button>
            )}
            <button className="pill pill-ghost" disabled={!canDebrief} onClick={onOpenDebrief}>
              <ClipboardCheck size={14} strokeWidth={1.75} />
              End and get debrief
            </button>
          </div>
        </div>

        <div className="with-panel">
          <div>
            <div className="convo">
              {turns
                .filter((t) => t.role !== 'system')
                .map((t) => (
                  <Message key={t.id} role={t.role} content={t.content} />
                ))}
              {sending && <Message role="persona" content={streamText} live />}
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="composer">
              <div className="composer-box">
                {canListen && (
                  <button
                    className={`icon-btn ghost ${listening ? 'listening' : ''}`}
                    onClick={toggleMic}
                    aria-label={listening ? 'Stop listening' : 'Speak'}
                    title={listening ? 'Listening' : 'Speak your answer'}
                  >
                    <Mic size={16} strokeWidth={2} />
                  </button>
                )}
                <textarea
                  ref={taRef}
                  rows={1}
                  placeholder={listening ? 'Listening...' : 'Explain your project in your own words'}
                  value={input}
                  onChange={onInput}
                  onKeyDown={onKeyDown}
                  disabled={sending}
                />
                <button
                  className="icon-btn"
                  onClick={() => void send()}
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                >
                  <ArrowUp size={16} strokeWidth={2.25} />
                </button>
              </div>
              <div className="hint">
                <span>
                  {canListen
                    ? 'Enter to send, or tap the mic to speak'
                    : 'Enter to send, Shift + Enter for a new line'}
                </span>
                <span>{userTurnCount} exchanges</span>
              </div>
            </div>
          </div>

          <Evidence chunks={evidence} />
        </div>
      </div>
    </div>
  );
}

function Message({ role, content, live }: { role: string; content: string; live?: boolean }) {
  const label = role === 'user' ? 'You' : 'They';
  return (
    <div className={`msg ${role === 'user' ? 'user' : ''}`}>
      <div className="msg-role">{label}</div>
      <div className="msg-body">
        {content}
        {live && <span className="cursor" />}
      </div>
    </div>
  );
}
