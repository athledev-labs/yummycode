import { useEffect, useState } from 'react';
import {
  MessageSquareQuote,
  Languages,
  HelpCircle,
  GitCompareArrows,
  EyeOff,
  GraduationCap,
  RotateCcw,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import type { Debrief } from '../types';
import { getDebrief, getDebriefMarkdown, debriefMarkdownUrl } from '../api';

interface Props {
  sessionId: string;
  onRestart: () => void;
}

const SCORE_LABELS: Record<keyof Debrief['scores'], string> = {
  clarity: 'Clarity',
  grounding: 'Grounding',
  consistency: 'Consistency',
  audienceFit: 'Audience fit',
};

export function DebriefView({ sessionId, onRestart }: Props) {
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyMarkdown = async () => {
    try {
      const md = await getDebriefMarkdown(sessionId);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the download link is the fallback.
    }
  };

  useEffect(() => {
    let alive = true;
    setDebrief(null);
    setError(null);
    getDebrief(sessionId)
      .then((d) => alive && setDebrief(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="main">
        <div className="content center-state">
          <p className="error-text">{error}</p>
          <button className="pill" onClick={onRestart}>
            Start a new session
          </button>
        </div>
      </div>
    );
  }

  if (!debrief) {
    return (
      <div className="main">
        <div className="content center-state">
          <div className="spinner" />
          <p className="muted">Analyzing the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="content content-wide">
        <p className="eyebrow">Debrief</p>
        <h1 className="h1">How that landed</h1>
        <p className="sub">
          A read on how clearly you explained {debrief.projectName}, and what to tighten before the
          next session.
        </p>

        <div className="toolbar">
          <button className="pill pill-ghost" onClick={copyMarkdown}>
            {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
            {copied ? 'Copied' : 'Copy as markdown'}
          </button>
          <a className="pill pill-ghost" href={debriefMarkdownUrl(sessionId)} download>
            <Download size={14} strokeWidth={1.75} />
            Download
          </a>
        </div>

        <div className="section">
          <div className="section-title">
            <MessageSquareQuote size={16} strokeWidth={1.75} />
            One-sentence summary
          </div>
          <div className="compare">
            <div className="card">
              <div className="label">Your version</div>
              <div className="value">
                {debrief.userSummary || 'You did not land a clear one-liner.'}
              </div>
            </div>
            <div className="card">
              <div className="label">A clearer version</div>
              <div className="value">{debrief.clearSummary}</div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Scores</div>
          <div className="scores">
            {(Object.keys(debrief.scores) as (keyof Debrief['scores'])[]).map((key) => (
              <div className="score" key={key}>
                <div className="score-head">
                  <span>{SCORE_LABELS[key]}</span>
                  <span className="n">{debrief.scores[key]}</span>
                </div>
                <div className="meter">
                  <span style={{ width: `${debrief.scores[key]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <ListSection
          icon={<Languages size={16} strokeWidth={1.75} />}
          title="Jargon used without translation"
          empty="You kept the language plain. Nothing flagged."
          items={debrief.jargon.map((j) => ({ head: j.term, body: j.context }))}
        />

        <ListSection
          icon={<HelpCircle size={16} strokeWidth={1.75} />}
          title="Questions dodged or hand-waved"
          empty="You engaged with each question directly."
          items={debrief.dodgedQuestions.map((d) => ({ head: d.question, body: d.note }))}
        />

        <ListSection
          icon={<GitCompareArrows size={16} strokeWidth={1.75} />}
          title="Contradictions"
          empty="Your account stayed consistent."
          items={debrief.contradictions.map((c) => ({
            head: c.note,
            body: `Earlier: ${c.earlier}\nLater: ${c.later}`,
          }))}
        />

        <div className="section">
          <div className="section-title">
            <EyeOff size={16} strokeWidth={1.75} />
            What a non-technical listener would still miss
          </div>
          <div className="list">
            {debrief.gaps.map((g, i) => (
              <div className="list-item" key={i}>
                <div className="ctx">{g}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-title">
            <GraduationCap size={16} strokeWidth={1.75} />
            Study before your next session
          </div>
          <div className="list study">
            {debrief.studyPlan.map((s, i) => (
              <div className="list-item" key={i}>
                <span className="num">{i + 1}</span>
                <div>
                  <div className="term">{s.topic}</div>
                  <div className="ctx">{s.why}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="pill" onClick={onRestart}>
          <RotateCcw size={14} strokeWidth={2} />
          New session
        </button>
      </div>
    </div>
  );
}

function ListSection({
  icon,
  title,
  empty,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  items: { head: string; body: string }[];
}) {
  return (
    <div className="section">
      <div className="section-title">
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="list">
          {items.map((it, i) => (
            <div className="list-item" key={i}>
              <div className="term">{it.head}</div>
              <div className="ctx" style={{ whiteSpace: 'pre-wrap' }}>
                {it.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
