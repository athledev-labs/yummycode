import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'node:path';
import { isDirectory, listCandidates, expandHome, type DirCandidate } from './paths.js';

interface Props {
  initial: string;
  onSelect: (projectPath: string) => void;
}

/**
 * A path input with live directory suggestions. Type to filter, arrows to move,
 * Tab to complete the highlighted directory, Enter to select.
 */
export function ProjectPicker({ initial, onSelect }: Props) {
  const [query, setQuery] = useState(initial);
  const [candidates, setCandidates] = useState<DirCandidate[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listCandidates(query).then((c) => {
      if (!alive) return;
      setCandidates(c);
      setSelected((s) => Math.min(s, Math.max(0, c.length - 1)));
    });
    return () => {
      alive = false;
    };
  }, [query]);

  useInput((input, key) => {
    setError('');
    if (key.upArrow) {
      setSelected((s) => (s > 0 ? s - 1 : candidates.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((s) => (s < candidates.length - 1 ? s + 1 : 0));
      return;
    }
    if (key.tab) {
      const pick = candidates[selected];
      if (pick) setQuery(`${pick.fullPath}/`);
      return;
    }
    if (key.return) {
      void submit();
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
    }
  });

  async function submit() {
    // Prefer the highlighted candidate when the typed query is not itself a dir.
    const typedIsDir = await isDirectory(query);
    const candidate = candidates[selected];
    const chosen = typedIsDir ? expandHome(query) : candidate?.fullPath;
    if (chosen && (await isDirectory(chosen))) {
      onSelect(path.resolve(chosen));
    } else {
      setError('That path is not a directory. Keep typing or pick a suggestion.');
    }
  }

  return (
    <Box flexDirection="column">
      <Text color="gray">Select a project to index</Text>
      <Box marginTop={1}>
        <Text color="gray">path </Text>
        <Text>
          {query}
          <Text color="cyan">_</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {candidates.length === 0 && <Text color="gray"> no matching directories</Text>}
        {candidates.map((c, i) => (
          <Text key={c.fullPath} color={i === selected ? 'cyan' : 'gray'}>
            {i === selected ? '> ' : '  '}
            {c.name}
          </Text>
        ))}
      </Box>

      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color="gray">arrows to move, tab to complete, enter to scan</Text>
        </Box>
      )}
    </Box>
  );
}
