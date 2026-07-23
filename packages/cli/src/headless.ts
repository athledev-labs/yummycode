import type { CliArgs } from './args.js';
import { buildProvider, launch, prepareIndex, providerConfigFromArgs } from './orchestrate.js';
import { color, symbols } from './ui.js';

const log = (s = '') => process.stdout.write(`${s}\n`);

/**
 * Non-interactive runner. Used when a project path is supplied or stdin is not
 * a TTY (CI, scripts). Same orchestration as the TUI, printed as plain lines.
 */
export async function runHeadless(args: CliArgs): Promise<void> {
  if (!args.projectPath) {
    log(color.red('No project path. Pass one, e.g. yummycode ./my-app'));
    process.exitCode = 1;
    return;
  }

  log();
  log(`  ${color.bold('yummycode')} ${color.gray('practice explaining your codebase')}`);
  log();

  log(`  ${symbols.dot} Scanning ${color.white(args.projectPath)}`);
  const index = await prepareIndex({
    projectPath: args.projectPath,
    rescan: args.rescan,
    onProgress: (e) => {
      if (e.phase !== 'done') log(`    ${color.gray(e.message)}`);
    },
  });
  log(
    `  ${symbols.ok} Indexed ${color.white(index.name)} ${color.gray(
      `(${index.stats.filesScanned} files, ${index.languages.slice(0, 2).join(', ') || 'mixed'}, ${index.routes.length} routes)`,
    )}`,
  );

  const { provider, status } = await buildProvider(providerConfigFromArgs(args));
  if (status.ok) {
    log(`  ${symbols.ok} Provider ${color.white(provider.label)}`);
  } else {
    log(`  ${symbols.warn} ${color.yellow(status.detail)}`);
    log(
      `    ${color.gray('The browser UI will still open. Use --mock to try it without a model.')}`,
    );
  }

  const server = await launch({ index, provider, port: args.port, open: args.open });
  log();
  log(`  ${symbols.arrow} ${color.bold(color.blue(server.url))}`);
  log(`  ${color.gray('Server running. Press Ctrl+C to stop.')}`);
  log();

  await waitForShutdown(server.close);
}

function waitForShutdown(close: () => Promise<void>): Promise<void> {
  return new Promise<void>((resolve) => {
    const shutdown = () => {
      log(`\n  ${color.gray('Shutting down.')}`);
      void close().finally(() => resolve());
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
