import type { ProviderKind } from '@yummycode/llm';

export interface CliArgs {
  projectPath?: string;
  provider: ProviderKind;
  model?: string;
  port: number;
  open: boolean;
  rescan: boolean;
  yes: boolean;
  mock: boolean;
  help: boolean;
  version: boolean;
}

const HELP = `yummycode - practice explaining your codebase to any audience

Usage:
  yummycode [project-path] [options]

Options:
  --project <path>      Project directory to index (skips the picker)
  --provider <kind>     auto | ollama | openai | anthropic | mock (default: auto)
  --model <name>        Model override for the chosen provider
  --mock                Use the offline mock provider (no Ollama or API key)
  --port <number>       Server port (default: 0, an ephemeral port)
  --no-open             Do not open the browser automatically
  --rescan              Force a fresh scan, ignoring any cached index
  -y, --yes             Non-interactive: scan and serve without the TUI
  -h, --help            Show this help
  -v, --version         Show version

Examples:
  npx yummycode
  yummycode ~/dev/my-app
  yummycode --project ./api --mock --no-open`;

export function helpText(): string {
  return HELP;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    provider: 'auto',
    port: 0,
    open: true,
    rescan: false,
    yes: false,
    mock: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => argv[++i];
    switch (arg) {
      case '--project':
      case '-p':
        args.projectPath = next();
        break;
      case '--provider':
        args.provider = (next() ?? 'auto') as ProviderKind;
        break;
      case '--model':
        args.model = next();
        break;
      case '--mock':
        args.mock = true;
        break;
      case '--port':
        args.port = Number.parseInt(next() ?? '0', 10) || 0;
        break;
      case '--no-open':
        args.open = false;
        break;
      case '--rescan':
        args.rescan = true;
        break;
      case '-y':
      case '--yes':
        args.yes = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      default:
        if (!arg.startsWith('-') && !args.projectPath) {
          args.projectPath = arg;
        }
    }
  }

  if (args.mock) args.provider = 'mock';
  return args;
}
