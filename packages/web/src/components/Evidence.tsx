import { FileCode, FileText, Boxes, Network, Settings, FolderTree } from 'lucide-react';
import type { EvidenceChunk } from '../types';

const KIND_ICON: Record<string, typeof FileText> = {
  readme: FileText,
  manifest: Boxes,
  route: Network,
  structure: FolderTree,
  config: Settings,
  entrypoint: FileCode,
  source: FileCode,
};

interface Props {
  chunks: EvidenceChunk[];
}

export function Evidence({ chunks }: Props) {
  return (
    <div className="panel">
      <p className="panel-title">Evidence in play</p>
      {chunks.length === 0 ? (
        <p className="panel-empty">
          Relevant files and snippets from your project will appear here as the conversation
          references them.
        </p>
      ) : (
        <div className="evidence">
          {chunks.map((c) => {
            const Icon = KIND_ICON[c.kind] ?? FileText;
            return (
              <div className="evidence-item" key={c.id}>
                <div className="evidence-head">
                  <Icon size={14} strokeWidth={1.75} />
                  {c.title}
                </div>
                {c.path && c.path !== '.' && <div className="evidence-path">{c.path}</div>}
                <div className="evidence-body">{c.content.slice(0, 220)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
