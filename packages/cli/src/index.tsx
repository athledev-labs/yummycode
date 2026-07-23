#!/usr/bin/env node
import { createElement } from 'react';
import { helpText, parseArgs } from './args.js';
import { runHeadless } from './headless.js';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(`${helpText()}\n`);
    return;
  }
  if (args.version) {
    process.stdout.write(`yummycode ${VERSION}\n`);
    return;
  }

  const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY) && !args.yes;

  if (!interactive) {
    await runHeadless(args);
    return;
  }

  // Interactive TUI.
  const [{ render }, { App }] = await Promise.all([import('ink'), import('./tui/App.js')]);
  const instance = render(createElement(App, { args }), { exitOnCtrlC: false });
  await instance.waitUntilExit();
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
