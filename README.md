# yummycode

Practice explaining your codebase to any audience, grounded in your actual project.

As AI writes more of the implementation, the durable engineering skill is understanding a
system and explaining it clearly under pressure. yummycode is a local-first conversation
simulator: it indexes your repository, puts a persona across the table (from a non-technical
friend to a fellow engineer), and lets you practice by text or voice. At
the end it hands you a structured debrief that names the jargon you leaned on, the questions you
dodged, and what to study next.

This is not a coding assistant or a code explainer. It does not answer for you. It asks.

## Local-first privacy promise

Everything runs on your machine. The scanner reads text files only, never executes your project,
and never sends repository contents anywhere. Inference defaults to a local model through
[Ollama](https://ollama.com). If you set an API key, and only then, requests go to that hosted
provider. The index is written to `.yummycode/` in your project and a per-path cache under
`~/.cache/yummycode`.

## Quickstart

```bash
# Requires Node 20+ and pnpm. Ollama is optional (see Providers).
pnpm install
pnpm build

# Run against a project
node packages/cli/dist/index.js ~/dev/my-app
# or, once linked: yummycode ~/dev/my-app
```

The TUI walks you through it: pick a project, watch it index, then it opens your browser to the
session. Pick an audience, explain your project, and end the session to get a debrief.

No model installed yet? Try the whole flow offline with the mock provider:

```bash
node packages/cli/dist/index.js ~/dev/my-app --mock
```

## The loop

1. `yummycode` starts, you select a project, and it runs a real scan (README, manifests,
   directory shape, entry points, HTTP routes, config files).
2. It detects a provider and starts a local server on an ephemeral port, then opens the browser.
3. In the browser you pick an audience and have a conversation, by text or by voice. The persona
   pushes back in character and stays naive. An evidence sidebar surfaces the files and snippets it
   is drawing on.
4. You end the session and get a debrief: your one-sentence summary versus a clearer one,
   untranslated jargon, dodged questions, contradictions, remaining gaps, and three things to study.
   Copy it as Markdown or download it.

Sessions are saved under the project's `.yummycode/sessions` so they survive a restart.

## Audiences

Four general personas, one per kind of listener. Each pushes back differently and never helps.
They are defined as plain data, so you can tune them or add your own later.

- A friend (non-technical): interrupts on jargon, asks what things actually do
- A product manager (product): users, scope, impact, and risk
- A business leader (business): value, cost, risk, and outcomes
- A fellow engineer (technical): design, tradeoffs, and failure modes

## Providers

Inference sits behind a provider interface, chosen with `--provider` or `YUMMYCODE_PROVIDER`.

| Provider    | How it runs       | Notes                                                                  |
| ----------- | ----------------- | ---------------------------------------------------------------------- |
| `ollama`    | Local             | Default. Auto-selects the best installed model.                        |
| `anthropic` | Hosted (your key) | Set `ANTHROPIC_API_KEY`. Defaults to `claude-sonnet-5`.                |
| `openai`    | Hosted (your key) | Set `OPENAI_API_KEY`. Defaults to `gpt-4o-mini`.                       |
| `mock`      | Offline           | No model needed. Used for demos and CI.                                |
| `auto`      | Picks the best    | Hosted key if present, else local Ollama, else surfaces the next step. |

With Ollama, install a model once:

```bash
ollama pull qwen3:14b   # or any qwen/llama/mistral model; the best installed one is used
```

See `.env.example` for all variables. Keys are read from the environment and never committed.

## CLI

```
yummycode [project-path] [options]

--project <path>   Project directory to index (skips the picker)
--provider <kind>  auto | ollama | openai | anthropic | mock
--model <name>     Model override for the chosen provider
--mock             Use the offline mock provider
--port <number>    Server port (default: ephemeral)
--no-open          Do not open the browser
--rescan           Force a fresh scan, ignoring the cache
-y, --yes          Non-interactive: scan and serve without the TUI
```

## Architecture

A TypeScript monorepo (pnpm workspaces). The conversation engine is a system of small modules,
not one prompt.

```
packages/
  core/          project scanner, index builder, lexical retrieval, index cache, shared types
  llm/           provider adapters (Ollama, OpenAI, Anthropic, Mock) behind one interface
  conversation/  persona profiles, session orchestrator (phase state machine),
                 claim extractor, contradiction detector, grounding retriever, persona responder
  debrief/       jargon, dodge, and contradiction detectors, rubric scoring, report builder
  server/        local HTTP API (Hono), SSE streaming, session store, static hosting
  web/           Vite + React browser app (audience picker, conversation, debrief)
  cli/           Ink TUI, project picker, scan orchestration, server boot
```

Design principles:

- The session moves through explicit phases: `opening -> probing -> escalation -> closing -> debrief`.
- Persona prompts define character constraints (stay in character, do not help, short questions).
- A claim tracker logs user assertions so contradictions can be caught across turns.
- A grounding layer injects relevant index chunks so the persona asks sharper questions.
- The debrief consumes the full transcript, the claim log, and the index. It is a pipeline of
  deterministic detectors plus a single model call for a clear reference summary, not one big prompt.

### Local API

```
GET  /api/health                    provider and project status
GET  /api/index                     indexed project metadata for the sidebar
GET  /api/personas                  available audiences
GET  /api/sessions                  saved sessions (when persistence is on)
POST /api/sessions                  create a session from the index
GET  /api/sessions/:id              session state
POST /api/sessions/:id/messages     user message, streams the persona reply over SSE
GET  /api/sessions/:id/evidence     relevant index chunks for a topic
POST /api/sessions/:id/debrief      generate the structured debrief
GET  /api/sessions/:id/debrief.md   the debrief as Markdown
```

Route detection covers Express, Hono, Fastify, FastAPI, Flask, NestJS, Spring, Rails, Django, and
Next.js app-router files.

## Develop

```bash
pnpm build        # build every package (libs then the web app)
pnpm test         # build libs, then run the vitest suite
pnpm smoke        # build, boot the server, and drive a full session with the mock provider
pnpm lint         # eslint
pnpm format       # prettier

# iterate on the browser app against a running server
node packages/cli/dist/index.js ~/dev/my-app --mock --port 8787 --no-open
pnpm --filter @yummycode/web dev
```

TypeScript strict mode is on across the monorepo. Tests cover the indexer, claim extractor,
contradiction and jargon detection, the debrief schema, and the session API.

## Scope

Ships four general personas, a guided home, text and voice conversation, local indexing across many stacks, session
persistence, and a debrief you can export. Auth, billing, teams, a custom persona builder, cloud
sync, and diagrams are intentionally out of scope. See `ROADMAP.md` for what comes next.

## License

MIT
