import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  isStale,
  readIndex,
  scanProject,
  writeIndex,
  type ProjectIndex,
  type ScanProgressEvent,
} from '@yummycode/core';
import {
  createProvider,
  type LLMProvider,
  type ProviderConfig,
  type ProviderStatus,
} from '@yummycode/llm';
import { startServer, type RunningServer } from '@yummycode/server';
import type { CliArgs } from './args.js';

export function providerConfigFromArgs(args: CliArgs): ProviderConfig {
  return {
    kind: args.provider,
    model: args.model,
  };
}

export async function resolveProjectPath(input: string): Promise<string> {
  const abs = path.resolve(input.replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Not a directory: ${abs}`);
  }
  return abs;
}

export interface PrepareIndexOptions {
  projectPath: string;
  rescan: boolean;
  onProgress?: (event: ScanProgressEvent) => void;
}

/** Load a fresh cached index if present, otherwise scan and persist one. */
export async function prepareIndex(options: PrepareIndexOptions): Promise<ProjectIndex> {
  const root = await resolveProjectPath(options.projectPath);

  if (!options.rescan) {
    const cached = await readIndex(root);
    if (cached && !isStale(cached)) {
      options.onProgress?.({ phase: 'done', message: 'Loaded cached index', progress: 1 });
      return cached;
    }
  }

  const index = await scanProject(root, options.onProgress);
  await writeIndex(index).catch(() => {});
  return index;
}

export interface ProviderResult {
  provider: LLMProvider;
  status: ProviderStatus;
}

export async function buildProvider(config: ProviderConfig): Promise<ProviderResult> {
  const provider = await createProvider(config);
  const status = await provider.status();
  return { provider, status };
}

export interface LaunchOptions {
  index: ProjectIndex;
  provider: LLMProvider;
  port: number;
  open: boolean;
}

export async function launch(options: LaunchOptions): Promise<RunningServer> {
  const server = await startServer({
    index: options.index,
    provider: options.provider,
    port: options.port,
  });

  if (options.open) {
    try {
      const { default: open } = await import('open');
      await open(server.url);
    } catch {
      // Opening the browser is best-effort; the URL is always printed.
    }
  }

  return server;
}
