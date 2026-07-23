import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import type { ProjectIndex } from '@yummycode/core';
import type { LLMProvider } from '@yummycode/llm';
import { createApp } from './app.js';
import { resolveWebDist } from './web-dist.js';

export interface StartServerOptions {
  index: ProjectIndex;
  provider: LLMProvider;
  /** 0 (default) picks an ephemeral port. */
  port?: number;
  host?: string;
  webDist?: string | null;
}

export interface RunningServer {
  url: string;
  port: number;
  host: string;
  close: () => Promise<void>;
}

export async function startServer(options: StartServerOptions): Promise<RunningServer> {
  const host = options.host ?? '127.0.0.1';
  const webDist = options.webDist ?? resolveWebDist();
  const app = createApp({ index: options.index, provider: options.provider, webDist });

  return new Promise<RunningServer>((resolve, reject) => {
    let server: Server;
    try {
      server = serve({ fetch: app.fetch, port: options.port ?? 0, hostname: host }, (info) => {
        const url = `http://${host}:${info.port}`;
        resolve({
          url,
          port: info.port,
          host,
          close: () =>
            new Promise<void>((res) => {
              server.close(() => res());
            }),
        });
      }) as unknown as Server;
      server.on('error', reject);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
