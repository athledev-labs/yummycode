import { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { ProjectIndex } from '@yummycode/core';
import type { ProviderStatus } from '@yummycode/llm';
import type { RunningServer } from '@yummycode/server';
import type { CliArgs } from '../args.js';
import { buildProvider, launch, prepareIndex, providerConfigFromArgs } from '../orchestrate.js';
import { ProjectPicker } from './ProjectPicker.js';

type Phase = 'picking' | 'scanning' | 'running' | 'error';

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 80);
    return () => clearInterval(id);
  }, [active]);
  return SPINNER[frame]!;
}

export function App({ args }: { args: CliArgs }) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>(args.projectPath ? 'scanning' : 'picking');
  const [status, setStatus] = useState('');
  const [index, setIndex] = useState<ProjectIndex | null>(null);
  const [providerLabel, setProviderLabel] = useState('');
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const serverRef = useRef<RunningServer | null>(null);
  const startedRef = useRef(false);

  const spinner = useSpinner(phase === 'scanning');

  const shutdown = () => {
    const server = serverRef.current;
    if (server) void server.close();
    exit();
    setTimeout(() => process.exit(0), 50);
  };

  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || (phase === 'running' && input === 'q')) {
      shutdown();
    }
  });

  const begin = async (projectPath: string) => {
    setPhase('scanning');
    try {
      const indexed = await prepareIndex({
        projectPath,
        rescan: args.rescan,
        onProgress: (e) => setStatus(e.message),
      });
      setIndex(indexed);

      setStatus('Checking provider');
      const { provider, status: pstatus } = await buildProvider(providerConfigFromArgs(args));
      setProviderLabel(provider.label);
      setProviderStatus(pstatus);

      setStatus('Starting server');
      const server = await launch({ index: indexed, provider, port: args.port, open: args.open });
      serverRef.current = server;
      setUrl(server.url);
      setPhase('running');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  };

  useEffect(() => {
    if (args.projectPath && !startedRef.current) {
      startedRef.current = true;
      void begin(args.projectPath);
    }
  }, []);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold>yummycode</Text>
        <Text color="gray"> practice explaining your codebase</Text>
      </Box>

      {phase === 'picking' && (
        <ProjectPicker
          initial={args.projectPath ?? process.cwd()}
          onSelect={(p) => {
            startedRef.current = true;
            void begin(p);
          }}
        />
      )}

      {phase === 'scanning' && (
        <Box>
          <Text color="cyan">{spinner} </Text>
          <Text>{status || 'Working'}</Text>
        </Box>
      )}

      {phase === 'error' && (
        <Box flexDirection="column">
          <Text color="red">{error}</Text>
          <Text color="gray">Check the path and try again.</Text>
        </Box>
      )}

      {phase === 'running' && index && (
        <Box flexDirection="column">
          <Box>
            <Text color="green">OK </Text>
            <Text>
              Indexed {index.name}{' '}
              <Text color="gray">
                ({index.stats.filesScanned} files,{' '}
                {index.languages.slice(0, 2).join(', ') || 'mixed'}, {index.routes.length} routes)
              </Text>
            </Text>
          </Box>
          <Box>
            <Text color={providerStatus?.ok ? 'green' : 'yellow'}>
              {providerStatus?.ok ? 'OK ' : ' ! '}
            </Text>
            <Text>{providerStatus?.ok ? providerLabel : providerStatus?.detail}</Text>
          </Box>
          {!providerStatus?.ok && (
            <Box marginLeft={3}>
              <Text color="gray">
                The UI still opens. Restart with --mock to try it without a model.
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="gray">{'-> '}</Text>
            <Text color="blue" bold>
              {url}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Open the link, pick an audience, and start the conversation.</Text>
          </Box>
          <Box>
            <Text color="gray">Press Ctrl+C to stop.</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
